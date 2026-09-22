import { describe, expect, it } from "vitest";
import {
  type EvaluationDatasetInput,
  type ModelEvaluationControls,
  type ModelEvaluator,
  prepareModelEvaluationCases,
  renderModelEvaluationReport,
  runModelEvaluation,
} from "./model-evaluation.js";

const benchmark = {
  benchmarkManifestVersion: "test-manifest/1",
  fixtureVersion: "test-fixtures/1",
  seed: 42,
} as const;

const corpus: readonly EvaluationDatasetInput[] = [
  {
    caseId: "customers-small",
    family: "uniform-tables",
    variant: "narrow-short-fields",
    size: "small",
    jsonText: '[{"id":"0001","value":1,"active":true},{"id":"0002","value":2,"active":false}]',
    tasks: [
      {
        taskId: "lookup",
        family: "single-record-lookup",
        instruction: "Return the complete record whose id is 0001.",
        accessPattern: "entity-lookup",
        expectedAnswer: { id: "0001", value: 1, active: true },
      },
    ],
  },
];

function callControls(overrides: Partial<ModelEvaluationControls> = {}): ModelEvaluationControls {
  return {
    providerId: "synthetic-test-provider",
    randomSeed: 91,
    maxRequests: 10,
    concurrency: 2,
    maxRetries: 0,
    maxOutputTokens: 32,
    requestTimeoutMs: 1_000,
    approvedCallCap: 10,
    ...overrides,
  };
}

describe("model evaluation preparation", () => {
  it("builds matched verified compact JSON and candidate trials", async () => {
    const prepared = await prepareModelEvaluationCases(corpus, ["rows-delimited"]);
    expect(prepared.exclusions).toEqual([]);
    expect(prepared.cases).toHaveLength(2);
    const roles = new Set(prepared.cases.map((item) => item.representationRole));
    expect(roles).toEqual(new Set(["baseline", "candidate"]));
    expect(new Set(prepared.cases.map((item) => item.pairId)).size).toBe(1);
    expect(prepared.cases.find((item) => item.representationRole === "baseline")?.encoding).toBe(
      "json-compact",
    );
    expect(prepared.cases.find((item) => item.representationRole === "candidate")?.encoding).toBe(
      "rows-delimited",
    );
    expect(prepared.cases.every((item) => item.promptTokens > 0)).toBe(true);
    expect(new Set(prepared.cases.map((item) => item.renderedContextDigest)).size).toBe(2);
  });
});

