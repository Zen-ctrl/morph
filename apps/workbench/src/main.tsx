import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { WhitePaperPage } from "./WhitePaperPage.js";
import "./styles.css";
import "./editorial.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Workbench root element is missing.");

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const isWhitePaper = normalizedPath === "/white-paper";
document.title = isWhitePaper
  ? "MORPH White Paper | Data layouts without data loss"
  : "MORPH | Compare data layouts for AI prompts";

createRoot(root).render(<StrictMode>{isWhitePaper ? <WhitePaperPage /> : <App />}</StrictMode>);
