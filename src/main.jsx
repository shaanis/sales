import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./styles/global.css";

// Register Service Worker for PWA & Offline Support
registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
