import { auth } from "express-oauth2-jwt-bearer";

import { config } from "./config.js";

export const checkJwt = auth({
  audience: config.auth0Audience,
  issuerBaseURL: `https://${config.auth0Domain}/`,
  tokenSigningAlg: "RS256",
});

const rolesClaim = `${config.auth0RolesNamespace}/roles`;

export function getRoles(payload) {
  const value = payload?.[rolesClaim];
  return Array.isArray(value) ? value.map(String) : [];
}

export function requireDoctor(req, res, next) {
  const roles = getRoles(req.auth?.payload);
  if (roles.includes("doctor")) {
    return next();
  }
  return res.status(403).json({
    error: "forbidden",
    message: "Doctor role required.",
  });
}
