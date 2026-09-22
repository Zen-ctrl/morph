/// <reference lib="webworker" />

import {
  type CandidateReport,
  createMorph,
  type ExplainReport,
  type MorphArtifact,
  type MorphError,
  type MorphRequest,
  parseArtifactJson,
  parseJsonStrict,
  printJson,
  toMorphError,
  type VerificationReport,
} from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import {
  builtInTargetProfiles,
  builtInTokenizers,
  localO200kBaseProfile,
} from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";
import type { CompileWorkerResponse, WorkbenchWorkerRequest } from "./protocol.js";

const compiler = createMorph({
  encoders: [...builtInEncoders, toonEncoder],
  tokenizers: builtInTokenizers,
  targetProfiles: builtInTargetProfiles,
});

function parseSchema(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  return JSON.parse(printJson(parseJsonStrict(trimmed))) as unknown;
}

function errorFromUnknown(error: unknown): MorphError {
  return toMorphError(error, "WORKER_FAILURE");
}

function importedArtifactReport(
  artifact: MorphArtifact,
  rendered: string,
  renderedDigest: string,
  verification: VerificationReport,
): ExplainReport {
  const planId = `${artifact.plan.encoding}@${artifact.plan.formatVersion}:imported-${artifact.artifactId.slice(0, 12)}`;
  const tokenizer = builtInTokenizers.find(
    (candidate) =>
      candidate.id === artifact.target.tokenizerId &&
      candidate.revision === artifact.target.tokenizerRevision,
  );
  const tokens =
    tokenizer === undefined
      ? undefined
      : {
          count: tokenizer.countText(rendered),
          tokenizerId: tokenizer.id,
          tokenizerRevision: tokenizer.revision,
          textDigest: renderedDigest,
          scope: "rendered-text" as const,
          certainty: "exact-for-tokenizer" as const,
          assumptions: [
            "Counts the complete visible MORPH-PROMPT/1 text from the imported artifact.",
            "Provider request framing, hidden instructions, tools, images, and outputs are excluded.",
          ],
        };
  const candidate: CandidateReport = {
    planId,
    encoding: artifact.plan.encoding,
    formatVersion: artifact.plan.formatVersion,
    options: artifact.plan.options,
    selected: verification.valid,
    applicable: true,
    roundTrip: verification.semanticRoundTrip,
    dependencies: verification.dependencies,
    ...(tokens === undefined ? {} : { tokens }),
    quality: { status: "unknown", baselineEncoding: "json-compact" },
    eligible: verification.valid,
    reasonCodes: verification.valid
      ? ["IMPORTED_ARTIFACT_VERIFIED"]
      : verification.errors.map((error) => error.code),
  };
  return {
    reportVersion: "morph-explain/1",
    completedSearch: false,
    baselinePlanId:
      artifact.plan.encoding === "json-compact" ? planId : "json-compact@1:not-evaluated",
    ...(verification.valid ? { selectedPlanId: planId } : {}),
    policy: artifact.plan.plannerPolicy,
    candidates: [candidate],
    warnings: [
      "This report verifies one imported artifact. It does not repeat candidate generation or selection.",
      ...(tokenizer === undefined
        ? [
            "The imported target tokenizer revision is unavailable, so token measurement was not run.",
          ]
        : ["Token count is exact for the imported artifact's selected text tokenizer only."]),
      "Downstream model comprehension remains untested unless separate matching evidence exists.",
    ],
    resourceSummary: {
      candidatesEvaluated: 1,
      payloadBytes: new TextEncoder().encode(artifact.section.payload).byteLength,
      renderedBytes: new TextEncoder().encode(rendered).byteLength,
    },
  };
}

function postFailure(message: WorkbenchWorkerRequest, error: MorphError): void {
  const response: CompileWorkerResponse = {
    kind: "result",
    requestId: message.requestId,
    requestDigest: message.requestDigest,
    ok: false,
    result: { error },
  };
  self.postMessage(response);
}

self.addEventListener("message", (event: MessageEvent<WorkbenchWorkerRequest>) => {
  const message = event.data;
  void (async () => {
    try {
      if (message.kind === "import-artifact") {
        const artifact = parseArtifactJson(message.artifactText);
        const verification = compiler.verify(artifact);
        if (!verification.valid) {
          postFailure(
            message,
            verification.errors[0] ?? {
              code: "ARTIFACT_INVALID",
              message: "The imported artifact did not pass verification.",
            },
          );
          return;
        }
        const modelContext = compiler.renderModelContext(artifact);
        const restoredJson = compiler.decodeJson(artifact);
        const report = importedArtifactReport(
          artifact,
          modelContext.rendered,
          modelContext.renderedDigest,
          verification,
        );
        const response: CompileWorkerResponse = {
          kind: "result",
          requestId: message.requestId,
          requestDigest: message.requestDigest,
          ok: true,
          result: {
            source: "artifact-import",
            artifact,
            report,
            renderedContext: modelContext.rendered,
            restoredJson,
            verification,
          },
        };
        self.postMessage(response);
        return;
      }

      const schema = parseSchema(message.input.schemaText);
      const request: MorphRequest = {
        data: { kind: "json-text", text: message.input.jsonText },
        ...(schema === undefined ? {} : { schema }),
        task: {
          instruction: message.input.task,
          accessPattern: message.input.accessPattern,
          preserveReadableLabels: true,
        },
        target: localO200kBaseProfile,
        constraints: {
          mode: "lossless",
          ...(message.input.maxPromptTokens === undefined
            ? {}
            : { maxPromptTokens: message.input.maxPromptTokens }),
          allowNetwork: false,
        },
        planner: {
          policy: message.input.policy,
          objective: "prompt-tokens",
        },
        context: { prefix: "", suffix: "" },
      };
      const compiled = await compiler.compile(request);
      if (!compiled.ok) {
        const response: CompileWorkerResponse = {
          kind: "result",
          requestId: message.requestId,
          requestDigest: message.requestDigest,
          ok: false,
          result: {
            error: compiled.error,
            ...(compiled.report === undefined ? {} : { report: compiled.report }),
          },
        };
        self.postMessage(response);
        return;
      }
      const verification = compiler.verify(compiled.artifact);
      const renderedContext = compiler.renderModelContext(compiled.artifact).rendered;
      const restoredJson = compiler.decodeJson(compiled.artifact);
      const response: CompileWorkerResponse = {
        kind: "result",
        requestId: message.requestId,
        requestDigest: message.requestDigest,
        ok: true,
        result: {
          source: "compile",
          artifact: compiled.artifact,
          report: compiled.report,
          renderedContext,
          restoredJson,
          verification,
        },
      };
      self.postMessage(response);
    } catch (error) {
      postFailure(message, errorFromUnknown(error));
    }
  })();
});
