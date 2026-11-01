import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bitcount-ink";
import "@fontsource/bruno-ace-sc";
import "./index.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import App from "./App.tsx";

const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
