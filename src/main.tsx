import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { initAppLifecycle } from "./lib/app-lifecycle";
import "./styles.css";

// Initialize app lifecycle handling for native platforms
initAppLifecycle();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);