import type { CandidateReport, ExplainReport, VerificationReport } from "@morph/core";
import { describe, expect, it } from "vitest";
import { WORKBENCH_EXAMPLES } from "./examples.js";
import { formatBytes, formatSavings, summarizeOutcomes } from "./workbench.js";

const candidate: CandidateReport = {
  planId: "json-compact@1:test",
  encoding: "json-compact",
  formatVersion: "1",
  options: {},
  selected: true,
  applicable: true,
  roundTrip: "passed",
  dependencies: "complete",
  tokens: {
    count: 42,
    tokenizerId: "o200k_base",
    tokenizerRevision: "fixture",
    textDigest: "digest",
    scope: "rendered-text",
    certainty: "exact-for-tokenizer",
    assumptions: [],
  },
  savingsTokens: 0,
  savingsFraction: 0,
  quality: { status: "unknown", baselineEncoding: "json-compact" },
  eligible: true,
  reasonCodes: ["BASELINE_COMPATIBILITY"],
};

const report: ExplainReport = {
  reportVersion: "morph-explain/1",
  completedSearch: true,
  baselinePlanId: candidate.planId,
  selectedPlanId: candidate.planId,
  policy: "compatibility",
  candidates: [candidate],
  warnings: [],
  resourceSummary: {},
};

const verification: VerificationReport = {
  valid: true,
  checksum: "passed",
  dependencies: "complete",
  semanticRoundTrip: "passed",
  errors: [],
};

describe("workbench result labels", () => {
  it("keeps preservation, token measurement, and model comprehension distinct", () => {
    expect(summarizeOutcomes("compatibility", report, verification)).toEqual([
      expect.objectContaining({ label: "Data preservation", value: "Verified" }),
      expect.objectContaining({ label: "Token measurement", value: "Exact text" }),
      expect.objectContaining({ label: "Model comprehension", value: "Untested" }),
      expect.objectContaining({ label: "Selection policy", value: "Compatibility" }),
    ]);
  });

  it("does not hide negative savings", () => {
    expect(formatSavings({ ...candidate, savingsTokens: -18, savingsFraction: -0.125 })).toBe(
      "-18 (-12.5%)",
    );
  });
});

describe("workbench fixtures", () => {
  it("ships all six required synthetic example families", () => {
    expect(WORKBENCH_EXAMPLES.map((example) => example.id)).toEqual([
      "uniform-table",
      "nested-data",
      "sparse-objects",
      "repeated-strings",
      "multilingual",
      "tiny-json",
    ]);
  });

  it("formats input sizes without calling them tokens", () => {
    expect(formatBytes(12)).toBe("12 B");
    expect(formatBytes(2_048)).toBe("2.0 KiB");
  });
});