describe("bounded provider-neutral model evaluation", () => {
  it("defaults to an explicit not-run result when no evaluator is configured", async () => {
    const manifest = await runModelEvaluation({
      corpus,
      controls: callControls(),
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    expect(manifest.runStatus).toBe("not-run");
    expect(manifest.modelQuality).toBe("not-run");
    expect(manifest.evaluatorId).toBeNull();
    expect(manifest.denominators.providerRequests).toBe(0);
    expect(manifest.denominators.notRunTrials).toBe(2);
    expect(manifest.trials.every((item) => item.reasonCode === "PROVIDER_NOT_CONFIGURED")).toBe(
      true,
    );
  });

  it("randomizes reproducibly, limits concurrency, retries, and computes exact matches", async () => {
    let active = 0;
    let maximumActive = 0;
    const attempts = new Map<string, number>();
    const evaluator: ModelEvaluator = {
      id: "synthetic-evaluator",
      async evaluate(item) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        const count = (attempts.get(item.trialId) ?? 0) + 1;
        attempts.set(item.trialId, count);
        if (count === 1) {
          return { status: "failed", errorCode: "TRANSIENT", retryable: true };
        }
        return {
          status: "completed",
          output: item.expectedAnswer,
          validOutput: true,
          providerModelId: "synthetic-model",
          providerModelRevision: "1",
          usage: { inputTokens: item.promptTokens, outputTokens: 4 },
          finishReason: "stop",
        };
      },
    };
    const controls = callControls({ maxRetries: 1, approvedCallCap: 4, maxRequests: 4 });
    const first = await runModelEvaluation({
      corpus,
      evaluator,
      controls,
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    expect(first.runStatus).toBe("complete");
    expect(first.denominators.providerRequests).toBe(4);
    expect(first.denominators.retries).toBe(2);
    expect(first.denominators.exactMatches).toBe(2);
    expect(first.denominators.accuracyDenominator).toBe(2);
    expect(maximumActive).toBeLessThanOrEqual(2);
    expect(first.trials.every((item) => item.output === undefined)).toBe(true);

    const immediateEvaluator: ModelEvaluator = {
      id: "immediate",
      async evaluate(item) {
        return { status: "completed", output: item.expectedAnswer };
      },
    };
    const repeat = await runModelEvaluation({
      corpus,
      evaluator: immediateEvaluator,
      controls: callControls({ randomSeed: controls.randomSeed }),
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    expect(repeat.randomizedTrialOrder).toEqual(first.randomizedTrialOrder);
  });

  it("keeps refusals and truncations in the declared accuracy denominator", async () => {
    const evaluator: ModelEvaluator = {
      id: "outcome-evaluator",
      async evaluate(item) {
        return item.representationRole === "baseline"
          ? { status: "refused", refusalCode: "POLICY" }
          : { status: "truncated", finishReason: "length" };
      },
    };
    const manifest = await runModelEvaluation({
      corpus,
      evaluator,
      controls: callControls(),
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    expect(manifest.denominators.refusedTrials).toBe(1);
    expect(manifest.denominators.truncatedTrials).toBe(1);
    expect(manifest.denominators.accuracyDenominator).toBe(2);
    expect(manifest.denominators.exactMatches).toBe(0);
    expect(
      manifest.aggregates.find((row) => row.dimension === "encoding" && row.key === "json-compact")
        ?.exactMatchRate,
    ).toBe(0);
  });

  it("stops before the priced worst-case reservation would exceed the cost cap", async () => {
    let calls = 0;
    const evaluator: ModelEvaluator = {
      id: "priced-evaluator",
      async evaluate(item) {
        calls += 1;
        return {
          status: "completed",
          output: item.expectedAnswer,
          usage: { inputTokens: item.promptTokens, outputTokens: 1 },
        };
      },
    };
    const manifest = await runModelEvaluation({
      corpus,
      evaluator,
      controls: {
        providerId: "priced-provider",
        randomSeed: 1,
        maxRequests: 10,
        concurrency: 2,
        maxRetries: 0,
        maxOutputTokens: 1,
        requestTimeoutMs: 1_000,
        maxCost: 1.5,
        pricingProfile: {
          profileId: "test-prices",
          revision: "1",
          currency: "USD",
          inputPerMillionTokens: 0,
          outputPerMillionTokens: 1_000_000,
          maximumInputOverheadTokens: 0,
        },
      },
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    expect(calls).toBe(1);
    expect(manifest.runStatus).toBe("partial");
    expect(manifest.denominators.providerRequests).toBe(1);
    expect(manifest.denominators.notRunTrials).toBe(1);
    expect(manifest.cost?.amount).toBe(1);
    expect(manifest.cost?.basis).toBe("provider-usage");
  });

  it("rejects missing or ambiguous paid-execution limits before any call", async () => {
    const { approvedCallCap: _approvedCallCap, ...controlsWithoutLimit } = callControls();
    await expect(
      runModelEvaluation({
        corpus,
        controls: controlsWithoutLimit,
        candidateEncodings: ["rows-delimited"],
        benchmark,
      }),
    ).rejects.toThrow("exactly one paid-execution limit");
    await expect(
      runModelEvaluation({
        corpus,
        controls: {
          ...callControls(),
          maxCost: 1,
          pricingProfile: {
            profileId: "prices",
            revision: "1",
            currency: "USD",
            inputPerMillionTokens: 1,
            outputPerMillionTokens: 1,
            maximumInputOverheadTokens: 0,
          },
        },
        candidateEncodings: ["rows-delimited"],
        benchmark,
      }),
    ).rejects.toThrow("exactly one paid-execution limit");
  });

  it("renders a report with provenance and all outcome denominators", async () => {
    const manifest = await runModelEvaluation({
      corpus,
      controls: callControls(),
      candidateEncodings: ["rows-delimited"],
      benchmark,
    });
    const report = renderModelEvaluationReport(manifest);
    expect(report).toContain("Benchmark manifest: test-manifest/1");
    expect(report).toContain("Planned trials: 2");
    expect(report).toContain("Refusals: 0");
    expect(report).toContain("Model quality: not-run");
  });
});
