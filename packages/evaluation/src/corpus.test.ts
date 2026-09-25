import { describe, expect, it } from "vitest";
import { generateSyntheticCorpus } from "./index.js";

describe("synthetic evaluation corpus", () => {
  it("covers every required family and size stratum", () => {
    const corpus = generateSyntheticCorpus(1234);
    expect(new Set(corpus.map((item) => item.family))).toEqual(
      new Set([
        "uniform-tables",
        "nested-trees",
        "sparse-records",
        "repeated-categories",
        "identifier-heavy-data",
        "numeric-edge-cases",
        "unicode-and-escaping",
        "sequence-sensitive-data",
        "tiny-payloads",
        "adversarial-content",
      ]),
    );
    for (const family of new Set(corpus.map((item) => item.family))) {
      expect(
        new Set(corpus.filter((item) => item.family === family).map((item) => item.size)),
      ).toEqual(new Set(["small", "medium", "large"]));
    }
  });

  it("includes narrow, wide, short-name, long-name, and comparison table cases", () => {
    const tables = generateSyntheticCorpus(12).filter((item) => item.family === "uniform-tables");
    expect(new Set(tables.map((item) => item.variant))).toEqual(
      new Set([
        "narrow-short-fields",
        "narrow-long-fields",
        "wide-short-fields",
        "wide-long-fields",
      ]),
    );
    expect(tables).toHaveLength(12);
    expect(
      tables.every((item) => item.tasks.some((task) => task.family === "cross-record-comparison")),
    ).toBe(true);
  });

  it("includes small, large, and low-repetition category dictionaries", () => {
    const repeated = generateSyntheticCorpus(77).filter(
      (item) => item.family === "repeated-categories",
    );
    expect(new Set(repeated.map((item) => item.variant))).toEqual(
      new Set(["small-dictionary", "large-dictionary", "low-repetition"]),
    );
    expect(repeated).toHaveLength(9);
  });

  it("is deterministic for a fixed seed and separates case identities across seeds", () => {
    expect(generateSyntheticCorpus(10)).toEqual(generateSyntheticCorpus(10));
    expect(generateSyntheticCorpus(10).map((item) => item.caseId)).not.toEqual(
      generateSyntheticCorpus(11).map((item) => item.caseId),
    );
  });
});
