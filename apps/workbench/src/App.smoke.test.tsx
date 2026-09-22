// @vitest-environment happy-dom

import {
  createArtifact,
  type EncoderPlan,
  type ExplainReport,
  parseArtifactJson,
  parseJsonStrict,
  printJson,
  renderArtifactModelContext,
  verifyArtifactIntegrity,
} from "@morph/core";
import {
  JSON_COMPACT_GUIDE_ID,
  JSON_COMPACT_GUIDE_TEXT,
  JSON_COMPACT_GUIDE_VERSION,
  jsonCompactEncoder,
} from "@morph/encoders";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import type {
  CompileSuccessPayload,
  CompileWorkerResponse,
  WorkbenchWorkerRequest,
} from "./protocol.js";

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const fixtureIr = parseJsonStrict(
  '{"customers":[{"id":"c1","country":"US","revenue":129},{"id":"c2","country":"CA","revenue":85}]}',
);
const fixturePlan: EncoderPlan = {
  encoding: "json-compact",
  formatVersion: "1",
  options: {},
};
const fixtureSection = jsonCompactEncoder.encode(fixtureIr, fixturePlan);
const fixtureArtifact = createArtifact({
  ir: fixtureIr,
  plan: fixturePlan,
  section: fixtureSection,
  plannerPolicy: "compatibility",
  target: {
    profileId: "local-o200k-base",
    tokenizerId: "o200k_base",
    tokenizerRevision: "smoke-fixture-revision",
  },
  task: {
    instruction: "Find customer c2.",
    accessPattern: "entity-lookup",
    preserveReadableLabels: true,
  },
  guideId: JSON_COMPACT_GUIDE_ID,
  guideVersion: JSON_COMPACT_GUIDE_VERSION,
  guideText: JSON_COMPACT_GUIDE_TEXT,
});
const fixtureContext = renderArtifactModelContext(fixtureArtifact);
const fixtureReport: ExplainReport = {
  reportVersion: "morph-explain/1",
  completedSearch: true,
  baselinePlanId: "json-compact@1:smoke",
  selectedPlanId: "json-compact@1:smoke",
  policy: "compatibility",
  candidates: [
    {
      planId: "json-compact@1:smoke",
      encoding: "json-compact",
      formatVersion: "1",
      options: {},
      selected: true,
      applicable: true,
      roundTrip: "passed",
      dependencies: "complete",
      tokens: {
        count: 137,
        tokenizerId: "o200k_base",
        tokenizerRevision: "smoke-fixture-revision",
        textDigest: fixtureContext.renderedDigest,
        scope: "rendered-text",
        certainty: "exact-for-tokenizer",
        assumptions: [],
      },
      savingsTokens: 0,
      savingsFraction: 0,
      quality: {
        status: "unknown",
        baselineEncoding: "json-compact",
      },
      eligible: true,
      reasonCodes: ["BASELINE_COMPATIBILITY"],
      elapsedMs: 1,
    },
  ],
  warnings: ["Model quality is unbound in this offline profile."],
  resourceSummary: {
    candidatesConsidered: 1,
    candidatesRendered: 1,
  },
};
const fixtureSuccess: CompileSuccessPayload = {
  source: "compile",
  artifact: fixtureArtifact,
  report: fixtureReport,
  renderedContext: fixtureContext.rendered,
  restoredJson: printJson(fixtureIr),
  verification: {
    valid: true,
    checksum: "passed",
    dependencies: "complete",
    semanticRoundTrip: "passed",
    errors: [],
  },
};

type MessageListener = (event: MessageEvent<CompileWorkerResponse>) => void;
type ErrorListener = (event: ErrorEvent) => void;

class DeterministicWorker {
  static instances: DeterministicWorker[] = [];

  readonly requests: WorkbenchWorkerRequest[] = [];
  readonly messageListeners = new Set<MessageListener>();
  readonly errorListeners = new Set<ErrorListener>();
  terminated = false;

