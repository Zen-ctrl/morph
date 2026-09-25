import { createArtifact, parseArtifactJson, parseJsonStrict } from "@morph/core";
import { jsonCompactEncoder } from "@morph/encoders";
import { localO200kBaseProfile } from "@morph/tokenizer-adapters";
import { describe, expect, it } from "vitest";

function artifactValue(): Record<string, unknown> {
  const ir = parseJsonStrict('{"value":1}');
  const plan = jsonCompactEncoder.enumerate(ir, { instruction: "Read it." })[0];
  if (plan === undefined) throw new Error("Missing compact JSON plan");
  return JSON.parse(
    JSON.stringify(
      createArtifact({
        ir,
        plan,
        section: jsonCompactEncoder.encode(ir, plan),
        plannerPolicy: "compatibility",
        target: localO200kBaseProfile,
        task: { instruction: "Read it." },
        guideId: jsonCompactEncoder.interpretationGuideId,
        guideVersion: jsonCompactEncoder.interpretationGuideVersion,
        guideText: jsonCompactEncoder.interpretationGuideText,
      }),
    ),
  ) as Record<string, unknown>;
}

describe("strict artifact import", () => {
  it("round-trips the complete known artifact shape", () => {
    const value = artifactValue();
    expect(parseArtifactJson(JSON.stringify(value))).toEqual(value);
  });

  it("rejects hidden top-level and nested fields", () => {
    const topLevel = artifactValue();
    topLevel.originalSource = { undisclosed: true };
    expect(() => parseArtifactJson(JSON.stringify(topLevel))).toThrow(/unsupported fields/i);

    const nested = artifactValue();
    (nested.plan as Record<string, unknown>).hidden = "not part of the contract";
    expect(() => parseArtifactJson(JSON.stringify(nested))).toThrow(/unsupported fields/i);
  });

  it("rejects malformed optional fields instead of silently dropping them", () => {
    const target = artifactValue();
    (target.target as Record<string, unknown>).modelId = 42;
    expect(() => parseArtifactJson(JSON.stringify(target))).toThrow(/modelId must be a string/i);

    const task = artifactValue();
    const frame = task.requestFrame as Record<string, unknown>;
    (frame.task as Record<string, unknown>).relevantPaths = ["/value", 1];
    expect(() => parseArtifactJson(JSON.stringify(task))).toThrow(/relevantPaths/i);
  });

  it("rejects unknown prompt templates and unframed dictionary dependencies", () => {
    const template = artifactValue();
    (template.requestFrame as Record<string, unknown>).templateVersion = "morph-prompt/999";
    expect(() => parseArtifactJson(JSON.stringify(template))).toThrow(/morph-prompt\/1/i);

    const dictionaries = artifactValue();
    (dictionaries.modelDependencies as Record<string, unknown>).dictionaries = [["US", "CA"]];
    expect(() => parseArtifactJson(JSON.stringify(dictionaries))).toThrow(/not supported/i);

    const invalidSchema = artifactValue();
    (invalidSchema.modelDependencies as Record<string, unknown>).schema = null;
    expect(() => parseArtifactJson(JSON.stringify(invalidSchema))).toThrow(
      /schema must be an object|boolean schema/i,
    );
  });
});
