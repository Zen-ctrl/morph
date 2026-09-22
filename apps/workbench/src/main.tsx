import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { WhitePaperPage } from "./WhitePaperPage.js";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Workbench root element is missing.");

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const isWhitePaper = normalizedPath === "/white-paper";
document.title = isWhitePaper
  ? "MORPH White Paper · Lossless model context compilation"
  : "MORPH · Structured context, compiled with receipts";

createRoot(root).render(<StrictMode>{isWhitePaper ? <WhitePaperPage /> : <App />}</StrictMode>);
