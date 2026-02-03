import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element #root not found in index.html");
  document.body.innerHTML =
    "<pre style='color:red'>Root element not found</pre>";
} else {
  console.log("✅ Root element found, mounting React");
  createRoot(rootElement).render(<App />);
}
