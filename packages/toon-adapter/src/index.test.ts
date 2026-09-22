import { parseJsonStrict, semanticEqual } from "@morph/core";
import { describe, expect, it } from "vitest";
import { TOON_FORMAT_VERSION, toonEncoder } from "./index.js";

const TASK = { instruction: "Inspect all data." } as const;

function commaPlan() {
  return {
    encoding: "toon",
    formatVersion: TOON_FORMAT_VERSION,
    options: { delimiter: ",", indentSize: 2 },
  } as const;
}

describe("official TOON adapter", () => {
  it("matches the pinned 4.1.1 tabular conformance fixture", () => {
    const ir = parseJsonStrict('{"users":[{"id":1,"name":"Ada"},{"id":2,"name":"Bob"}]}');
    const section = toonEncoder.encode(ir, commaPlan());
    expect(section.formatVersion).toBe("4.1.1");
    expect(section.payload).toBe("users[2]{id,name}:\n  1,Ada\n  2,Bob");
    expect(semanticEqual(toonEncoder.decode(section), ir)).toBe(true);
  });

  it("round-trips supported data independently through the official decoder", () => {
    const ir = parseJsonStrict(
      '{"customers":[{"id":"001","active":true,"score":1.5},{"id":"002","active":false,"score":2}],"empty":{},"tags":[]}',
    );
    const plan = commaPlan();
    expect(toonEncoder.supports(ir, plan)).toEqual({ supported: true, reasons: [] });
    const section = toonEncoder.encode(ir, plan);
    expect(semanticEqual(toonEncoder.decode(section), ir)).toBe(true);
  });

  it("preserves hostile-looking keys and escaped string content when supported", () => {
    const ir = parseJsonStrict(
      '{"__proto__":{"constructor":"text"},"toJSON":"not a function","text":"a,b|c\\tline\\nnext","null":"null"}',
    );
    const section = toonEncoder.encode(ir, commaPlan());
    expect(semanticEqual(toonEncoder.decode(section), ir)).toBe(true);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it.each(["-0", "1.2300", "1e3", "9007199254740992", "9007199254740993"])(
    "rejects a non-preserving numeric lexeme: %s",
    (lexeme) => {
      const ir = parseJsonStrict(`{"n":${lexeme}}`);
      const result = toonEncoder.supports(ir, commaPlan());
      expect(result.supported).toBe(false);
      expect(result.reasons[0]).toMatch(/TOON_NUMBER_(?:NONCANONICAL|PRECISION_UNSAFE)/);
    },
  );

  it("enumerates only pinned official delimiter options", () => {
    const ir = parseJsonStrict("null");
    const plans = toonEncoder.enumerate(ir, TASK);
    const options = plans.map(
      (plan) =>
        plan.options as {
          readonly delimiter?: unknown;
          readonly indentSize?: unknown;
        },
    );
    expect(plans).toHaveLength(3);
    expect(options.map((option) => option.delimiter)).toEqual([",", "\t", "|"]);
    expect(options.every((option) => option.indentSize === 2)).toBe(true);
  });

  it("rejects a noncanonical payload instead of repairing it", () => {
    const ir = parseJsonStrict('{"name":"Ada"}');
    const section = toonEncoder.encode(ir, commaPlan());
    expect(() => toonEncoder.decode({ ...section, payload: `${section.payload}\n` })).toThrow(
      /canonical form/,
    );
  });

  it("rejects oversized payloads before invoking the vendor decoder", () => {
    const ir = parseJsonStrict("null");
    const section = toonEncoder.encode(ir, commaPlan());
    expect(() =>
      toonEncoder.decode({ ...section, payload: "x".repeat(16 * 1024 * 1024 + 1) }),
    ).toThrow(/allocation limit/i);
  });
});
