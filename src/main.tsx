import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain="dev-l52y223ttoigljdr.us.auth0.com"
    clientId="YAxGROdTh9975JR6B9wCUO7JEG9T6DTd"
    authorizationParams={{ redirect_uri: window.location.origin }}
  >
    <App />
  </Auth0Provider>,
);
