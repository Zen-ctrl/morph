import type {
  EncodedSection,
  EncoderApplicability,
  EncoderPlan,
  IRNode,
  MorphEncoder,
  MorphIR,
  MorphTask,
} from "@morph/core";
import { fail } from "@morph/core";
import {
  assertPlan,
  assertSection,
  baseMetadata,
  entriesByKey,
  finishDecodedIr,
  inspectUniformPrimitiveTable,
  isRecord,
  MAX_DECODE_NODES,
  parsePrimitiveText,
  planIssues,
  primitiveText,
  requireLiteral,
  requireSafeInteger,
  requireUniformPrimitiveTable,
  requireUniqueStringArray,
} from "../shared.js";

export const ROWS_DELIMITED_FORMAT_VERSION = "1";
export const ROWS_DELIMITED_GUIDE_ID = "morph-guide/rows-delimited";
export const ROWS_DELIMITED_GUIDE_VERSION = "1";
export const ROWS_DELIMITED_GUIDE_TEXT =
  "The payload is a typed delimited table. The metadata lists fields in cell order and declares the delimiter and row count. Each cell is exactly one JSON scalar token, so quoted strings remain distinct from numbers, booleans, and null. Delimiters inside quoted JSON strings are data. Rows stay in source order.";

export const ROW_DELIMITERS = ["\t", ",", "|", ";"] as const;
export type RowDelimiter = (typeof ROW_DELIMITERS)[number];

function isRowDelimiter(value: unknown): value is RowDelimiter {
  return typeof value === "string" && (ROW_DELIMITERS as readonly string[]).includes(value);
}

function planDelimiter(plan: EncoderPlan): RowDelimiter {
  if (!isRecord(plan.options) || !isRowDelimiter(plan.options.delimiter)) {
    fail("INVALID_ENCODER_PLAN", "The rows-delimited plan requires a supported delimiter.");
  }
  return plan.options.delimiter;
}

function splitDelimitedPayload(
  payload: string,
  delimiter: RowDelimiter,
): readonly (readonly string[])[] {
  if (payload.length === 0) return [];
  if (payload.includes("\r")) {
    fail("INVALID_DELIMITED_PAYLOAD", "Delimited rows use U+000A as the row separator.");
  }
  if (payload.endsWith("\n")) {
    fail("INVALID_DELIMITED_PAYLOAD", "A delimited payload must not end with an empty row.");
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cellStart = 0;
  let insideString = false;
  let escaped = false;

  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];
    if (insideString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      } else if (character === "\n") {
        fail("INVALID_DELIMITED_PAYLOAD", "A JSON string cell cannot contain a raw newline.");
      }
      continue;
    }

    if (character === '"') {
      insideString = true;
    } else if (character === delimiter) {
      row.push(payload.slice(cellStart, index));
      cellStart = index + 1;
    } else if (character === "\n") {
      row.push(payload.slice(cellStart, index));
      rows.push(row);
      row = [];
      cellStart = index + 1;
    }
  }

  if (insideString || escaped) {
    fail("INVALID_DELIMITED_PAYLOAD", "A quoted JSON string cell is unterminated.");
  }
  row.push(payload.slice(cellStart));
  rows.push(row);
  return rows;
}

export class RowsDelimitedEncoder implements MorphEncoder {
  readonly id = "rows-delimited";
  readonly formatVersion = ROWS_DELIMITED_FORMAT_VERSION;
  readonly interpretationGuideId = ROWS_DELIMITED_GUIDE_ID;
  readonly interpretationGuideVersion = ROWS_DELIMITED_GUIDE_VERSION;
  readonly interpretationGuideText = ROWS_DELIMITED_GUIDE_TEXT;
  readonly mechanismCount = 2;

  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const reasons = [...planIssues(plan, this.id, this.formatVersion, ["delimiter"])];
    if (!isRecord(plan.options) || !isRowDelimiter(plan.options.delimiter)) {
      reasons.push("UNSUPPORTED_DELIMITER");
    }
    reasons.push(...inspectUniformPrimitiveTable(ir).reasons);
    return { supported: reasons.length === 0, reasons };
  }

  enumerate(ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    if (inspectUniformPrimitiveTable(ir).table === undefined) return [];
    return ROW_DELIMITERS.map((delimiter) => ({
      encoding: this.id,
      formatVersion: this.formatVersion,
      options: { delimiter },
    }));
  }

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    assertPlan(plan, this.id, this.formatVersion, ["delimiter"]);
    const delimiter = planDelimiter(plan);
    const table = requireUniformPrimitiveTable(ir);
    const lines = table.rows.map((row) => {
      const cells = entriesByKey(row);
      return table.fields
        .map((field) => {
          const cell = cells.get(field);
          if (cell === undefined) {
            fail("INVALID_IR", "A uniform record is missing a declared field.");
          }
          return primitiveText(cell);
        })
        .join(delimiter);
    });
    return {
      encoding: this.id,
      formatVersion: this.formatVersion,
      payload: lines.join("\n"),
      layoutMetadata: {
        ...baseMetadata(ir),
        root: "array-of-objects",
        rowCount: table.rows.length,
        fields: table.fields,
        delimiter,
        cellCodec: "json-scalar-v1",
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
      ["root", "rowCount", "fields", "delimiter", "cellCodec"],
    );
    requireLiteral(metadata, "root", "array-of-objects");
    requireLiteral(metadata, "cellCodec", "json-scalar-v1");
    const rowCount = requireSafeInteger(metadata, "rowCount", MAX_DECODE_NODES);
    const fields = requireUniqueStringArray(metadata, "fields", MAX_DECODE_NODES);
    const delimiter = metadata.delimiter;
    if (!isRowDelimiter(delimiter)) {
      fail(
        "INVALID_LAYOUT_METADATA",
        "The delimited representation declares an unsupported delimiter.",
      );
    }
    if (rowCount === 0 || fields.length === 0) {
      fail("INVALID_LAYOUT_METADATA", "rows-delimited requires at least one row and one field.");
    }
    const projectedNodes = 1 + rowCount * (1 + fields.length);
    if (!Number.isSafeInteger(projectedNodes) || projectedNodes > MAX_DECODE_NODES) {
      fail(
        "MAX_NODES_EXCEEDED",
        "The declared delimited table exceeds the node limit.",
        undefined,
        {
          maximum: MAX_DECODE_NODES,
        },
      );
    }

    const rows = splitDelimitedPayload(section.payload, delimiter);
    if (rows.length !== rowCount) {
      fail(
        "COUNT_MISMATCH",
        "The declared row count does not match the delimited payload.",
        undefined,
        {
          declared: rowCount,
          actual: rows.length,
        },
      );
    }

    const items: IRNode[] = rows.map((cells) => {
      if (cells.length !== fields.length) {
        fail(
          "ROW_WIDTH_MISMATCH",
          "A delimited row does not contain the declared number of cells.",
          undefined,
          {
            expected: fields.length,
            actual: cells.length,
          },
        );
      }
      return {
        kind: "object",
        entries: fields.map((field, index) => {
          const cell = cells[index];
          if (cell === undefined) {
            fail("ROW_WIDTH_MISMATCH", "A delimited row is missing a cell.");
          }
          return [field, parsePrimitiveText(cell)] as const;
        }),
      };
    });
    return finishDecodedIr({ kind: "array", items }, metadata);
  }
}

export const rowsDelimitedEncoder: MorphEncoder = new RowsDelimitedEncoder();
