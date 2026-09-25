import { evaluatePairedNoninferiority } from "@morph/evaluation";
import { describe, expect, it } from "vitest";

const config = {
  allowedRegression: 0.05,
  confidenceLevel: 0.95,
  bootstrapSamples: 1_000,
  seed: 20_260_921,
  minimumUniqueCases: 6,
  minimumIndependentDatasets: 3,
} as const;

describe("paired dataset-clustered quality evidence", () => {
  it("is deterministic and does not count repeated cases as independent datasets", () => {
    const records = [
      { caseId: "a1", datasetId: "a", baselineCorrect: true, candidateCorrect: true },
      { caseId: "a2", datasetId: "a", baselineCorrect: false, candidateCorrect: true },
      { caseId: "b1", datasetId: "b", baselineCorrect: true, candidateCorrect: true },
      { caseId: "b2", datasetId: "b", baselineCorrect: true, candidateCorrect: true },
      { caseId: "c1", datasetId: "c", baselineCorrect: false, candidateCorrect: true },
      { caseId: "c2", datasetId: "c", baselineCorrect: true, candidateCorrect: true },
    ];
    const first = evaluatePairedNoninferiority(records, config);
    const second = evaluatePairedNoninferiority(records, config);
    expect(first).toEqual(second);
    expect(first.independentDatasetCount).toBe(3);
    expect(first.uniqueCaseCount).toBe(6);
    expect(first.status).toBe("qualified");
  });

  it("labels an undersized smoke test insufficient", () => {
    const result = evaluatePairedNoninferiority(
      [{ caseId: "one", datasetId: "only", baselineCorrect: true, candidateCorrect: true }],
      config,
    );
    expect(result.status).toBe("insufficient");
  });
});
