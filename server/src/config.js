import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 8787),
  auth0Domain: process.env.AUTH0_DOMAIN || "dev-l52y223ttoigljdr.us.auth0.com",
  auth0Audience: process.env.AUTH0_AUDIENCE || "https://mnemosyne-api",
  auth0RolesNamespace: process.env.AUTH0_ROLES_NAMESPACE || "https://mnemosyne.app",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:8080",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSslMode: process.env.DATABASE_SSL_MODE || "require",
};
