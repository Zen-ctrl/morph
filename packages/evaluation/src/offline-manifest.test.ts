import { describe, expect, it } from "vitest";
import { runOfflineConformance, runOfflineTokenSuite } from "./index.js";

const benchmark = {
  benchmarkManifestVersion: "test-offline-manifest/1",
  fixtureVersion: "test-fixture/1",
  seed: 123,
} as const;

describe("offline evidence manifests", () => {
  it("records provenance, settings, and explicit conformance denominators", async () => {
    const result = await runOfflineConformance(
      ["fixtures/conformance/tiny.json"],
      process.cwd(),
      benchmark,
    );
    expect(result.provenance.benchmark).toEqual(benchmark);
    expect(result.provenance.fixtureSetDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.provenance.environment.node).toBe(process.versions.node);
    expect(result.settings.network).toBe("disabled");
    expect(result.denominators.fixtures).toBe(1);
    expect(result.denominators.candidatePlans).toBeGreaterThan(0);
    expect(result.denominators.endToEndCases).toBe(1);
    expect(result.total).toBe(
      result.denominators.candidatePlans + result.denominators.endToEndCases,
    );
  });

  it("records complete-render counting settings and token denominators", async () => {
    const result = await runOfflineTokenSuite(
      ["fixtures/conformance/tiny.json"],
      process.cwd(),
      benchmark,
    );
    expect(result.provenance.benchmark.fixtureVersion).toBe("test-fixture/1");
    expect(result.settings.countingScope).toBe("complete-rendered-text");
    expect(result.denominators.fixtures).toBe(1);
    expect(result.denominators.candidateRows).toBe(result.rows.length);
    expect(result.denominators.measuredRows).toBe(result.rows.length);
  });
});
