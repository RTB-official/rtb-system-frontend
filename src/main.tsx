// main.tsx
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function mount() {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  const root = createRoot(rootEl);
  root.render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}

