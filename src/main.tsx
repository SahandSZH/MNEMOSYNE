import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.tsx";
import "./index.css";

const auth0Domain =
  import.meta.env.VITE_AUTH0_DOMAIN || "dev-l52y223ttoigljdr.us.auth0.com";
const auth0ClientId =
  import.meta.env.VITE_AUTH0_CLIENT_ID || "YAxGROdTh9975JR6B9wCUO7JEG9T6DTd";

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={auth0Domain}
    clientId={auth0ClientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
    }}
  >
    <App />
  </Auth0Provider>,
);
