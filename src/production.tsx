import React from "react";
import { createRoot } from "react-dom/client";
import { receiveNativeShare } from "./native-share";
import { BookmarkApp } from "./Prototype";
import "./production.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BookmarkApp standalone />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});

void receiveNativeShare(() => window.dispatchEvent(new Event("share-ready")));
