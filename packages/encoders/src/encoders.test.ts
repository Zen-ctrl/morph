import type { EncodedSection, MorphTask } from "@morph/core";
import { parseJsonStrict, semanticEqual } from "@morph/core";
import { describe, expect, it } from "vitest";
import {
  builtInEncoders,
  columnsJsonEncoder,
  jsonLinesEncoder,
  pathValueEncoder,
  rowsDelimitedEncoder,
} from "./index.js";

const task: MorphTask = { instruction: "Inspect every value.", accessPattern: "unknown" };

describe("native encoders", () => {
  it("round-trips every eligible native plan with exact numeric lexemes", () => {
    const ir = parseJsonStrict(
      '[{"id":"001","text":"a\\tb|c,d;\\n\\"q\\"","n":9007199254740993,"z":-0,"d":1.2300,"ok":false,"none":null},{"none":null,"ok":true,"d":2.500,"z":-0,"n":9e30,"text":"__proto__","id":"002"}]',
    );

    let tested = 0;
    for (const encoder of builtInEncoders) {
      for (const plan of encoder.enumerate(ir, task)) {
        const applicability = encoder.supports(ir, plan);
        expect(applicability).toEqual({ supported: true, reasons: [] });
        const section = encoder.encode(ir, plan);
        const decoded = encoder.decode(section);
        expect(semanticEqual(decoded, ir), `${encoder.id} ${JSON.stringify(plan.options)}`).toBe(
          true,
        );
        expect(decoded.inputKind).toBe("json-text");
        expect(decoded.semanticDigest).toBe(ir.semanticDigest);
        tested += 1;
      }
    }
    expect(tested).toBe(8);
  });

  it("preserves nested containers and escaped JSON Pointer keys", () => {
    const ir = parseJsonStrict(
      '{"":{"~1":{"0":[true,null,{"__proto__":"safe","constructor":{}}]}},"emptyArray":[],"amount":1.2300}',
    );
    const plan = pathValueEncoder.enumerate(ir, task)[0];
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error("Expected a path-value plan.");
    const section = pathValueEncoder.encode(ir, plan);
    expect(section.payload).toContain('["//~01","object"]');
    expect(semanticEqual(pathValueEncoder.decode(section), ir)).toBe(true);
  });

  it("represents an empty JSON Lines root array without ambiguity", () => {
    const ir = parseJsonStrict("[]");
    const plan = jsonLinesEncoder.enumerate(ir, task)[0];
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error("Expected a JSON Lines plan.");
    const section = jsonLinesEncoder.encode(ir, plan);
    expect(section.payload).toBe("");
    expect(section.layoutMetadata.elementCount).toBe(0);
    expect(semanticEqual(jsonLinesEncoder.decode(section), ir)).toBe(true);
  });

  it("rejects a tampered delimited row width", () => {
    const ir = parseJsonStrict('[{"a":"x|y","b":1}]');
    const plan = rowsDelimitedEncoder
      .enumerate(ir, task)
      .find((candidate) => candidate.options.delimiter === "|");
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error("Expected a pipe-delimited plan.");
    const section = rowsDelimitedEncoder.encode(ir, plan);
    const tampered: EncodedSection = { ...section, payload: `${section.payload}|null` };
    expect(() => rowsDelimitedEncoder.decode(tampered)).toThrow(/declared number of cells/i);
  });

  it("rejects duplicate typed node paths", () => {
    const ir = parseJsonStrict('{"a":1}');
    const plan = pathValueEncoder.enumerate(ir, task)[0];
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error("Expected a path-value plan.");
    const section = pathValueEncoder.encode(ir, plan);
    const firstChild = section.payload.split("\n")[1];
    expect(firstChild).toBeDefined();
    const tampered: EncodedSection = {
      ...section,
      payload: `${section.payload}\n${firstChild}`,
      layoutMetadata: { ...section.layoutMetadata, recordCount: 3 },
    };
    expect(() => pathValueEncoder.decode(tampered)).toThrow(/duplicate node path/i);
  });

  it("rejects extra and missing JSON Lines records", () => {
    const ir = parseJsonStrict('[{"id":1},{"id":2}]');
    const plan = jsonLinesEncoder.enumerate(ir, task)[0];
    if (plan === undefined) throw new Error("Expected a JSON Lines plan.");
    const section = jsonLinesEncoder.encode(ir, plan);
    expect(() =>
      jsonLinesEncoder.decode({ ...section, payload: `${section.payload}\nnull` }),
    ).toThrow(/count/i);
    expect(() =>
      jsonLinesEncoder.decode({ ...section, payload: section.payload.split("\n")[0] as string }),
    ).toThrow(/count/i);
  });

  it("rejects tampered column counts and lengths", () => {
    const ir = parseJsonStrict('[{"id":"a","value":1},{"id":"b","value":2}]');
    const plan = columnsJsonEncoder.enumerate(ir, task)[0];
    if (plan === undefined) throw new Error("Expected a columns plan.");
    const section = columnsJsonEncoder.encode(ir, plan);
    expect(() => columnsJsonEncoder.decode({ ...section, payload: '[["a","b"]]' })).toThrow(
      /field count|payload columns/i,
    );
    expect(() => columnsJsonEncoder.decode({ ...section, payload: '[["a"],[1,2]]' })).toThrow(
      /column length/i,
    );
  });
});
