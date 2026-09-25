import {
  fromJsValue,
  MorphException,
  parseJsonStrict,
  printJson,
  profileIR,
  semanticEqual,
} from "@morph/core";
import { describe, expect, it } from "vitest";

describe("strict IR input", () => {
  it("preserves exact JSON number lexemes", () => {
    const ir = parseJsonStrict('{"big":9007199254740993,"z":-0,"d":1.2300,"e":9e30}');
    expect(printJson(ir)).toBe('{"big":9007199254740993,"z":-0,"d":1.2300,"e":9e30}');
  });

  it("rejects duplicate keys before overwrite", () => {
    expect(() => parseJsonStrict('{"a":1,"a":2}')).toThrowError(MorphException);
    try {
      parseJsonStrict('{"a":1,"a":2}');
    } catch (error) {
      expect((error as MorphException).error.code).toBe("DUPLICATE_KEY");
    }
  });

  it("rejects lone surrogate escapes and accepts composed and decomposed strings distinctly", () => {
    expect(() => parseJsonStrict('"\\ud800"')).toThrow(/surrogate/i);
    const composed = parseJsonStrict('"café"');
    const decomposed = parseJsonStrict('"café"');
    expect(semanticEqual(composed, decomposed)).toBe(false);
  });

  it.each([
    [undefined, "UNSUPPORTED_JS_VALUE"],
    [Number.NaN, "UNSUPPORTED_JS_VALUE"],
    [Number.POSITIVE_INFINITY, "UNSUPPORTED_JS_VALUE"],
    [1n, "UNSUPPORTED_JS_VALUE"],
  ])("rejects unsupported JS input %#", (value, code) => {
    try {
      fromJsValue(value);
      throw new Error("Expected rejection");
    } catch (error) {
      expect((error as MorphException).error.code).toBe(code);
    }
  });

  it("rejects sparse arrays, cycles, class instances, accessors, and extra array properties", () => {
    const sparse = new Array(2);
    expect(() => fromJsValue(sparse)).toThrow(/Sparse/i);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => fromJsValue(cyclic)).toThrow(/Cyclic/i);
    expect(() => fromJsValue(new Date())).toThrow(/ordinary objects/i);
    let invoked = false;
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        invoked = true;
        return "no";
      },
    });
    expect(() => fromJsValue(accessor)).toThrow(/Accessor/i);
    expect(invoked).toBe(false);
    const extra = [1] as number[] & { note?: string };
    extra.note = "extra";
    expect(() => fromJsValue(extra)).toThrow(/extra properties/i);
    const nonIndex = [1] as number[] & Record<string, unknown>;
    Object.defineProperty(nonIndex, "4294967295", {
      value: "would otherwise be dropped",
      enumerable: true,
    });
    expect(() => fromJsValue(nonIndex)).toThrow(/extra properties/i);
  });

  it("preserves negative zero from the JS-value adapter", () => {
    expect(printJson(fromJsValue({ z: -0 }))).toBe('{"z":-0}');
  });

  it("preserves hostile-looking keys without prototype mutation", () => {
    const ir = parseJsonStrict('{"__proto__":{"polluted":true},"constructor":1,"prototype":2}');
    expect(printJson(ir)).toContain('"__proto__"');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("treats object order as semantically irrelevant but preserves array order", () => {
    const first = parseJsonStrict('{"a":1,"b":[1,2]}');
    const reordered = parseJsonStrict('{"b":[1,2],"a":1}');
    const arrayChanged = parseJsonStrict('{"a":1,"b":[2,1]}');
    expect(semanticEqual(first, reordered)).toBe(true);
    expect(first.semanticDigest).toBe(reordered.semanticDigest);
    expect(semanticEqual(first, arrayChanged)).toBe(false);
  });

  it("enforces bytes, depth, and nodes while parsing", () => {
    expect(() => parseJsonStrict('"abcdef"', { maxInputBytes: 2 })).toThrow(/byte limit/i);
    expect(() => parseJsonStrict("[[[0]]]", { maxDepth: 2 })).toThrow(/depth/i);
    expect(() => parseJsonStrict("[1,2,3]", { maxNodes: 3 })).toThrow(/node limit/i);
  });

  it("labels capped scalar statistics as inexact", () => {
    const profile = profileIR(parseJsonStrict('["a","b","a","c"]'), {
      maxScalarCardinality: 1,
    });
    expect(profile).toMatchObject({
      exact: false,
      scalarCardinalityCapped: true,
      cappedScalarCardinality: 1,
      untrackedScalarCount: 2,
      repeatedScalarCount: 1,
    });
  });
});
