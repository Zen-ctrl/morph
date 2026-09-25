import type {
  AccessPattern,
  CandidateReport,
  ExplainReport,
  MorphError,
  PlannerPolicy,
} from "@morph/core";
import { useMemo, useRef, useState } from "react";
import { DossierAfterWorkbench, DossierBeforeWorkbench } from "./DossierSections.js";
import { exampleById, WORKBENCH_EXAMPLES } from "./examples.js";
import type {
  ArtifactImportWorkerRequest,
  CompileSuccessPayload,
  CompileWorkerRequest,
  CompileWorkerResponse,
  WorkbenchCompileInput,
  WorkbenchWorkerRequest,
} from "./protocol.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { digestCompileInput, formatBytes, formatSavings, summarizeOutcomes } from "./workbench.js";

type RunPhase = "idle" | "running" | "success" | "failure" | "canceled";
type ActiveOperation = "compile" | "artifact-import";
type OutputTab = "context" | "artifact" | "restored" | "report" | "preservation";

interface FormState {
  readonly exampleId: string;
  readonly jsonText: string;
  readonly schemaText: string;
  readonly task: string;
  readonly accessPattern: AccessPattern;
  readonly profileId: "local-o200k-base";
  readonly policy: PlannerPolicy;
  readonly maxPromptTokens: string;
}

const firstExample = exampleById("uniform-table");

const INITIAL_FORM: FormState = {
  exampleId: firstExample.id,
  jsonText: firstExample.data,
  schemaText: firstExample.schema,
  task: firstExample.task,
  accessPattern: firstExample.accessPattern,
  profileId: "local-o200k-base",
  policy: "compatibility",
  maxPromptTokens: "",
};

const ACCESS_PATTERNS: readonly { readonly value: AccessPattern; readonly label: string }[] = [
  { value: "unknown", label: "Not sure" },
  { value: "entity-lookup", label: "Find one record" },
  { value: "multi-entity-comparison", label: "Compare several records" },
  { value: "aggregation", label: "Summarize or total values" },
  { value: "filtering", label: "Find matching records" },
  { value: "nested-path-lookup", label: "Look up a nested value" },
  { value: "sequence-analysis", label: "Follow ordered events" },
];

const REASON_LABELS: Readonly<Record<string, string>> = {
  BASELINE_COMPATIBILITY: "Familiar JSON is the safe default",
  BASELINE_MINIMUM_SAVINGS: "The alternatives did not save enough",
  BELOW_MINIMUM_SAVINGS: "The saving was below the selection threshold",
  CALLER_FORCED_ENCODING: "This layout was explicitly requested",
  CANDIDATE_LIMIT_PRUNED: "Not checked because the comparison limit was reached",
  ELIGIBLE_FOR_RANKING: "Passed every required check",
  ENCODER_NOT_APPLICABLE: "This layout does not fit the shape of the data",
  ENCODING_NOT_ALLOWED: "This layout is not allowed by the current settings",
  LOWEST_ELIGIBLE_TOKEN_COUNT: "Smallest prompt among the eligible layouts",
  NOT_FORCED_ENCODING: "A different layout was explicitly requested",
  OVER_TOKEN_BUDGET: "Larger than the prompt budget",
  QUALITY_PROFILE_MISMATCH: "Available model evidence does not match this case",
  QUALITY_UNKNOWN: "Model understanding has not been tested",
  ROUNDTRIP_FAILED: "The original data could not be rebuilt exactly",
  SCHEMA_DEPENDENCY_MISSING: "A required data definition is missing",
};

const LAYOUT_NAMES: Readonly<Record<string, string>> = {
  "columns-json": "Column JSON",
  "json-compact": "Compact JSON",
  "json-lines": "JSON Lines",
  "path-value": "Typed paths",
  "rows-delimited": "Typed rows",
  toon: "Official TOON",
};

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const WARNING_INPUT_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;

function createCompilerWorker(): Worker {
  return new Worker(new URL("./compiler.worker.ts", import.meta.url), { type: "module" });
}

function statusLabel(value: string): string {
  return value.replaceAll("-", " ");
}

function reasonLabel(value: string): string {
  return REASON_LABELS[value] ?? value.toLowerCase().replaceAll("_", " ");
}

function layoutName(value: string): string {
  return LAYOUT_NAMES[value] ?? statusLabel(value);
}

function tokenCertaintyLabel(value: string): string {
  if (value === "exact-for-tokenizer") return "exact for this token counter";
  if (value === "provider-reported") return "reported by provider";
  return "estimate";
}

