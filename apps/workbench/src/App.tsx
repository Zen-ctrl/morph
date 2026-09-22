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
  { value: "unknown", label: "Unknown" },
  { value: "entity-lookup", label: "Entity lookup" },
  { value: "multi-entity-comparison", label: "Multi-entity comparison" },
  { value: "aggregation", label: "Aggregation hint" },
  { value: "filtering", label: "Filtering hint" },
  { value: "nested-path-lookup", label: "Nested path lookup" },
  { value: "sequence-analysis", label: "Sequence analysis" },
];

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const WARNING_INPUT_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;

function createCompilerWorker(): Worker {
  return new Worker(new URL("./compiler.worker.ts", import.meta.url), { type: "module" });
}

function statusLabel(value: string): string {
  return value.replaceAll("-", " ");
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
          Candidate measurements for this exact input, task, schema, policy, and tokenizer profile.
        </caption>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Tokens</th>
            <th scope="col">Savings</th>
            <th scope="col">Applicable</th>
            <th scope="col">Round trip</th>
            <th scope="col">Evidence</th>
            <th scope="col">Decision</th>
          </tr>
        </thead>
        <tbody>
          {report.candidates.map((candidate) => (
            <tr key={candidate.planId} data-tone={candidateTone(candidate)}>
              <th scope="row">
                <span className="candidate-name">{candidate.encoding}</span>
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
                      {candidate.tokens.certainty.replaceAll("-", " ")}
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
                      ? candidate.reasonCodes.join(" · ")
                      : "NO_REASON_RECORDED"}
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
      <p className="eyebrow">Local comparison</p>
      <h2 id="empty-title">See what the model would actually receive.</h2>
      <p>
        Run the compiler to compare complete, reversible representations. Every token count includes
        its guide, metadata, schema, task, and framing.
      </p>
      <ul>
        <li>No input leaves this browser.</li>
        <li>No model call is made.</li>
        <li>No data is saved by default.</li>
      </ul>
    </section>
  );
}

function AppHeader(): React.JSX.Element {
  return (
    <header className="app-header">
      <a className="brand" href="#main-content" aria-label="MORPH workbench home">
        <img className="brand-mark" src="/morph-mark.jpg" alt="" aria-hidden="true" />
        <span>
          <strong>MORPH</strong>
          <small>context compiler</small>
        </span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#use-case">Use case</a>
        <a href="#formats">Formats</a>
        <a href="#compiler">Workbench</a>
        <a href="#proof">Evidence</a>
        <a href="#docs">Docs</a>
      </nav>
      <aside className="header-meta" aria-label="Runtime status">
        <StatusChip value="offline" tone="verified" />
        <span>local-o200k-base</span>
        <span>v0.1.0</span>
      </aside>
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
  const [notice, setNotice] = useState("Ready for a local comparison.");
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
            ? `Artifact verified and opened from input ${response.requestDigest.slice(0, 12)}.`
            : `Comparison complete. ${response.result.report.candidates.length} candidates are reported for input ${response.requestDigest.slice(0, 12)}.`,
        );
      } else {
        setSuccess(undefined);
        setFailure(response.result.error);
        setFailureReport(response.result.report);
        setResultDigest(response.requestDigest);
        markPhase("failure");
        setNotice(`Local operation stopped with ${response.result.error.code}.`);
      }
    });
    worker.addEventListener("error", (event) => {
      if (runRevision !== formRevisionRef.current) return;
      disposeWorker();
      setFailure({
        code: "WORKER_FAILURE",
        message: event.message || "The local compiler worker stopped unexpectedly.",
      });
      setFailureReport(undefined);
      setResultDigest(request.requestDigest);
      markPhase("failure");
      setNotice("The local compiler worker stopped unexpectedly.");
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
    setNotice("Compiling and measuring candidates in a local worker.");

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
        error instanceof Error ? error.message : "Unable to start the local compiler worker.";
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
        message: `The artifact is ${formatBytes(file.size)} and exceeds the ${formatBytes(MAX_ARTIFACT_BYTES)} import limit.`,
      });
      markPhase("failure");
      setNotice("The selected artifact is too large to import.");
      return;
    }

    markPhase("running");
    setNotice(`Reading ${file.name} locally. No upload is performed.`);
    try {
      const reader = new FileReader();
      fileReaderRef.current = reader;
      const artifactText = await new Promise<string>((resolve, reject) => {
        reader.addEventListener("load", () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("The artifact file could not be read as UTF-8 text."));
        });
        reader.addEventListener("error", () =>
          reject(reader.error ?? new Error("Artifact read failed.")),
        );
        reader.addEventListener("abort", () => reject(new Error("Artifact read canceled.")));
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
      setNotice(`Verifying ${file.name} in the local compiler worker.`);
      dispatchWorker(request, runRevision);
    } catch (error) {
      fileReaderRef.current = undefined;
      if (runRevision !== formRevisionRef.current) return;
      const message =
        error instanceof Error ? error.message : "The artifact file could not be read.";
      setFailure({ code: "ARTIFACT_READ_FAILED", message });
      markPhase("failure");
      setNotice("The artifact file could not be read.");
    }
  };

  const artifactText = success === undefined ? "" : jsonText(success.artifact);
  const reportText = report === undefined ? "" : jsonText(report);
  const preservationText =
    success === undefined
      ? "Preservation verification has not run."
      : [
          `PRESERVATION: ${success.verification.valid ? "VERIFIED" : "FAILED"}`,
          `Semantic round trip: ${success.verification.semanticRoundTrip}`,
          `Checksum: ${success.verification.checksum}`,
          `Dependencies: ${success.verification.dependencies}`,
          `Semantic digest: ${success.artifact.inputSemanticDigest}`,
          "",
          success.verification.valid
            ? "No semantic differences were detected after decoding the self-contained model bundle."
            : "The verifier found a mismatch. Inspect the error list in the artifact report.",
          success.source === "artifact-import"
            ? "The imported artifact does not contain a hidden original JSON copy. Verification binds its decoded value to the stored semantic digest."
            : "Original source whitespace, object display order, and escape spelling are outside the preservation contract.",
        ].join("\n");
  const outputByTab: Record<OutputTab, string> = {
    context: success?.renderedContext ?? "No selected model context is available.",
    artifact: artifactText || "No selected artifact is available.",
    restored: success?.restoredJson ?? "No decoded JSON is available.",
    report: reportText || "No explain report is available.",
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
            <p className="eyebrow">Model Optimized Representation for Prompt Handoffs</p>
            <h1 id="page-title">Structured context, compiled with receipts.</h1>
            <p className="hero-copy">
              MORPH turns one complete dataset into several reversible model-facing layouts,
              measures the text a model would actually receive, and explains every gate between a
              candidate and the selected plan.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#compiler">
                Open the workbench <span aria-hidden="true">↓</span>
              </a>
              <span>Local first · no account · no hidden model call</span>
            </div>
          </div>
          <figure className="hero-mark">
            <img src="/morph-mark.jpg" alt="" aria-hidden="true" />
            <figcaption>
              <span>morph-artifact/1</span>
              <span>morph-context/1</span>
              <span>lossless mode</span>
            </figcaption>
          </figure>
        </section>

        <DossierBeforeWorkbench />

        <div className="workspace-grid" id="compiler">
          <section className="control-panel" aria-labelledby="input-heading">
            <div className="panel-heading">
              <div>
                <span className="step-number">01</span>
                <div>
                  <p className="eyebrow">Compile request</p>
                  <h2 id="input-heading">Input and intent</h2>
                </div>
              </div>
              <span className="privacy-note">Stays in this tab</span>
            </div>

            <div className="artifact-import-row">
              <div>
                <strong>Open a saved artifact</strong>
                <span>Strictly parse, verify, render, and decode a local .morph.json file.</span>
              </div>
              <label className="button import-button" htmlFor="artifact-file-input">
                <span aria-hidden="true">↑</span>
                Import artifact
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
              <legend id="examples-label">Synthetic examples</legend>
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
                <span id="json-help">Numeric lexemes are preserved from this text.</span>
                {inputWarning === undefined ? null : (
                  <span id="json-warning" className="inline-warning" role="alert">
                    {inputWarning}
                  </span>
                )}
              </div>
            </div>

            <details className="schema-disclosure" open={form.schemaText.length > 0}>
              <summary>
                <span>Optional JSON Schema</span>
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
                  Included meaning is counted in every rendered candidate.
                </p>
              </div>
            </details>

            <div className="field-group">
              <label htmlFor="task-input">Task instruction</label>
              <textarea
                id="task-input"
                className="task-input"
                value={form.task}
                required
                onChange={(event) => updateForm("task", event.currentTarget.value)}
              />
              <p className="field-help">
                A hint for planning, not permission to remove data or execute a query.
              </p>
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="access-pattern">Access pattern</label>
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
              </div>
              <div className="field-group">
                <label htmlFor="target-profile">Target profile</label>
                <select id="target-profile" value={form.profileId} disabled>
                  <option value="local-o200k-base">local-o200k-base</option>
                </select>
                <p className="field-help">Exact text count. Model quality unbound.</p>
              </div>
              <div className="field-group">
                <label htmlFor="policy">Selection policy</label>
                <select
                  id="policy"
                  value={form.policy}
                  onChange={(event) =>
                    updateForm("policy", event.currentTarget.value as PlannerPolicy)
                  }
                >
                  <option value="compatibility">Compatibility</option>
                  <option value="economy-experimental">Economy experimental</option>
                  <option value="validated">Validated</option>
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="token-budget">Prompt token budget</label>
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
                <strong>Zero network calls</strong>
                <span>Worker compilation · bundled tokenizer · no storage</span>
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
                  <p className="eyebrow">Measured output</p>
                  <h2 id="results-heading">Comparison</h2>
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
                  {activeOperation === "artifact-import" ? "Artifact import" : "Compiler active"}
                </p>
                <h3>
                  {activeOperation === "artifact-import"
                    ? "Verifying the saved handoff."
                    : "Checking every finalist."}
                </h3>
                <p>
                  {activeOperation === "artifact-import"
                    ? "Strict parse, checksum, dependency, semantic round trip, render, and decode checks."
                    : "Encode, decode, frame, tokenize, then apply policy and budget gates."}
                </p>
              </div>
            ) : null}
            {failure !== undefined ? (
              <div className="error-card" role="alert">
                <div className="error-code">{failure.code}</div>
                <div>
                  <h3>The local operation did not produce a usable artifact.</h3>
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
                        {success?.source === "artifact-import" ? "Imported plan" : "Selected plan"}
                      </p>
                      <h3>
                        {selected.encoding} <span>v{selected.formatVersion}</span>
                      </h3>
                    </div>
                    <div className="selection-metric">
                      <strong>{selected.tokens?.count.toLocaleString() ?? "Unknown"}</strong>
                      <span>rendered tokens</span>
                    </div>
                    <p>{selected.reasonCodes.join(" · ")}</p>
                  </div>
                )}

                <CandidateTable report={report} />

                <div className="report-footer">
                  {resultDigest === undefined ? null : (
                    <div title={resultDigest}>
                      <span>request digest</span>
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
                    <h3>Measurement notes</h3>
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
                <p className="eyebrow">Inspect the handoff</p>
                <h2 id="artifact-heading">Artifact and reconstruction</h2>
              </div>
              <nav className="download-actions" aria-label="Artifact downloads">
                <button
                  type="button"
                  className="text-button"
                  disabled={success === undefined}
                  onClick={() => {
                    if (success !== undefined)
                      downloadText("morph.context.txt", success.renderedContext, "text/plain");
                  }}
                >
                  Context ↓
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
                  Artifact ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    downloadText("morph.comparison.json", reportText, "application/json")
                  }
                >
                  Report ↓
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
                  Restored ↓
                </button>
              </nav>
            </div>

            <div className="tab-bar" role="tablist" aria-label="Artifact views">
              {(
                [
                  ["context", "Model context"],
                  ["artifact", "Machine artifact"],
                  ["restored", "Decoded JSON"],
                  ["report", "Explain report"],
                  ["preservation", "Preservation diff"],
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
                        ? "No semantic differences"
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
                          ? "Semantic match verified"
                          : "Semantic match failed"}
                      </strong>
                      <p>{preservationText.split("\n").slice(5).join(" ")}</p>
                    </div>
                  </div>
                  <div className="diff-grid">
                    <div>
                      <span className="code-label">
                        {success.source === "artifact-import"
                          ? "Imported encoded payload"
                          : "Accepted source text"}
                      </span>
                      <pre>
                        {success.source === "artifact-import"
                          ? success.artifact.section.payload
                          : form.jsonText}
                      </pre>
                    </div>
                    <div>
                      <span className="code-label">Decoded JSON text</span>
                      <pre>{success.restoredJson}</pre>
                    </div>
                  </div>
                  <dl className="verification-list">
                    <div>
                      <dt>Semantic digest</dt>
                      <dd>{success.artifact.inputSemanticDigest}</dd>
                    </div>
                    <div>
                      <dt>Self-contained round trip</dt>
                      <dd>{success.verification.semanticRoundTrip}</dd>
                    </div>
                    <div>
                      <dt>Integrity checksum</dt>
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
          MORPH separates preservation, tokenizer measurement, and model comprehension. A smaller
          context is not automatically a better context.
        </p>
        <span>Network disabled · no analytics · no persistence</span>
      </footer>

      <div className="sr-status" role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
    </div>
  );
}
