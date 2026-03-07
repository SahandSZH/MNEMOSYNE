from collections.abc import Callable
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from jwt import InvalidTokenError, PyJWKClientError
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


PUBLIC_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
}


class Auth0TokenValidator:
    def __init__(self) -> None:
        self.issuer = f"https://{settings.auth0_domain}/"
        self.audience = settings.auth0_audience
        self.algorithm = settings.auth0_algorithm
        self.jwks_client = jwt.PyJWKClient(f"{self.issuer}.well-known/jwks.json")

    def validate_token(self, token: str) -> dict[str, Any]:
        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=self.issuer,
            )
        except (InvalidTokenError, PyJWKClientError) as exc:
            raise ValueError("Invalid access token.") from exc


token_validator = Auth0TokenValidator()


class Auth0Middleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        request.state.user = None

        if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return await call_next(request)

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid Authorization header format."},
            )

        token = parts[1]
        try:
            request.state.user = token_validator.validate_token(token)
        except ValueError as exc:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": str(exc)},
            )

        return await call_next(request)


def get_current_user(request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


def _normalize_claim_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        return [value]
    return []


def extract_roles(claims: dict[str, Any]) -> list[str]:
    roles: list[str] = []
    roles.extend(_normalize_claim_values(claims.get("roles")))
    roles.extend(_normalize_claim_values(claims.get("permissions")))

    if settings.auth0_roles_claim:
        roles.extend(_normalize_claim_values(claims.get(settings.auth0_roles_claim)))

    domain_roles_claim = f"https://{settings.auth0_domain}/roles"
    roles.extend(_normalize_claim_values(claims.get(domain_roles_claim)))

    return sorted(set(roles))


def require_roles(*required_roles: str) -> Callable:
    def role_dependency(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if not required_roles:
            return current_user

        user_roles = set(extract_roles(current_user))
        if user_roles.isdisjoint(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(required_roles)}",
            )

        return current_user

    return role_dependency
