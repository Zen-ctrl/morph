import {
  canonicalJsonText,
  createArtifact,
  createMorph,
  MorphException,
  type MorphRequest,
  parseJsonStrict,
  type QualityProfile,
  semanticEqual,
  sha256Text,
} from "@morph/core";
import { builtInEncoders, rowsDelimitedEncoder } from "@morph/encoders";
import { localO200kBaseProfile, localO200kBaseTokenizer } from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";
import { describe, expect, it } from "vitest";

const morph = createMorph({
  encoders: [...builtInEncoders, toonEncoder],
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});

function request(text: string, overrides: Partial<MorphRequest> = {}): MorphRequest {
  return {
    data: { kind: "json-text", text },
    task: { instruction: "Use every record.", accessPattern: "unknown" },
    target: localO200kBaseProfile,
    constraints: { mode: "lossless", allowNetwork: false },
    planner: { policy: "compatibility", objective: "prompt-tokens" },
    ...overrides,
  };
}

describe("compiler integration", () => {
  it("defaults to compact JSON when nonbaseline quality is unknown", async () => {
    const result = await morph.compile(request('[{"id":"a","value":1},{"id":"b","value":2}]'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.encoding).toBe("json-compact");
    expect(
      result.report.candidates.some((candidate) =>
        candidate.reasonCodes.includes("QUALITY_UNKNOWN"),
      ),
    ).toBe(true);
    expect(
      result.report.candidates.every((candidate) => candidate.quality.status === "unknown"),
    ).toBe(true);
    expect(morph.verify(result.artifact)).toMatchObject({
      valid: true,
      semanticRoundTrip: "passed",
    });
  });

  it("can force a reversible native format only in experimental policy", async () => {
    const result = await morph.compile(
      request('[{"id":"a","value":1},{"id":"b","value":2}]', {
        planner: {
          policy: "economy-experimental",
          objective: "prompt-tokens",
          forcedEncoding: "rows-delimited",
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.encoding).toBe("rows-delimited");
    expect(result.report.candidates.find((candidate) => candidate.selected)?.reasonCodes).toContain(
      "CALLER_FORCED_ENCODING",
    );
    expect(
      semanticEqual(
        parseJsonStrict(morph.decodeJson(result.artifact)),
        parseJsonStrict('[{"id":"a","value":1},{"id":"b","value":2}]'),
      ),
    ).toBe(true);
  });

  it("measures complete rendered text and binds its digest", async () => {
    const result = await morph.compile(
      request('{"a":1}', {
        context: { prefix: "prefix", suffix: "suffix" },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          description: "Unit meaning",
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const context = morph.renderModelContext(result.artifact);
    const measurement = result.report.candidates.find((candidate) => candidate.selected)?.tokens;
    expect(measurement?.textDigest).toBe(context.renderedDigest);
    expect(measurement?.count).toBe(localO200kBaseTokenizer.countText(context.rendered));
    expect(context.rendered).toContain("Unit meaning");
  });

  it("returns BUDGET_EXCEEDED rather than truncating", async () => {
    const result = await morph.compile(
      request('{"large":"This value cannot fit a one-token prompt."}', {
        constraints: { mode: "lossless", maxPromptTokens: 1 },
        planner: { policy: "economy-experimental", objective: "prompt-tokens" },
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "BUDGET_EXCEEDED" } });
    if (!result.ok) {
      expect(result.error.details?.smallestVerifiedCount).toBeGreaterThan(1);
    }
  });

  it("does not silently restore JSON when an explicit allowed set excludes it", async () => {
    const result = await morph.compile(
      request("true", {
        planner: {
          policy: "validated",
          objective: "prompt-tokens",
          allowedEncodings: ["path-value"],
        },
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "NO_ELIGIBLE_PLAN" } });
  });

  it("rejects unknown target and tokenizer bindings", async () => {
    const result = await morph.compile(
      request("null", {
        target: { ...localO200kBaseProfile, profileId: "unknown" },
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_TARGET_PROFILE" } });

    const missingTokenizerMorph = createMorph({
      encoders: builtInEncoders,
      tokenizers: [],
      targetProfiles: [localO200kBaseProfile],
    });
    const missingTokenizer = await missingTokenizerMorph.compile(request("null"));
    expect(missingTokenizer).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_TOKENIZER_BINDING" },
    });
  });

  it("returns an explicit incomplete timeout instead of an arbitrary partial winner", async () => {
    const result = await morph.compile(
      request('[{"a":1},{"a":2}]', {
        constraints: { mode: "lossless", maxPlanningMs: 0 },
        planner: { policy: "economy-experimental", objective: "prompt-tokens" },
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "PLANNING_TIMEOUT" },
      report: { completedSearch: false },
    });
  });

  it("uses the concatenated full render count rather than adding component counts", () => {
    const separate =
      localO200kBaseTokenizer.countText("a") + localO200kBaseTokenizer.countText("b");
    const combined = localO200kBaseTokenizer.countText("ab");
    expect(combined).not.toBe(separate);
  });

  it("is deterministic across repeated compiles", async () => {
    const input = request('[{"id":"01","name":"Mina"},{"id":"02","name":"Ada"}]', {
      planner: { policy: "economy-experimental", objective: "prompt-tokens" },
    });
    const first = await morph.compile(input);
    const second = await morph.compile(input);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.artifact).toEqual(second.artifact);
    expect(morph.renderModelContext(first.artifact).rendered).toBe(
      morph.renderModelContext(second.artifact).rendered,
    );
  });

  it("keeps complete data when task hints differ", async () => {
    const text = '[{"id":"a","country":"US","revenue":5,"privateNote":"keep"}]';
    for (const accessPattern of ["entity-lookup", "multi-entity-comparison"] as const) {
      const result = await morph.compile(
        request(text, {
          task: {
            instruction: "Use the requested access pattern.",
            accessPattern,
            relevantPaths: ["/revenue"],
          },
          planner: { policy: "economy-experimental", objective: "prompt-tokens" },
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(morph.decodeJson(result.artifact)).toContain("privateNote");
    }
  });

  it("detects tampered payloads before decode", async () => {
    const result = await morph.compile(request('{"a":1}'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tampered = {
      ...result.artifact,
      section: { ...result.artifact.section, payload: '{"a":2}' },
    };
    expect(morph.verify(tampered)).toMatchObject({ valid: false, checksum: "failed" });
    expect(() => morph.decode(tampered)).toThrowError(MorphException);
  });

  it("returns a typed result for malformed runtime requests", async () => {
    const result = await morph.compile({} as MorphRequest);
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    const lossy = await morph.compile(
      request("null", {
        constraints: { mode: "lossy" } as unknown as MorphRequest["constraints"],
      }),
    );
    expect(lossy).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });

  it("rejects substituted trusted guides and unknown codecs before rendering", async () => {
    const result = await morph.compile(request('{"a":1}'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ir = morph.decode(result.artifact);
    const substituted = createArtifact({
      ir,
      plan: result.artifact.plan,
      section: result.artifact.section,
      plannerPolicy: result.artifact.plan.plannerPolicy,
      target: result.artifact.target,
      task: result.artifact.requestFrame.task,
      prefix: result.artifact.requestFrame.prefix,
      suffix: result.artifact.requestFrame.suffix,
      guideId: result.artifact.modelDependencies.interpretationGuideId,
      guideVersion: result.artifact.modelDependencies.interpretationGuideVersion,
      guideText: "UNTRUSTED OVERRIDE",
    });
    expect(() => morph.renderModelContext(substituted)).toThrow(/trusted interpretation guide/i);
    expect(morph.verify(substituted)).toMatchObject({ valid: false, semanticRoundTrip: "failed" });

    const unknown = createArtifact({
      ir,
      plan: { encoding: "unknown-codec", formatVersion: "999", options: {} },
      section: {
        ...result.artifact.section,
        encoding: "unknown-codec",
        formatVersion: "999",
        interpretationGuideId: "unknown/guide",
      },
      plannerPolicy: "compatibility",
      target: result.artifact.target,
      task: result.artifact.requestFrame.task,
      guideId: "unknown/guide",
      guideVersion: "999",
      guideText: "Unknown guide",
    });
    expect(() => morph.renderModelContext(unknown)).toThrow(/not registered/i);
  });

  it("does not treat a status label without paired confidence evidence as qualification", async () => {
    const text = '[{"id":"a","value":1},{"id":"b","value":2}]';
    const ir = parseJsonStrict(text);
    const plan = rowsDelimitedEncoder.enumerate(ir, { instruction: "Read it." })[0];
    if (plan === undefined) throw new Error("Missing row plan");
    const boundTarget = {
      ...localO200kBaseProfile,
      profileId: "test-bound-target",
      modelId: "synthetic-model",
      modelRevision: "synthetic-revision",
    } as const;
    const fakeProfile = {
      profileId: "fake-qualified",
      encoding: rowsDelimitedEncoder.id,
      formatVersion: rowsDelimitedEncoder.formatVersion,
      targetProfileId: boundTarget.profileId,
      tokenizerId: boundTarget.tokenizerId,
      tokenizerRevision: boundTarget.tokenizerRevision,
      modelId: boundTarget.modelId,
      modelRevision: boundTarget.modelRevision,
      guideVersion: rowsDelimitedEncoder.interpretationGuideVersion,
      rendererVersion: "morph-prompt/1",
      planOptionsDigest: sha256Text(canonicalJsonText(plan.options)),
      taskFamily: "unknown",
      benchmarkProvenance: "synthetic negative fixture",
      datasetCharacteristics: { fixture: true },
      answerSchemaDigest: "a".repeat(64),
      evaluationMetric: "binary correctness",
      allowedRegression: 0.05,
      evidence: {
        status: "qualified",
        profileId: "fake-qualified",
        taskFamily: "unknown",
        baselineEncoding: "json-compact",
      },
    } as QualityProfile;
    const validatedMorph = createMorph({
      encoders: builtInEncoders,
      tokenizers: [localO200kBaseTokenizer],
      targetProfiles: [boundTarget],
      qualityProfiles: [fakeProfile],
    });
    const validated = await validatedMorph.compile({
      ...request(text),
      target: boundTarget,
      planner: {
        policy: "validated",
        objective: "prompt-tokens",
        forcedEncoding: "rows-delimited",
        qualityProfileId: fakeProfile.profileId,
      },
    });
    expect(validated).toMatchObject({ ok: false, error: { code: "NO_ELIGIBLE_PLAN" } });
    if (!validated.ok) {
      expect(
        validated.report?.candidates.some((candidate) =>
          candidate.reasonCodes.includes("QUALITY_PROFILE_MISMATCH"),
        ),
      ).toBe(true);
    }

    const qualifiedProfile: QualityProfile = {
      ...fakeProfile,
      profileId: "synthetic-qualified-fixture",
      expiresAt: "2099-01-01T00:00:00.000Z",
      evidence: {
        status: "qualified",
        profileId: "synthetic-qualified-fixture",
        taskFamily: "unknown",
        baselineEncoding: "json-compact",
        pairedAccuracyDelta: 0,
        lowerConfidenceBound: -0.01,
        upperConfidenceBound: 0.01,
        uniqueCaseCount: 30,
        independentDatasetCount: 3,
        evidenceDigest: "b".repeat(64),
      },
    };
    const qualifiedMorph = createMorph({
      encoders: builtInEncoders,
      tokenizers: [localO200kBaseTokenizer],
      targetProfiles: [boundTarget],
      qualityProfiles: [qualifiedProfile],
    });
    const qualified = await qualifiedMorph.compile({
      ...request(text),
      target: boundTarget,
      planner: {
        policy: "validated",
        objective: "prompt-tokens",
        forcedEncoding: "rows-delimited",
        qualityProfileId: qualifiedProfile.profileId,
      },
    });
    expect(qualified).toMatchObject({
      ok: true,
      artifact: { plan: { encoding: "rows-delimited" } },
    });
  });

  it("enforces rendered bytes, context reservation, tokenizer results, and cancellation", async () => {
    const renderedLimit = await morph.compile(
      request('{"value":"complete"}', {
        constraints: { mode: "lossless", maxRenderedBytes: 1 },
      }),
    );
    expect(renderedLimit).toMatchObject({
      ok: false,
      error: { code: "MAX_RENDERED_BYTES_EXCEEDED" },
    });

    const windowTarget = {
      ...localO200kBaseProfile,
      profileId: "tiny-context",
      contextWindowTokens: 32,
    } as const;
    const windowMorph = createMorph({
      encoders: builtInEncoders,
      tokenizers: [localO200kBaseTokenizer],
      targetProfiles: [windowTarget],
    });
    const overWindow = await windowMorph.compile({
      ...request('{"value":1}'),
      target: windowTarget,
      constraints: { mode: "lossless", reservedOutputTokens: 16 },
    });
    expect(overWindow).toMatchObject({ ok: false, error: { code: "BUDGET_EXCEEDED" } });

    const invalidTokenizer = createMorph({
      encoders: builtInEncoders,
      tokenizers: [{ ...localO200kBaseTokenizer, countText: () => -1 }],
      targetProfiles: [localO200kBaseProfile],
    });
    expect(await invalidTokenizer.compile(request("null"))).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOKENIZER_RESULT" },
    });

    const controller = new AbortController();
    controller.abort();
    const cancelledMorph = createMorph(
      {
        encoders: builtInEncoders,
        tokenizers: [localO200kBaseTokenizer],
        targetProfiles: [localO200kBaseProfile],
      },
      { signal: controller.signal },
    );
    expect(await cancelledMorph.compile(request("null"))).toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
      report: { completedSearch: false },
    });
  });

  it("rejects ambiguous duplicate registries", () => {
    expect(() =>
      createMorph({
        encoders: builtInEncoders,
        tokenizers: [localO200kBaseTokenizer, localO200kBaseTokenizer],
        targetProfiles: [localO200kBaseProfile],
      }),
    ).toThrow(/registered more than once/i);
  });
});