  constructor(_url: string | URL, _options?: WorkerOptions) {
    DeterministicWorker.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    if (type === "message") this.messageListeners.add(listener as MessageListener);
    if (type === "error") this.errorListeners.add(listener as ErrorListener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    if (type === "message") this.messageListeners.delete(listener as MessageListener);
    if (type === "error") this.errorListeners.delete(listener as ErrorListener);
  }

  postMessage(message: WorkbenchWorkerRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(response: CompileWorkerResponse): void {
    const event = { data: response } as MessageEvent<CompileWorkerResponse>;
    for (const listener of this.messageListeners) listener(event);
  }
}

type FileReaderListener = EventListenerOrEventListenerObject;

class DeterministicFileReader {
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;

  readonly listeners = new Map<string, Set<FileReaderListener>>();
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  readyState = DeterministicFileReader.EMPTY;

  addEventListener(type: string, listener: FileReaderListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FileReaderListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FileReaderListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  readAsText(blob: Blob, _encoding?: string): void {
    this.readyState = DeterministicFileReader.LOADING;
    queueMicrotask(() => {
      if (this.readyState !== DeterministicFileReader.LOADING) return;
      const text = (blob as Blob & { readonly smokeText?: string }).smokeText;
      if (text === undefined) {
        this.error = new DOMException("The smoke-test file has no deterministic text.");
        this.readyState = DeterministicFileReader.DONE;
        this.emit("error");
        return;
      }
      this.result = text;
      this.readyState = DeterministicFileReader.DONE;
      this.emit("load");
    });
  }

  abort(): void {
    if (this.readyState !== DeterministicFileReader.LOADING) return;
    this.readyState = DeterministicFileReader.DONE;
    this.emit("abort");
  }

  private emit(type: string): void {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
}

interface CapturedDownload {
  readonly filename: string;
  readonly url: string;
}

let root: Root | undefined;
let mountNode: HTMLDivElement | undefined;
let networkAttempts: string[];
let createdBlobs: Map<string, Blob>;
let capturedDownloads: CapturedDownload[];

function normalizedText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buttonNamed(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
    normalizedText(candidate).includes(label),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected a button containing ${JSON.stringify(label)}.`);
  }
  return button;
}

async function eventually(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  throw lastError;
}

beforeEach(async () => {
  reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  DeterministicWorker.instances = [];
  networkAttempts = [];
  createdBlobs = new Map();
  capturedDownloads = [];

  vi.stubGlobal("fetch", () => {
    networkAttempts.push("fetch");
    return Promise.reject(new Error("Network access is blocked in this test."));
  });
  vi.stubGlobal("Worker", DeterministicWorker);
  vi.stubGlobal("FileReader", DeterministicFileReader);
  vi.stubGlobal(
    "XMLHttpRequest",
    class BlockedXMLHttpRequest {
      constructor() {
        networkAttempts.push("XMLHttpRequest");
        throw new Error("XMLHttpRequest is blocked in this test.");
      }
    },
  );
  vi.stubGlobal(
    "WebSocket",
    class BlockedWebSocket {
      constructor() {
        networkAttempts.push("WebSocket");
        throw new Error("WebSocket is blocked in this test.");
      }
    },
  );

  vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
    if (!(object instanceof Blob)) throw new TypeError("Expected a Blob download.");
    const url = `blob:morph-smoke/${createdBlobs.size + 1}`;
    createdBlobs.set(url, object);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    capturedDownloads.push({ filename: this.download, url: this.href });
  });

  mountNode = document.createElement("div");
  document.body.append(mountNode);
  root = createRoot(mountNode);
  await act(async () => {
    root?.render(<App />);
  });
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
  vi.unstubAllGlobals();
});

describe("workbench UI smoke", () => {
  it("binds worker results, exports an importable artifact, and rejects stale canceled output", async () => {
    await act(async () => {
      buttonNamed("Run comparison").click();
    });
    await eventually(() => {
      expect(DeterministicWorker.instances).toHaveLength(1);
      expect(DeterministicWorker.instances[0]?.requests).toHaveLength(1);
    });

    const firstWorker = DeterministicWorker.instances[0];
    const firstRequest = firstWorker?.requests[0];
    if (firstWorker === undefined || firstRequest === undefined) {
      throw new Error("The first compile request was not posted to the worker.");
    }

    await act(async () => {
      firstWorker.emit({
        kind: "result",
        requestId: firstRequest.requestId,
        requestDigest: "stale-digest",
        ok: true,
        result: fixtureSuccess,
      });
    });
    expect(document.querySelector(".artifact-panel")).toBeNull();
    expect(document.querySelector(".results-panel")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      firstWorker.emit({
        kind: "result",
        requestId: firstRequest.requestId,
        requestDigest: firstRequest.requestDigest,
        ok: true,
        result: fixtureSuccess,
      });
    });

    expect(firstWorker.terminated).toBe(true);
    expect(normalizedText(document.querySelector(".selection-callout") as Element)).toContain(
      "json-compact v1",
    );
    expect(document.querySelector(".selection-metric strong")?.textContent).toBe("137");
    expect(document.querySelector(".selection-metric span")?.textContent).toBe("rendered tokens");
    expect(document.querySelector(".report-footer [title]")?.getAttribute("title")).toBe(
      firstRequest.requestDigest,
    );
    expect(document.querySelector(".output-view pre")?.textContent).toBe(
      fixtureSuccess.renderedContext,
    );
    expect(document.body.textContent).toContain("Data preservation");
    expect(document.body.textContent).toContain("Verified");
    expect(document.body.textContent).toContain("Exact text");
    expect(document.body.textContent).toContain("Untested");

    for (const label of ["Context", "Artifact", "Report", "Restored"]) {
      await act(async () => {
        buttonNamed(`${label} ↓`).click();
      });
    }

    expect(capturedDownloads.map((download) => download.filename)).toEqual([
      "morph.context.txt",
      "morph.artifact.json",
      "morph.comparison.json",
      "morph.restored.json",
    ]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);

    const artifactDownload = capturedDownloads.find(
      (download) => download.filename === "morph.artifact.json",
    );
    const artifactBlob =
      artifactDownload === undefined ? undefined : createdBlobs.get(artifactDownload.url);
    if (artifactBlob === undefined) throw new Error("The artifact download blob was not captured.");
    const exportedArtifactText = await artifactBlob.text();
    const importedArtifact = parseArtifactJson(exportedArtifactText);
    expect(importedArtifact).toEqual(fixtureArtifact);
    expect(verifyArtifactIntegrity(importedArtifact)).toMatchObject({
      valid: true,
      checksum: "passed",
      dependencies: "complete",
    });

    await act(async () => {
      buttonNamed("Run comparison").click();
    });
    await eventually(() => {
      expect(DeterministicWorker.instances).toHaveLength(2);
      expect(DeterministicWorker.instances[1]?.requests).toHaveLength(1);
    });

    const canceledWorker = DeterministicWorker.instances[1];
    const canceledRequest = canceledWorker?.requests[0];
    if (canceledWorker === undefined || canceledRequest === undefined) {
      throw new Error("The cancelable compile request was not posted to the worker.");
    }
    await act(async () => {
      buttonNamed("Cancel").click();
    });
    expect(canceledWorker.terminated).toBe(true);
    expect(document.querySelector(".sr-status")?.textContent).toContain("Operation canceled");

    await act(async () => {
      canceledWorker.emit({
        kind: "result",
        requestId: canceledRequest.requestId,
        requestDigest: canceledRequest.requestDigest,
        ok: true,
        result: fixtureSuccess,
      });
    });
    expect(document.querySelector(".artifact-panel")).toBeNull();
    expect(document.querySelector(".results-content")).toBeNull();
    expect(normalizedText(document.querySelector(".results-panel") as Element)).toContain(
      "canceled",
    );

    const artifactFile = new File([exportedArtifactText], "customers.morph.json", {
      type: "application/json",
    });
    Object.defineProperty(artifactFile, "smokeText", {
      configurable: true,
      value: exportedArtifactText,
    });
    const artifactInput = document.querySelector('[data-testid="artifact-file-input"]');
    if (!(artifactInput instanceof HTMLInputElement)) {
      throw new Error("The artifact file input was not rendered.");
    }
    Object.defineProperty(artifactInput, "files", {
      configurable: true,
      value: {
        0: artifactFile,
        length: 1,
        item: (index: number) => (index === 0 ? artifactFile : null),
      },
    });
    await act(async () => {
      artifactInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await eventually(() => {
      expect(DeterministicWorker.instances).toHaveLength(3);
      expect(DeterministicWorker.instances[2]?.requests).toHaveLength(1);
    });

    const importWorker = DeterministicWorker.instances[2];
    const importRequest = importWorker?.requests[0];
    if (importWorker === undefined || importRequest === undefined) {
      throw new Error("The artifact import request was not posted to the worker.");
    }
    expect(importRequest).toMatchObject({
      kind: "import-artifact",
      artifactText: exportedArtifactText,
    });
    await act(async () => {
      importWorker.emit({
        kind: "result",
        requestId: importRequest.requestId,
        requestDigest: importRequest.requestDigest,
        ok: true,
        result: { ...fixtureSuccess, source: "artifact-import" },
      });
    });
    expect(importWorker.terminated).toBe(true);
    expect(normalizedText(document.querySelector(".selection-callout") as Element)).toContain(
      "Imported plan",
    );
    expect(document.querySelector(".sr-status")?.textContent).toContain(
      "Artifact verified and opened",
    );
    expect(document.querySelector(".output-view pre")?.textContent).toContain(
      '"artifactVersion": "morph-artifact/1"',
    );

    expect(networkAttempts).toEqual([]);
  });
});
