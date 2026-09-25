// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle.js";
import { WhitePaperPage } from "./WhitePaperPage.js";

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let root: Root | undefined;
let mountNode: HTMLDivElement | undefined;

beforeEach(() => {
  reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  mountNode = document.createElement("div");
  document.body.append(mountNode);
  root = createRoot(mountNode);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  mountNode?.remove();
  root = undefined;
  mountNode = undefined;
  delete reactTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
});

describe("website theme", () => {
  it("switches the current page theme without writing browser storage", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => {
      root?.render(<ThemeToggle />);
    });

    const button = document.querySelector(".theme-toggle");
    if (!(button instanceof HTMLButtonElement)) throw new Error("Theme toggle was not rendered.");
    expect(button.getAttribute("aria-label")).toBe("Switch to dark mode");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      button.click();
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(storageWrite).not.toHaveBeenCalled();
  });
});

describe("white-paper page", () => {
  it("exposes the preservation claim, evidence boundary, workbench, and PDF", async () => {
    await act(async () => {
      root?.render(<WhitePaperPage />);
    });

    expect(document.body.textContent).toContain(
      "semanticEqual(decode(encode(input)), input) == true",
    );
    expect(document.body.textContent).toContain("Model understanding");
    expect(document.body.textContent).toContain("Not tested");
    expect(document.querySelector('a[href="/#compiler"]')).not.toBeNull();
    expect(document.querySelectorAll('a[href="/morph-white-paper-v0.1.pdf"]')).toHaveLength(3);
  });
});
