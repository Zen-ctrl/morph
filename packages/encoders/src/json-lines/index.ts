import type {
  EncodedSection,
  EncoderApplicability,
  EncoderPlan,
  IRNode,
  MorphEncoder,
  MorphIR,
  MorphTask,
} from "@morph/core";
import { fail, printJsonNode } from "@morph/core";
import {
  assertPlan,
  assertSection,
  baseMetadata,
  countNodesBounded,
  finishDecodedIr,
  MAX_DECODE_NODES,
  parsePayloadNode,
  planIssues,
  requireLiteral,
  requireSafeInteger,
} from "../shared.js";

export const JSON_LINES_FORMAT_VERSION = "1";
export const JSON_LINES_GUIDE_ID = "morph-guide/json-lines";
export const JSON_LINES_GUIDE_VERSION = "1";
export const JSON_LINES_GUIDE_TEXT =
  "The payload represents one root array. Each physical line is one complete JSON value in array order. Use the declared element count, including zero for an empty array. Escaped newlines inside JSON strings are not line breaks.";

export class JsonLinesEncoder implements MorphEncoder {
  readonly id = "json-lines";
  readonly formatVersion = JSON_LINES_FORMAT_VERSION;
  readonly interpretationGuideId = JSON_LINES_GUIDE_ID;
  readonly interpretationGuideVersion = JSON_LINES_GUIDE_VERSION;
  readonly interpretationGuideText = JSON_LINES_GUIDE_TEXT;
  readonly mechanismCount = 1;

  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const reasons = [...planIssues(plan, this.id, this.formatVersion, [])];
    if (ir.root.kind !== "array") reasons.push("ROOT_NOT_ARRAY");
    return { supported: reasons.length === 0, reasons };
  }

  enumerate(ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    if (ir.root.kind !== "array") return [];
    return [{ encoding: this.id, formatVersion: this.formatVersion, options: {} }];
  }

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    assertPlan(plan, this.id, this.formatVersion, []);
    if (ir.root.kind !== "array") {
      fail("ENCODER_NOT_APPLICABLE", "JSON Lines requires a root array.");
    }
    return {
      encoding: this.id,
      formatVersion: this.formatVersion,
      payload: ir.root.items.map((item) => printJsonNode(item)).join("\n"),
      layoutMetadata: {
        ...baseMetadata(ir),
        root: "array",
        elementCount: ir.root.items.length,
        lineFramingVersion: "1",
      },
      interpretationGuideId: this.interpretationGuideId,
    };
  }

  decode(section: EncodedSection): MorphIR {
    const metadata = assertSection(
      section,
      this.id,
      this.formatVersion,
      this.interpretationGuideId,
      ["root", "elementCount", "lineFramingVersion"],
    );
    requireLiteral(metadata, "root", "array");
    requireLiteral(metadata, "lineFramingVersion", "1");
    const elementCount = requireSafeInteger(metadata, "elementCount", MAX_DECODE_NODES);

    if (section.payload.includes("\r")) {
      fail("INVALID_JSON_LINES", "JSON Lines payloads use U+000A as the physical line separator.");
    }
    if (section.payload.endsWith("\n")) {
      fail("INVALID_JSON_LINES", "A JSON Lines payload must not contain a trailing empty line.");
    }
    const lines = section.payload.length === 0 ? [] : section.payload.split("\n");
    if (lines.length !== elementCount) {
      fail(
        "COUNT_MISMATCH",
        "The JSON Lines element count does not match the payload.",
        undefined,
        {
          declared: elementCount,
          actual: lines.length,
        },
      );
    }

    const items: IRNode[] = [];
    let totalNodes = 1;
    for (const line of lines) {
      if (line.length === 0) {
        fail("INVALID_JSON_LINES", "Every physical line must contain one JSON value.");
      }
      const item = parsePayloadNode(line);
      totalNodes += countNodesBounded(item, MAX_DECODE_NODES);
      if (totalNodes > MAX_DECODE_NODES) {
        fail("MAX_NODES_EXCEEDED", "Decoded content exceeds the node limit.", undefined, {
          maximum: MAX_DECODE_NODES,
        });
      }
      items.push(item);
    }
    return finishDecodedIr({ kind: "array", items }, metadata);
  }
}

export const jsonLinesEncoder: MorphEncoder = new JsonLinesEncoder();
