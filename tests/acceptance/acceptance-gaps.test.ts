import {
  canonicalJsonText,
  createMorph,
  type MorphRequest,
  parseArtifactJson,
  parseJsonStrict,
  type QualityProfile,
  semanticEqual,
  sha256Text,
  type TargetProfile,
} from "@morph/core";
import { builtInEncoders, rowsDelimitedEncoder } from "@morph/encoders";
import { localO200kBaseProfile, localO200kBaseTokenizer } from "@morph/tokenizer-adapters";
import { describe, expect, it } from "vitest";

const morph = createMorph({
  encoders: builtInEncoders,
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});

function request(text: string, overrides: Partial<MorphRequest> = {}): MorphRequest {
  return {
    data: { kind: "json-text", text },
    task: { instruction: "Inspect every value.", accessPattern: "unknown" },
    target: localO200kBaseProfile,
    constraints: { mode: "lossless", allowNetwork: false },
    planner: { policy: "compatibility", objective: "prompt-tokens" },
    ...overrides,
  };
}

describe("offline acceptance gaps", () => {
  it.each([
    {
      name: "input bytes",
      text: '{"value":"too large"}',
      constraints: { mode: "lossless", maxInputBytes: 4 } as const,
      code: "MAX_INPUT_BYTES_EXCEEDED",
    },
    {
      name: "nesting depth",
      text: "[[[0]]]",
      constraints: { mode: "lossless", maxDepth: 2 } as const,
      code: "MAX_DEPTH_EXCEEDED",
    },
    {
      name: "node count",
      text: "[1,2,3]",
      constraints: { mode: "lossless", maxNodes: 3 } as const,
      code: "MAX_NODES_EXCEEDED",
    },
  ])(
    "A24 returns a typed compile failure for the $name limit",
    async ({ text, constraints, code }) => {
      const result = await morph.compile(request(text, { constraints }));
      expect(result).toMatchObject({ ok: false, error: { code } });
    },
  );

  it("bounds candidate evaluation deterministically and reports every pruned plan", async () => {
    const result = await morph.compile(
      request('[{"id":"a","value":1},{"id":"b","value":2}]', {
        constraints: { mode: "lossless", maxCandidates: 1 },
        planner: { policy: "economy-experimental", objective: "prompt-tokens" },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.encoding).toBe("json-compact");
    expect(result.report.completedSearch).toBe(true);
    expect(result.report.resourceSummary).toMatchObject({
      candidatesEvaluated: 1,
      candidatesPruned: 7,
    });
    const pruned = result.report.candidates.filter((candidate) =>
      candidate.reasonCodes.includes("CANDIDATE_LIMIT_PRUNED"),
    );
    expect(pruned).toHaveLength(7);
    expect(pruned.every((candidate) => candidate.roundTrip === "not-run")).toBe(true);
  });

  it("A07 preserves absent, null, false, and empty-string states from the rendered bundle", async () => {
    const source =
      '[{"id":"present-null","state":null,"flag":false,"text":""},{"id":"absent","flag":false,"text":""}]';
    const result = await morph.compile(
      request(source, {
        task: {
          instruction: "Distinguish every state.",
          accessPattern: "filtering",
          relevantPaths: ["/0/state", "/1/state"],
        },
        planner: {
          policy: "economy-experimental",
          objective: "prompt-tokens",
          forcedEncoding: "path-value",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.encoding).toBe("path-value");
    expect(morph.verify(result.artifact)).toMatchObject({
      valid: true,
      dependencies: "complete",
      semanticRoundTrip: "passed",
    });
    expect(
      semanticEqual(parseJsonStrict(morph.decodeJson(result.artifact)), parseJsonStrict(source)),
    ).toBe(true);
    expect(
      result.report.candidates
        .filter(
          (candidate) =>
            candidate.encoding === "rows-delimited" || candidate.encoding === "columns-json",
        )
        .every((candidate) => candidate.reasonCodes.includes("ENCODER_NOT_APPLICABLE")),
    ).toBe(true);
  });

  it("A16 keeps compact JSON as the measured winner when guide overhead dominates a tiny value", async () => {
    const result = await morph.compile(
      request("null", {
        planner: { policy: "economy-experimental", objective: "prompt-tokens" },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const baseline = result.report.candidates.find(
      (candidate) => candidate.encoding === "json-compact",
    );
    const pathValue = result.report.candidates.find(
      (candidate) => candidate.encoding === "path-value",
    );
    expect(result.artifact.plan.encoding).toBe("json-compact");
    expect(baseline?.selected).toBe(true);
    expect(baseline?.tokens?.certainty).toBe("exact-for-tokenizer");
    expect(pathValue?.tokens?.count).toBeGreaterThan(
      baseline?.tokens?.count ?? Number.MAX_SAFE_INTEGER,
    );
    expect(pathValue?.savingsTokens).toBeLessThan(0);
  });

  it("rejects a hostile imported artifact with duplicate envelope keys before overwrite", async () => {
    const result = await morph.compile(request('{"value":1}'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const artifactText = JSON.stringify(result.artifact);
    const duplicateKeyText = artifactText.replace(
      '"artifactId":',
      '"artifactId":"attacker-controlled","artifactId":',
    );
    expect(duplicateKeyText).not.toBe(artifactText);
    expect(() => parseArtifactJson(duplicateKeyText)).toThrow(/duplicate/i);
  });

  it.each([
    ["wrong model revision", { modelRevision: "fixture-model-v2", guideVersion: undefined }],
    ["wrong guide version", { modelRevision: undefined, guideVersion: "rows-delimited/999" }],
  ] as const)(
    "A27 rejects otherwise qualified synthetic evidence with a %s",
    async (_name, mismatch) => {
      const source = '[{"id":"a","value":1},{"id":"b","value":2}]';
      const ir = parseJsonStrict(source);
      const rowPlan = rowsDelimitedEncoder.enumerate(ir, { instruction: "Read all rows." })[0];
      if (rowPlan === undefined)
        throw new Error("The rows-delimited fixture plan was not generated.");
      const target: TargetProfile = {
        ...localO200kBaseProfile,
        profileId: "synthetic-bound-target",
        modelId: "fixture-model",
        modelRevision: "fixture-model-v1",
      };
      const profileId = `synthetic-mismatch-${mismatch.modelRevision ?? mismatch.guideVersion}`;
      const profile: QualityProfile = {
        profileId,
        encoding: rowsDelimitedEncoder.id,
        formatVersion: rowsDelimitedEncoder.formatVersion,
        targetProfileId: target.profileId,
        tokenizerId: target.tokenizerId,
        tokenizerRevision: target.tokenizerRevision,
        modelId: target.modelId as string,
        modelRevision: mismatch.modelRevision ?? (target.modelRevision as string),
        guideVersion: mismatch.guideVersion ?? rowsDelimitedEncoder.interpretationGuideVersion,
        rendererVersion: "morph-prompt/1",
        planOptionsDigest: sha256Text(canonicalJsonText(rowPlan.options)),
        taskFamily: "unknown",
        benchmarkProvenance: "Synthetic negative acceptance fixture. Not live evidence.",
        datasetCharacteristics: { fixture: "uniform-two-row-table" },
        answerSchemaDigest: "a".repeat(64),
        evaluationMetric: "binary correctness",
        allowedRegression: 0.05,
        evidence: {
          status: "qualified",
          profileId,
          taskFamily: "unknown",
          baselineEncoding: "json-compact",
          pairedAccuracyDelta: 0,
          lowerConfidenceBound: -0.01,
          upperConfidenceBound: 0.01,
          uniqueCaseCount: 30,
          independentDatasetCount: 3,
          evidenceDigest: "b".repeat(64),
        },
        expiresAt: "2099-01-01T00:00:00.000Z",
      };
      const validatedMorph = createMorph({
        encoders: builtInEncoders,
        tokenizers: [localO200kBaseTokenizer],
        targetProfiles: [target],
        qualityProfiles: [profile],
      });
      const result = await validatedMorph.compile({
        ...request(source),
        target,
        planner: {
          policy: "validated",
          objective: "prompt-tokens",
          forcedEncoding: "rows-delimited",
          qualityProfileId: profileId,
        },
      });

      expect(result).toMatchObject({ ok: false, error: { code: "NO_ELIGIBLE_PLAN" } });
      if (!result.ok) {
        const rowCandidates = result.report?.candidates.filter(
          (candidate) => candidate.encoding === "rows-delimited",
        );
        expect(rowCandidates).not.toHaveLength(0);
        expect(
          rowCandidates?.every((candidate) =>
            candidate.reasonCodes.includes("QUALITY_PROFILE_MISMATCH"),
          ),
        ).toBe(true);
      }
    },
  );

  it("A32 leaves caller-owned provider tool and output schemas outside compilation", async () => {
    const providerToolSchema = Object.freeze({
      name: "lookup_account_fixture",
      description: "Provider-owned integration fixture",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({ accountId: Object.freeze({ type: "string" }) }),
        required: Object.freeze(["accountId"]),
      }),
    });
    const providerOutputSchema = Object.freeze({
      type: "object",
      properties: Object.freeze({ answer: Object.freeze({ type: "string" }) }),
      required: Object.freeze(["answer"]),
      additionalProperties: false,
    });
    const toolSnapshot = canonicalJsonText(providerToolSchema);
    const outputSnapshot = canonicalJsonText(providerOutputSchema);

    const compileResult = await morph.compile(
      request('{"accountId":"acct-01","balance":12}', {
        task: { instruction: "Prepare the complete data block for the provider call." },
      }),
    );

    expect(compileResult.ok).toBe(true);
    expect(canonicalJsonText(providerToolSchema)).toBe(toolSnapshot);
    expect(canonicalJsonText(providerOutputSchema)).toBe(outputSnapshot);
    if (!compileResult.ok) return;
    const rendered = morph.renderModelContext(compileResult.artifact).rendered;
    expect(rendered).not.toContain("lookup_account_fixture");
    expect(rendered).not.toContain("Provider-owned integration fixture");
  });
});
