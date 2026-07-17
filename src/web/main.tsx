import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "./styles.css";
import { GeckoUIPortal } from "@geckoui/geckoui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <GeckoUIPortal />
  </StrictMode>,
);
