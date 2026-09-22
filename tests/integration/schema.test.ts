import { createMorph } from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import { localO200kBaseProfile, localO200kBaseTokenizer } from "@morph/tokenizer-adapters";
import { describe, expect, it } from "vitest";

const morph = createMorph({
  encoders: builtInEncoders,
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
});

function compile(text: string, schema: unknown) {
  return morph.compile({
    data: { kind: "json-text", text },
    schema,
    task: { instruction: "Inspect all fields." },
    target: localO200kBaseProfile,
    constraints: { mode: "lossless" },
    planner: { policy: "compatibility", objective: "prompt-tokens" },
  });
}

describe("Draft 2020-12 schema handling", () => {
  it("validates without mutation and retains schema meaning in the counted bundle", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      description: "Temperature in fictional degrees",
      type: "object",
      required: ["value"],
      properties: { value: { type: "integer" } },
      additionalProperties: false,
    };
    const result = await compile('{"value":4}', schema);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.modelDependencies.schema).toEqual(schema);
    expect(morph.renderModelContext(result.artifact).rendered).toContain(
      "Temperature in fictional degrees",
    );
  });

  it("returns a typed validation failure without coercing or removing data", async () => {
    const result = await compile('{"value":"4","extra":true}', {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { value: { type: "integer" } },
      additionalProperties: false,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "SCHEMA_VALIDATION_FAILED" } });
  });

  it("conservatively rejects exact numeric bounds over precision-sensitive lexemes", async () => {
    const result = await compile('{"value":9007199254740993}', {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { value: { type: "integer", minimum: 1 } },
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED" },
    });
  });

  it("does not collapse distinct large numeric lexemes for uniqueItems", async () => {
    const result = await compile("[9007199254740992,9007199254740993]", {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "array",
      uniqueItems: true,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED" },
    });
  });

  it("rejects unsupported schema dialects", async () => {
    const result = await compile("{}", { $schema: "http://json-schema.org/draft-07/schema#" });
    expect(result).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_SCHEMA_DIALECT" } });
  });
});
