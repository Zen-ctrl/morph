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
  entriesByKey,
  finishDecodedIr,
  inspectUniformPrimitiveTable,
  isPrimitiveNode,
  MAX_DECODE_NODES,
  parsePayloadNode,
  planIssues,
  requireLiteral,
  requireSafeInteger,
  requireUniformPrimitiveTable,
  requireUniqueStringArray,
} from "../shared.js";

export const COLUMNS_JSON_FORMAT_VERSION = "1";
export const COLUMNS_JSON_GUIDE_ID = "morph-guide/columns-json";
export const COLUMNS_JSON_GUIDE_VERSION = "1";
export const COLUMNS_JSON_GUIDE_TEXT =
  "The payload is a JSON array of columns. Metadata field i names payload column i. Index j across every column reconstructs source row j, and rows remain in source order. Use the declared field and row counts to validate alignment.";

export class ColumnsJsonEncoder implements MorphEncoder {
  readonly id = "columns-json";
  readonly formatVersion = COLUMNS_JSON_FORMAT_VERSION;
  readonly interpretationGuideId = COLUMNS_JSON_GUIDE_ID;
  readonly interpretationGuideVersion = COLUMNS_JSON_GUIDE_VERSION;
  readonly interpretationGuideText = COLUMNS_JSON_GUIDE_TEXT;
  readonly mechanismCount = 1;

  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const reasons = [...planIssues(plan, this.id, this.formatVersion, [])];
    reasons.push(...inspectUniformPrimitiveTable(ir).reasons);
    return { supported: reasons.length === 0, reasons };
  }

  enumerate(ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    if (inspectUniformPrimitiveTable(ir).table === undefined) return [];
    return [{ encoding: this.id, formatVersion: this.formatVersion, options: {} }];
  }

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    assertPlan(plan, this.id, this.formatVersion, []);
    const table = requireUniformPrimitiveTable(ir);
    const rowMaps = table.rows.map(entriesByKey);
    const columns: IRNode = {
      kind: "array",
      items: table.fields.map((field) => ({
        kind: "array",
        items: rowMaps.map((row) => {
          const cell = row.get(field);
          if (cell === undefined) {
            fail("INVALID_IR", "A uniform record is missing a declared field.");
          }
          return cell;
        }),
      })),
    };
    return {
      encoding: this.id,
      formatVersion: this.formatVersion,
      payload: printJsonNode(columns),
      layoutMetadata: {
        ...baseMetadata(ir),
        root: "array-of-objects",
        rowCount: table.rows.length,
        fields: table.fields,
        columnCodec: "json-array-v1",
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
      ["root", "rowCount", "fields", "columnCodec"],
    );
    requireLiteral(metadata, "root", "array-of-objects");
    requireLiteral(metadata, "columnCodec", "json-array-v1");
    const rowCount = requireSafeInteger(metadata, "rowCount", MAX_DECODE_NODES);
    const fields = requireUniqueStringArray(metadata, "fields", MAX_DECODE_NODES);
    if (rowCount === 0 || fields.length === 0) {
      fail("INVALID_LAYOUT_METADATA", "columns-json requires at least one row and one field.");
    }
    const projectedNodes = 1 + rowCount * (1 + fields.length);
    if (!Number.isSafeInteger(projectedNodes) || projectedNodes > MAX_DECODE_NODES) {
      fail("MAX_NODES_EXCEEDED", "The declared column table exceeds the node limit.", undefined, {
        maximum: MAX_DECODE_NODES,
      });
    }

    const payload = parsePayloadNode(section.payload);
    if (payload.kind !== "array") {
      fail("INVALID_COLUMNS_PAYLOAD", "The columns payload must be a JSON array.");
    }
    if (payload.items.length !== fields.length) {
      fail(
        "COLUMN_COUNT_MISMATCH",
        "The declared field count does not match the payload columns.",
        undefined,
        {
          expected: fields.length,
          actual: payload.items.length,
        },
      );
    }

    const columns = payload.items.map((column) => {
      if (column.kind !== "array") {
        fail("INVALID_COLUMNS_PAYLOAD", "Every column must be represented by a JSON array.");
      }
      if (column.items.length !== rowCount) {
        fail(
          "COLUMN_LENGTH_MISMATCH",
          "A column length does not match the declared row count.",
          undefined,
          {
            expected: rowCount,
            actual: column.items.length,
          },
        );
      }
      if (column.items.some((cell) => !isPrimitiveNode(cell))) {
        fail("INVALID_PRIMITIVE_CELL", "Every column cell must contain a JSON primitive.");
      }
      return column.items;
    });

    const items: IRNode[] = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const entries: Array<readonly [string, IRNode]> = [];
      for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
        const field = fields[fieldIndex];
        const cell = columns[fieldIndex]?.[rowIndex];
        if (field === undefined || cell === undefined) {
          fail("COLUMN_LENGTH_MISMATCH", "A column is missing a declared row value.");
        }
        entries.push([field, cell]);
      }
      items.push({ kind: "object", entries });
    }
    return finishDecodedIr({ kind: "array", items }, metadata);
  }
}

export const columnsJsonEncoder: MorphEncoder = new ColumnsJsonEncoder();
