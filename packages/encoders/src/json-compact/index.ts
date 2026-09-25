import type {
  EncodedSection,
  EncoderApplicability,
  EncoderPlan,
  MorphEncoder,
  MorphIR,
  MorphTask,
} from "@morph/core";
import { fail, printJson } from "@morph/core";
import {
  assertPlan,
  assertSection,
  baseMetadata,
  finishDecodedIr,
  parsePayloadNode,
  planIssues,
  requireString,
} from "../shared.js";

export const JSON_COMPACT_FORMAT_VERSION = "1";
export const JSON_COMPACT_GUIDE_ID = "morph-guide/json-compact";
export const JSON_COMPACT_GUIDE_VERSION = "1";
export const JSON_COMPACT_GUIDE_TEXT =
  "The payload is strict compact JSON. Interpret objects, arrays, strings, numbers, booleans, and null according to JSON syntax.";

const ROOT_KINDS = new Set(["null", "boolean", "string", "number", "array", "object"]);

export class JsonCompactEncoder implements MorphEncoder {
  readonly id = "json-compact";
  readonly formatVersion = JSON_COMPACT_FORMAT_VERSION;
  readonly interpretationGuideId = JSON_COMPACT_GUIDE_ID;
  readonly interpretationGuideVersion = JSON_COMPACT_GUIDE_VERSION;
  readonly interpretationGuideText = JSON_COMPACT_GUIDE_TEXT;
  readonly mechanismCount = 0;

  supports(_ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const reasons = planIssues(plan, this.id, this.formatVersion, []);
    return { supported: reasons.length === 0, reasons };
  }

  enumerate(_ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    return [{ encoding: this.id, formatVersion: this.formatVersion, options: {} }];
  }

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    assertPlan(plan, this.id, this.formatVersion, []);
    const metadata = {
      ...baseMetadata(ir),
      rootKind: ir.root.kind,
    };
    return {
      encoding: this.id,
      formatVersion: this.formatVersion,
      payload: printJson(ir),
      layoutMetadata: metadata,
      interpretationGuideId: this.interpretationGuideId,
    };
  }

  decode(section: EncodedSection): MorphIR {
    const metadata = assertSection(
      section,
      this.id,
      this.formatVersion,
      this.interpretationGuideId,
      ["rootKind"],
    );
    const declaredRootKind = requireString(metadata, "rootKind");
    if (!ROOT_KINDS.has(declaredRootKind)) {
      fail("INVALID_LAYOUT_METADATA", "The declared root kind is unsupported.");
    }
    const root = parsePayloadNode(section.payload);
    if (root.kind !== declaredRootKind) {
      fail("INVALID_LAYOUT_METADATA", "The declared root kind does not match the payload.");
    }
    return finishDecodedIr(root, metadata);
  }
}

export const jsonCompactEncoder: MorphEncoder = new JsonCompactEncoder();