function candidateTone(candidate: CandidateReport): string {
  if (candidate.selected) return "selected";
  if (candidate.roundTrip === "failed" || candidate.quality.status === "failed") return "failed";
  if (candidate.eligible) return "eligible";
  return "muted";
}

function selectedCandidate(report: ExplainReport | undefined): CandidateReport | undefined {
  return report?.candidates.find((candidate) => candidate.selected);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(content: string): Promise<void> {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(content);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
}

function Spinner(): React.JSX.Element {
  return <span className="spinner" aria-hidden="true" />;
}

function StatusChip({
  value,
  tone = "neutral",
}: {
  readonly value: string;
  readonly tone?: string;
}): React.JSX.Element {
  return (
    <span className="status-chip" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabel(value)}
    </span>
  );
}

function CandidateTable({ report }: { readonly report: ExplainReport }): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="candidate-table">
        <caption>
          A layout-by-layout comparison for this data, question, selection mode, and token counter.
        </caption>
        <thead>
          <tr>
            <th scope="col">Layout</th>
            <th scope="col">Tokens</th>
            <th scope="col">Savings</th>
            <th scope="col">Fits data</th>
            <th scope="col">Data rebuilt</th>
            <th scope="col">Model evidence</th>
            <th scope="col">Decision</th>
          </tr>
        </thead>
        <tbody>
          {report.candidates.map((candidate) => (
            <tr key={candidate.planId} data-tone={candidateTone(candidate)}>
              <th scope="row">
                <span className="candidate-name">{layoutName(candidate.encoding)}</span>
                <span className="candidate-version">v{candidate.formatVersion}</span>
                {Object.keys(candidate.options).length > 0 ? (
                  <code className="candidate-options">{JSON.stringify(candidate.options)}</code>
                ) : null}
              </th>
              <td>
                {candidate.tokens === undefined ? (
                  <span className="not-measured">not measured</span>
                ) : (
                  <>
                    <strong>{candidate.tokens.count.toLocaleString()}</strong>
                    <span className="cell-detail">
                      {tokenCertaintyLabel(candidate.tokens.certainty)}
                    </span>
                  </>
                )}
              </td>
              <td className={(candidate.savingsTokens ?? 0) < 0 ? "negative-saving" : ""}>
                {formatSavings(candidate)}
              </td>
              <td>
                <StatusChip
                  value={candidate.applicable ? "yes" : "no"}
                  tone={candidate.applicable ? "verified" : "muted"}
                />
              </td>
              <td>
                <StatusChip
                  value={candidate.roundTrip}
                  tone={
                    candidate.roundTrip === "passed"
                      ? "verified"
                      : candidate.roundTrip === "failed"
                        ? "failed"
                        : "muted"
                  }
                />
              </td>
              <td>
                <StatusChip
                  value={candidate.quality.status}
                  tone={
                    candidate.quality.status === "qualified"
                      ? "verified"
                      : candidate.quality.status === "failed"
                        ? "failed"
                        : "warning"
                  }
                />
              </td>
              <td>
                <div className="decision-cell">
                  <StatusChip
                    value={
                      candidate.selected
                        ? "selected"
                        : candidate.eligible
                          ? "eligible"
                          : "not eligible"
                    }
                    tone={
                      candidate.selected ? "selected" : candidate.eligible ? "verified" : "muted"
                    }
                  />
                  <span className="reason-list">
                    {candidate.reasonCodes.length > 0
                      ? candidate.reasonCodes.map(reasonLabel).join(" · ")
                      : "No reason recorded"}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyResults(): React.JSX.Element {
  return (
    <section className="empty-results" aria-labelledby="empty-title">
      <div className="empty-visual" aria-hidden="true">
        <span>JSON</span>
        <i />
        <span>?</span>
      </div>
      <p className="eyebrow">Ready when you are</p>
      <h2 id="empty-title">Compare a few ways to arrange the same data.</h2>
      <p>
        MORPH will try the layouts that fit, rebuild the original data from each serious option, and
        count the full text a model would receive.
      </p>
      <ul>
        <li>Your input stays in this browser tab.</li>
        <li>This demo does not call an AI model.</li>
        <li>Your data is not saved by the site.</li>
      </ul>
    </section>
  );
}

function AppHeader(): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="browser-bar" aria-hidden="true">
        <span className="browser-controls">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-address">
          MORPH : MODEL OPTIMIZED REPRESENTATION FOR PROMPT HANDOFFS
        </span>
        <span className="browser-edition">V 0.1 / INDEX</span>
      </div>
      <div className="masthead">
        <a className="brand" href="#main-content" aria-label="MORPH workbench home">
          <span className="brand-symbol" aria-hidden="true">
            M<span>↗</span>
          </span>
          <span>
            <strong>MORPH</strong>
            <small>context compiler / browser workbench</small>
          </span>
        </a>
        <aside className="header-meta" aria-label="Demo status">
          <span className="masthead-note">LOCAL BY DESIGN · NO ACCOUNT</span>
          <ThemeToggle />
        </aside>
      </div>
    </header>
  );
}

export function App(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [success, setSuccess] = useState<CompileSuccessPayload>();
  const [failure, setFailure] = useState<MorphError>();
  const [failureReport, setFailureReport] = useState<ExplainReport>();
  const [resultDigest, setResultDigest] = useState<string>();
  const [activeTab, setActiveTab] = useState<OutputTab>("context");
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>("compile");
  const [notice, setNotice] = useState("Ready when you are.");
  const workerRef = useRef<Worker | undefined>(undefined);
  const fileReaderRef = useRef<FileReader | undefined>(undefined);
  const requestSequenceRef = useRef(0);
  const formRevisionRef = useRef(0);
  const phaseRef = useRef<RunPhase>("idle");

  const inputBytes = useMemo(
    () => new TextEncoder().encode(form.jsonText).byteLength,
    [form.jsonText],
  );
  const schemaBytes = useMemo(
    () => new TextEncoder().encode(form.schemaText).byteLength,
    [form.schemaText],
  );
  const report = success?.report ?? failureReport;
  const selected = selectedCandidate(report);
  const displayedPolicy = success?.artifact.plan.plannerPolicy ?? form.policy;
  const outcomes = summarizeOutcomes(displayedPolicy, report, success?.verification);

  const markPhase = (next: RunPhase): void => {
    phaseRef.current = next;
    setPhase(next);
  };

  const disposeWorker = (): void => {
    workerRef.current?.terminate();
    workerRef.current = undefined;
  };

  const disposeActiveWork = (): void => {
    disposeWorker();
    const reader = fileReaderRef.current;
    fileReaderRef.current = undefined;
    if (reader?.readyState === FileReader.LOADING) reader.abort();
  };

  const invalidateResults = (): void => {
    formRevisionRef.current += 1;
    if (phaseRef.current === "running") {
      disposeActiveWork();
      markPhase("canceled");
      setNotice("Input changed. The previous run was canceled so stale output cannot be shown.");
    } else {
      markPhase("idle");
      setNotice("Input changed. Run a new comparison to refresh the results.");
    }
    setSuccess(undefined);
    setFailure(undefined);
    setFailureReport(undefined);
    setResultDigest(undefined);
  };

  const updateForm = <Key extends keyof FormState>(key: Key, value: FormState[Key]): void => {
    invalidateResults();
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadExample = (id: string): void => {
    const example = exampleById(id);
    invalidateResults();
    setForm((current) => ({
      ...current,
      exampleId: example.id,
      jsonText: example.data,
      schemaText: example.schema,
      task: example.task,
      accessPattern: example.accessPattern,
    }));
    setNotice(`${example.name} loaded. Run a comparison when ready.`);
  };

  const cancelRun = (): void => {
    if (phaseRef.current !== "running") return;
    formRevisionRef.current += 1;
    disposeActiveWork();
    markPhase("canceled");
    setNotice("Operation canceled. No partial result was kept.");
  };

  const dispatchWorker = (request: WorkbenchWorkerRequest, runRevision: number): void => {
    const worker = createCompilerWorker();
    workerRef.current = worker;
    worker.addEventListener("message", (event: MessageEvent<CompileWorkerResponse>) => {
      const response = event.data;
      if (
        response.kind !== "result" ||
        response.requestId !== request.requestId ||
        response.requestDigest !== request.requestDigest ||
        runRevision !== formRevisionRef.current
      ) {
        return;
      }
      disposeWorker();
      if (response.ok) {
        setSuccess(response.result);
        setFailure(undefined);
        setFailureReport(undefined);
        setResultDigest(response.requestDigest);
        markPhase("success");
        setNotice(
          response.result.source === "artifact-import"
            ? `Saved result verified and opened for comparison ${response.requestDigest.slice(0, 12)}.`
            : `Comparison complete. ${response.result.report.candidates.length} layouts are reported for comparison ${response.requestDigest.slice(0, 12)}.`,
        );
      } else {
        setSuccess(undefined);
        setFailure(response.result.error);
        setFailureReport(response.result.report);
        setResultDigest(response.requestDigest);
        markPhase("failure");
        setNotice(`The browser comparison stopped with ${response.result.error.code}.`);
      }
    });
    worker.addEventListener("error", (event) => {
      if (runRevision !== formRevisionRef.current) return;
      disposeWorker();
      setFailure({
        code: "WORKER_FAILURE",
        message: event.message || "The browser comparison stopped unexpectedly.",
      });
      setFailureReport(undefined);
      setResultDigest(request.requestDigest);
      markPhase("failure");
      setNotice("The browser comparison stopped unexpectedly.");
    });
    worker.postMessage(request);
  };

  const runComparison = async (): Promise<void> => {
    disposeActiveWork();
    setSuccess(undefined);
    setFailure(undefined);
    setFailureReport(undefined);
    setResultDigest(undefined);
    setActiveTab("context");

    const trimmedBudget = form.maxPromptTokens.trim();
    const parsedBudget = trimmedBudget.length === 0 ? undefined : Number(trimmedBudget);
    if (parsedBudget !== undefined && (!Number.isSafeInteger(parsedBudget) || parsedBudget < 0)) {
      setFailure({
        code: "INVALID_TOKEN_BUDGET",
        message: "The token budget must be a nonnegative whole number.",
      });
      markPhase("failure");
      setNotice("The comparison did not start because the token budget is invalid.");
      return;
    }

    const input: WorkbenchCompileInput = {
      jsonText: form.jsonText,
      schemaText: form.schemaText,
      task: form.task,
      accessPattern: form.accessPattern,
      policy: form.policy,
      ...(parsedBudget === undefined ? {} : { maxPromptTokens: parsedBudget }),
    };
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    formRevisionRef.current += 1;
    const runRevision = formRevisionRef.current;
    setActiveOperation("compile");
    markPhase("running");
    setNotice("Comparing layouts and measuring the full prompt in your browser.");

    try {
      const requestDigest = await digestCompileInput(input);
      if (runRevision !== formRevisionRef.current || phaseRef.current !== "running") return;
      const request: CompileWorkerRequest = {
        kind: "compile",
        requestId,
        requestDigest,
        input,
      };
      dispatchWorker(request, runRevision);
    } catch (error) {
      disposeActiveWork();
      const message =
        error instanceof Error ? error.message : "Unable to start the browser comparison.";
      setFailure({ code: "WORKBENCH_FAILURE", message });
      setResultDigest(undefined);
      markPhase("failure");
      setNotice("The comparison could not be started.");
    }
  };

  const importArtifactFile = async (file: File): Promise<void> => {
    disposeActiveWork();
    setSuccess(undefined);
    setFailure(undefined);
    setFailureReport(undefined);
    setResultDigest(undefined);
    setActiveTab("artifact");
    formRevisionRef.current += 1;
    const runRevision = formRevisionRef.current;
    setActiveOperation("artifact-import");

    if (file.size > MAX_ARTIFACT_BYTES) {
      setFailure({
        code: "MAX_ARTIFACT_BYTES_EXCEEDED",
        message: `The saved result is ${formatBytes(file.size)} and exceeds the ${formatBytes(MAX_ARTIFACT_BYTES)} import limit.`,
      });
      markPhase("failure");
      setNotice("The selected saved result is too large to open.");
      return;
    }

    markPhase("running");
    setNotice(`Opening ${file.name} in your browser. Nothing is uploaded.`);
    try {
      const reader = new FileReader();
      fileReaderRef.current = reader;
      const artifactText = await new Promise<string>((resolve, reject) => {
        reader.addEventListener("load", () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("The saved result could not be read as UTF-8 text."));
        });
        reader.addEventListener("error", () =>
          reject(reader.error ?? new Error("Reading the saved result failed.")),
        );
        reader.addEventListener("abort", () =>
          reject(new Error("Opening the saved result was canceled.")),
        );
        reader.readAsText(file, "UTF-8");
      });
      fileReaderRef.current = undefined;
      if (runRevision !== formRevisionRef.current || phaseRef.current !== "running") return;
      const requestDigest = await digestCompileInput({ kind: "artifact-import", artifactText });
      if (runRevision !== formRevisionRef.current || phaseRef.current !== "running") return;
      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      const request: ArtifactImportWorkerRequest = {
        kind: "import-artifact",
        requestId,
        requestDigest,
        artifactText,
      };
      setNotice(`Checking ${file.name} in your browser.`);
      dispatchWorker(request, runRevision);
    } catch (error) {
      fileReaderRef.current = undefined;
      if (runRevision !== formRevisionRef.current) return;
      const message =
        error instanceof Error ? error.message : "The saved result could not be read.";
      setFailure({ code: "ARTIFACT_READ_FAILED", message });
      markPhase("failure");
      setNotice("The saved result could not be read.");
    }
  };

  const artifactText = success === undefined ? "" : jsonText(success.artifact);
  const reportText = report === undefined ? "" : jsonText(report);
  const preservationText =
    success === undefined
      ? "The data rebuild check has not run."
      : [
          `DATA RECOVERY: ${success.verification.valid ? "VERIFIED" : "FAILED"}`,
          `Rebuild check: ${success.verification.semanticRoundTrip}`,
          `File integrity: ${success.verification.checksum}`,
          `Required information: ${success.verification.dependencies}`,
          `Data fingerprint: ${success.artifact.inputSemanticDigest}`,
          "",
          success.verification.valid
            ? "No differences in data meaning were found after MORPH rebuilt the JSON from its model-ready bundle."
            : "MORPH found a mismatch. Inspect the error list in the decision details.",
          success.source === "artifact-import"
            ? "The saved result does not contain a hidden original JSON copy. Its rebuilt value must match the stored data fingerprint."
            : "Spacing, object display order, and alternate escape spelling may change because they do not change the JSON data itself.",
        ].join("\n");
  const outputByTab: Record<OutputTab, string> = {
    context: success?.renderedContext ?? "No model-ready text is available.",
    artifact: artifactText || "No saved MORPH result is available.",
    restored: success?.restoredJson ?? "No rebuilt JSON is available.",
    report: reportText || "No decision details are available.",
    preservation: preservationText,
  };

  const handleCopy = async (content: string, label: string): Promise<void> => {
    try {
      await copyText(content);
      setNotice(`${label} copied to the clipboard.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Clipboard access failed.");
    }
  };

  const inputWarning =
    inputBytes > MAX_INPUT_BYTES
      ? `Input is ${formatBytes(inputBytes)} and exceeds the default ${formatBytes(MAX_INPUT_BYTES)} limit.`
      : inputBytes > WARNING_INPUT_BYTES
        ? `Large input: ${formatBytes(inputBytes)}. Compilation runs off the main thread.`
        : undefined;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy-block">
            <div className="hero-drawing">
              <img
                src="/morph-structure.svg"
                alt="Abstract isometric model of data arranged into different structures"
              />
              <span>FIG. 01 / REARRANGEMENT STUDY</span>
            </div>
            <div className="hero-statement">
              <p className="eyebrow">An atlas of model-ready data / 2026</p>
              <h1 id="page-title">
                Same data.
                <br />
                <em>Different shape.</em>
              </h1>
              <p className="hero-copy">
                MORPH compares ways to arrange structured data for an AI prompt, checks every value
                can be recovered, and explains the choice.
              </p>
            </div>
          </div>
          <nav className="hero-directory" aria-label="Primary navigation">
            <a href="#use-case">
              <span>01</span> Introduction <b aria-hidden="true">↗</b>
            </a>
            <a href="#formats">
              <span>02</span> The layouts <b aria-hidden="true">↗</b>
            </a>
            <a href="#compiler">
              <span>03</span> Try the workbench <b aria-hidden="true">↗</b>
            </a>
            <a href="#proof">
              <span>04</span> Evidence &amp; limits <b aria-hidden="true">↗</b>
            </a>
            <a href="/white-paper">
              <span>05</span> The white paper <b aria-hidden="true">↗</b>
            </a>
            <div className="directory-note">
              <span>INDEX / 01</span>
              <span>SCROLL TO EXPLORE ↓</span>
            </div>
          </nav>
        </section>

        <section className="editorial-grid" aria-label="Explore MORPH">
          <div className="editorial-intro">
            <p className="eyebrow">Notes from the workbench / 25.09.26</p>
            <h2>Structure is a design decision.</h2>
            <p>
              JSON, rows, columns, and paths can describe the same information. MORPH measures each
              arrangement without leaving anything behind.
            </p>
            <div className="editorial-rule" />
            <strong>In this edition</strong>
            <ul>
              <li>
                <a href="#use-case">
                  Why the shape matters <span>→</span>
                </a>
              </li>
              <li>
                <a href="#formats">
                  Six layouts to compare <span>→</span>
                </a>
              </li>
              <li>
                <a href="#compiler">
                  Your data, in your browser <span>→</span>
                </a>
              </li>
            </ul>
            <p className="editorial-aside">
              A smaller prompt is a measurement. Whether a model understands it equally well is a
              separate question.
            </p>
          </div>
          <a className="editorial-card" href="#formats">
            <div className="editorial-image image-one" />
            <span>01 / FORMAT STUDY</span>
            <strong>One source. Many layouts.</strong>
          </a>
          <a className="editorial-card" href="#use-case">
            <div className="editorial-image image-two" />
            <span>02 / THE PRINCIPLE</span>
            <strong>No detail left out.</strong>
          </a>
          <a className="editorial-card" href="#proof">
            <div className="editorial-image image-three" />
            <span>03 / THE EVIDENCE</span>
            <strong>Measure the complete prompt.</strong>
          </a>
          <a className="editorial-card" href="#compiler">
            <div className="editorial-image image-four" />
            <span>04 / THE WORKBENCH</span>
            <strong>See the comparison yourself.</strong>
          </a>
        </section>

        <DossierBeforeWorkbench />

        <div className="workspace-grid" id="compiler">
          <section className="control-panel" aria-labelledby="input-heading">
            <div className="panel-heading">
              <div>
                <span className="step-number">01</span>
                <div>
                  <p className="eyebrow">Set up a comparison</p>
                  <h2 id="input-heading">Your data and question</h2>
                </div>
              </div>
              <span className="privacy-note">Processed in this browser</span>
            </div>

            <div className="artifact-import-row">
              <div>
                <strong>Open a saved MORPH result</strong>
                <span>
                  A saved result contains the chosen layout, its data, and the details needed to
                  check it.
                </span>
              </div>
              <label className="button import-button" htmlFor="artifact-file-input">
                <span aria-hidden="true">↑</span>
                Open saved result
              </label>
              <input
                id="artifact-file-input"
                data-testid="artifact-file-input"
                className="visually-hidden-file"
                type="file"
                accept="application/json,.json,.morph.json"
                disabled={phase === "running"}
                onChange={(event) => {
                  const file = event.currentTarget.files?.item(0);
                  event.currentTarget.value = "";
                  if (file !== null && file !== undefined) void importArtifactFile(file);
                }}
              />
            </div>

            <fieldset className="example-strip">
              <legend id="examples-label">Ready-made examples</legend>
              <div className="example-buttons">
                {WORKBENCH_EXAMPLES.map((example, index) => (
                  <button
                    key={example.id}
                    type="button"
                    className={
                      form.exampleId === example.id ? "example-button active" : "example-button"
                    }
                    aria-pressed={form.exampleId === example.id}
                    title={example.description}
                    onClick={() => loadExample(example.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {example.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field-group data-field">
              <div className="field-label-row">
                <label htmlFor="json-input">JSON data</label>
                <span className={inputWarning === undefined ? "byte-count" : "byte-count warning"}>
                  {formatBytes(inputBytes)}
                </span>
              </div>
              <textarea
                id="json-input"
                className="code-input"
                value={form.jsonText}
                spellCheck={false}
                required
                aria-describedby={
                  inputWarning === undefined ? "json-help" : "json-help json-warning"
                }
                onChange={(event) => updateForm("jsonText", event.currentTarget.value)}
              />
              <div className="field-help-row">
                <span id="json-help">
                  Number spelling stays exact, including values such as -0 and 1.2300.
                </span>
                {inputWarning === undefined ? null : (
                  <span id="json-warning" className="inline-warning" role="alert">
                    {inputWarning}
                  </span>
                )}
              </div>
            </div>

            <details className="schema-disclosure" open={form.schemaText.length > 0}>
              <summary>
                <span>Optional data description (JSON Schema)</span>
                <span>{form.schemaText.length > 0 ? formatBytes(schemaBytes) : "None"}</span>
              </summary>
              <div className="field-group">
                <label htmlFor="schema-input">Schema text</label>
                <textarea
                  id="schema-input"
                  className="code-input schema-input"
                  value={form.schemaText}
                  spellCheck={false}
                  placeholder='{"$schema":"https://json-schema.org/draft/2020-12/schema", ...}'
                  onChange={(event) => updateForm("schemaText", event.currentTarget.value)}
                />
                <p className="field-help">
                  A schema describes the data's structure and meaning. If included, its text is
                  counted in every layout.
                </p>
              </div>
            </details>

            <div className="field-group">
              <label htmlFor="task-input">What should the model do with the data?</label>
              <textarea
                id="task-input"
                className="task-input"
                value={form.task}
                required
                onChange={(event) => updateForm("task", event.currentTarget.value)}
              />
              <p className="field-help">
                This describes the job for the comparison. It never gives MORPH permission to remove
                data.
              </p>
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="access-pattern">What kind of question is this?</label>
                <select
                  id="access-pattern"
                  value={form.accessPattern}
                  onChange={(event) =>
                    updateForm("accessPattern", event.currentTarget.value as AccessPattern)
                  }
                >
                  {ACCESS_PATTERNS.map((pattern) => (
                    <option key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </option>
                  ))}
                </select>
                <p className="field-help">
                  MORPH keeps this with the result and uses it when matching model-test evidence.
                </p>
              </div>
              <div className="field-group">
                <label htmlFor="target-profile">Token counter</label>
                <select id="target-profile" value={form.profileId} disabled>
                  <option value="local-o200k-base">o200k_base</option>
                </select>
                <p className="field-help">
                  A tokenizer is the rule set used to split text into tokens. This count does not
                  test answer quality.
                </p>
              </div>
              <div className="field-group">
                <label htmlFor="policy">How should MORPH choose?</label>
                <select
                  id="policy"
                  value={form.policy}
                  onChange={(event) =>
                    updateForm("policy", event.currentTarget.value as PlannerPolicy)
                  }
                >
                  <option value="compatibility">Stay with familiar JSON (cautious default)</option>
                  <option value="economy-experimental">
                    Try the smallest safe layout (experimental)
                  </option>
                  <option value="validated">Only use layouts backed by model tests</option>
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="token-budget">Maximum prompt tokens</label>
                <input
                  id="token-budget"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.maxPromptTokens}
                  placeholder="No limit"
                  onChange={(event) => updateForm("maxPromptTokens", event.currentTarget.value)}
                />
              </div>
            </div>

            <div className="run-bar">
              <div className="run-copy">
                <strong>Runs entirely in this browser</strong>
                <span>Built-in token counter · no uploads · no saved input</span>
              </div>
              {phase === "running" ? (
                <button type="button" className="button secondary" onClick={cancelRun}>
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className="button primary"
                disabled={
                  phase === "running" || form.jsonText.length === 0 || form.task.trim().length === 0
                }
                onClick={() => void runComparison()}
              >
                {phase === "running" ? <Spinner /> : <span aria-hidden="true">↗</span>}
                {phase === "running"
                  ? activeOperation === "artifact-import"
                    ? "Importing"
                    : "Compiling"
                  : "Run comparison"}
              </button>
            </div>
          </section>

          <section
            className="results-panel"
            aria-labelledby="results-heading"
            aria-busy={phase === "running"}
          >
            <div className="panel-heading results-heading">
              <div>
                <span className="step-number">02</span>
                <div>
                  <p className="eyebrow">What MORPH found</p>
                  <h2 id="results-heading">Layout comparison</h2>
                </div>
              </div>
              <StatusChip
                value={phase}
                tone={
                  phase === "success"
                    ? "verified"
                    : phase === "failure"
                      ? "failed"
                      : phase === "running"
                        ? "selected"
                        : "neutral"
                }
              />
            </div>

            {phase === "idle" || phase === "canceled" ? <EmptyResults /> : null}
            {phase === "running" ? (
              <div className="loading-state" role="status">
                <div className="loading-orbit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="eyebrow">
                  {activeOperation === "artifact-import"
                    ? "Opening saved result"
                    : "Comparison running"}
                </p>
                <h3>
                  {activeOperation === "artifact-import"
                    ? "Checking the saved MORPH result."
                    : "Checking every layout that could win."}
                </h3>
                <p>
                  {activeOperation === "artifact-import"
                    ? "MORPH checks the file, rebuilds the data, and confirms that the result still matches."
                    : "MORPH arranges the data, rebuilds it, counts the prompt, and applies your selection rules."}
                </p>
              </div>
            ) : null}
            {failure !== undefined ? (
              <div className="error-card" role="alert">
                <div className="error-code">{failure.code}</div>
                <div>
                  <h3>The comparison did not produce a usable result.</h3>
                  <p>{failure.message}</p>
                  {failure.path === undefined ? null : <code>Path: {failure.path}</code>}
                </div>
              </div>
            ) : null}

            {report === undefined ? null : (
              <div className="results-content">
                <section className="outcome-grid" aria-label="Result distinctions">
                  {outcomes.map((outcome) => (
                    <article key={outcome.label} className="outcome-card" data-tone={outcome.tone}>
                      <p>{outcome.label}</p>
                      <strong>{outcome.value}</strong>
                      <span>{outcome.detail}</span>
                    </article>
                  ))}
                </section>

                {selected === undefined ? null : (
                  <div className="selection-callout">
                    <div>
                      <p className="eyebrow">
                        {success?.source === "artifact-import" ? "Saved layout" : "Selected layout"}
                      </p>
                      <h3>
                        {layoutName(selected.encoding)} <span>v{selected.formatVersion}</span>
                      </h3>
                    </div>
                    <div className="selection-metric">
                      <strong>{selected.tokens?.count.toLocaleString() ?? "Unknown"}</strong>
                      <span>prompt tokens</span>
                    </div>
                    <p>{selected.reasonCodes.map(reasonLabel).join(" · ")}</p>
                  </div>
                )}

                <CandidateTable report={report} />

                <div className="report-footer">
                  {resultDigest === undefined ? null : (
                    <div title={resultDigest}>
                      <span>comparison ID</span>
                      <strong>{resultDigest.slice(0, 12)}</strong>
                    </div>
                  )}
                  <div>
                    <span>Search</span>
                    <strong>{report.completedSearch ? "Completed" : "Incomplete"}</strong>
                  </div>
                  {Object.entries(report.resourceSummary).map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                      <strong>{value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>

                {report.warnings.length === 0 ? null : (
                  <div className="warning-list">
                    <h3>Things to know about this result</h3>
                    <ul>
                      {report.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {report === undefined ? null : (
          <section className="artifact-panel" aria-labelledby="artifact-heading">
            <div className="artifact-header">
              <div>
                <p className="eyebrow">Look under the hood</p>
                <h2 id="artifact-heading">Saved result and data check</h2>
              </div>
              <nav className="download-actions" aria-label="Result downloads">
                <button
                  type="button"
                  className="text-button"
                  disabled={success === undefined}
                  onClick={() => {
                    if (success !== undefined)
                      downloadText("morph.context.txt", success.renderedContext, "text/plain");
                  }}
                >
                  Model text ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={success === undefined}
                  onClick={() => {
                    if (success !== undefined)
                      downloadText("morph.artifact.json", artifactText, "application/json");
                  }}
                >
                  Saved result ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    downloadText("morph.comparison.json", reportText, "application/json")
                  }
                >
                  Decision details ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={success === undefined}
                  onClick={() => {
                    if (success !== undefined)
                      downloadText("morph.restored.json", success.restoredJson, "application/json");
                  }}
                >
                  Rebuilt JSON ↓
                </button>
              </nav>
            </div>

            <div className="tab-bar" role="tablist" aria-label="Result views">
              {(
                [
                  ["context", "Model-ready text"],
                  ["artifact", "Saved MORPH result"],
                  ["restored", "Rebuilt JSON"],
                  ["report", "Decision details"],
                  ["preservation", "Data check"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  id={`tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  aria-controls={`panel-${id}`}
                  tabIndex={activeTab === id ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              id={`panel-${activeTab}`}
              className="output-view"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
            >
              <div className="output-toolbar">
                <span>
                  {activeTab === "context" && selected?.tokens !== undefined
                    ? `${selected.tokens.count.toLocaleString()} tokens · ${selected.tokens.tokenizerId}`
                    : activeTab === "preservation"
                      ? success?.verification.valid
                        ? "No data differences"
                        : "Verification unavailable or failed"
                      : formatBytes(new TextEncoder().encode(outputByTab[activeTab]).byteLength)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      outputByTab[activeTab],
                      activeTab === "context" ? "Rendered context" : "View",
                    )
                  }
                >
                  Copy {activeTab === "context" ? "context" : "view"}
                </button>
              </div>
              {activeTab === "preservation" && success !== undefined ? (
                <div className="preservation-view">
                  <div className="preservation-banner" data-valid={success.verification.valid}>
                    <span aria-hidden="true">{success.verification.valid ? "✓" : "!"}</span>
                    <div>
                      <strong>
                        {success.verification.valid
                          ? "The rebuilt data matches"
                          : "The rebuilt data does not match"}
                      </strong>
                      <p>{preservationText.split("\n").slice(5).join(" ")}</p>
                    </div>
                  </div>
                  <div className="diff-grid">
                    <div>
                      <span className="code-label">
                        {success.source === "artifact-import"
                          ? "Data inside the saved result"
                          : "Your accepted JSON"}
                      </span>
                      <pre>
                        {success.source === "artifact-import"
                          ? success.artifact.section.payload
                          : form.jsonText}
                      </pre>
                    </div>
                    <div>
                      <span className="code-label">JSON rebuilt by MORPH</span>
                      <pre>{success.restoredJson}</pre>
                    </div>
                  </div>
                  <dl className="verification-list">
                    <div>
                      <dt>Data fingerprint</dt>
                      <dd>{success.artifact.inputSemanticDigest}</dd>
                    </div>
                    <div>
                      <dt>Rebuild check</dt>
                      <dd>{success.verification.semanticRoundTrip}</dd>
                    </div>
                    <div>
                      <dt>File integrity check</dt>
                      <dd>{success.verification.checksum}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <pre>{outputByTab[activeTab]}</pre>
              )}
            </div>
          </section>
        )}

        <DossierAfterWorkbench />
      </main>

      <footer className="app-footer">
        <p>
          MORPH keeps data recovery, prompt size, and model understanding separate. A smaller prompt
          is not automatically a better prompt.
        </p>
        <span>Your input stays in this browser · no analytics · no saved data</span>
      </footer>

      <div className="sr-status" role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
    </div>
  );
}
