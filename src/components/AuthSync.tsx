import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://mnemosyne-api";

const AuthSync = () => {
  const syncedSubRef = useRef<string | null>(null);
  const { isAuthenticated, isLoading, user, getAccessTokenSilently, getAccessTokenWithPopup } =
    useAuth0();

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const sub = typeof user?.sub === "string" ? user.sub : "";
    if (!sub || syncedSubRef.current === sub) return;

    let isMounted = true;

    const syncUser = async () => {
      const getApiToken = async () => {
        try {
          return await getAccessTokenSilently({
            authorizationParams: { audience: authAudience },
          });
        } catch (error) {
          const code =
            typeof error === "object" && error
              ? (error as { error?: string }).error
              : "";
          if (code === "consent_required" || code === "login_required") {
            return getAccessTokenWithPopup({
              authorizationParams: { audience: authAudience },
            });
          }
          throw error;
        }
      };

      try {
        const token = await getApiToken();
        const response = await fetch(`${apiBaseUrl}/api/users/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: sub,
            email: user?.email || "",
            name: user?.name || "",
            picture: user?.picture || "",
          }),
        });

        if (response.ok && isMounted) {
          syncedSubRef.current = sub;
        }
      } catch {
        // Keep UI resilient if sync fails; user can still continue.
      }
    };

    void syncUser();

    return () => {
      isMounted = false;
    };
  }, [
    getAccessTokenSilently,
    getAccessTokenWithPopup,
    isAuthenticated,
    isLoading,
    user?.email,
    user?.name,
    user?.picture,
    user?.sub,
  ]);

  return null;
};

export default AuthSync;
