import type { EncodedSection, EncoderPlan, IRNode, MorphIR } from "@morph/core";
import {
  assertJsonNumberLexeme,
  assertWellFormedUnicode,
  createMorphIR,
  fail,
  parseJsonNode,
  printJsonNode,
} from "@morph/core";

export const MAX_DECODE_BYTES = 16 * 1024 * 1024;
export const MAX_DECODE_DEPTH = 64;
export const MAX_DECODE_NODES = 250_000;

const textEncoder = new TextEncoder();

export interface InputIdentity {
  readonly inputKind: "json-text" | "js-value";
  readonly semanticDigest: string;
}

export interface UniformPrimitiveTable {
  readonly fields: readonly string[];
  readonly rows: readonly Extract<IRNode, { readonly kind: "object" }>[];
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertRecord(
  value: unknown,
  code: string,
  message: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) fail(code, message);
  return value;
}

export function assertAllowedKeys(
  record: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  code = "INVALID_LAYOUT_METADATA",
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      fail(code, "The representation contains an unsupported metadata field.", undefined, {
        field: key,
      });
    }
  }
}

export function requireString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  code = "INVALID_LAYOUT_METADATA",
): string {
  const value = record[key];
  if (typeof value !== "string") {
    fail(code, "A required representation field must be a string.", undefined, { field: key });
  }
  return value;
}

export function requireLiteral(
  record: Readonly<Record<string, unknown>>,
  key: string,
  expected: string,
): void {
  if (record[key] !== expected) {
    fail(
      "INVALID_LAYOUT_METADATA",
      "A representation metadata field has an unsupported value.",
      undefined,
      {
        field: key,
        expected,
      },
    );
  }
}

export function requireSafeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  maximum = MAX_DECODE_NODES,
): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    fail("INVALID_LAYOUT_METADATA", "A declared count is outside the supported range.", undefined, {
      field: key,
      maximum,
    });
  }
  return value as number;
}

export function requireUniqueStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
  maximum = MAX_DECODE_NODES,
): readonly string[] {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some((item) => typeof item !== "string")
  ) {
    fail(
      "INVALID_LAYOUT_METADATA",
      "A required representation field must be a bounded string array.",
      undefined,
      {
        field: key,
        maximum,
      },
    );
  }
  const strings = value as string[];
  for (const string of strings) assertWellFormedUnicode(string);
  if (new Set(strings).size !== strings.length) {
    fail(
      "INVALID_LAYOUT_METADATA",
      "Field names in representation metadata must be unique.",
      undefined,
      {
        field: key,
      },
    );
  }
  return strings;
}

export function baseMetadata(ir: MorphIR): Readonly<Record<string, unknown>> {
  assertIrIdentity(ir);
  return {
    irVersion: "morph-ir/1",
    inputKind: ir.inputKind,
    semanticDigest: ir.semanticDigest,
  };
}

export function assertIrIdentity(ir: MorphIR): void {
  if (ir.irVersion !== "morph-ir/1") {
    fail("INVALID_IR", "The encoder only accepts morph-ir/1 input.");
  }
  if (ir.inputKind !== "json-text" && ir.inputKind !== "js-value") {
    fail("INVALID_IR", "The IR contains an unsupported input kind.");
  }
  const pending: IRNode[] = [ir.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    switch (node.kind) {
      case "null":
        break;
      case "boolean":
        if (typeof node.value !== "boolean") {
          fail("INVALID_IR", "A boolean IR node contains an invalid value.");
        }
        break;
      case "string":
        if (typeof node.value !== "string") {
          fail("INVALID_IR", "A string IR node contains an invalid value.");
        }
        assertWellFormedUnicode(node.value);
        break;
      case "number":
        if (typeof node.lexeme !== "string") {
          fail("INVALID_IR", "A number IR node contains an invalid lexeme.");
        }
        assertJsonNumberLexeme(node.lexeme);
        break;
      case "array":
        if (!Array.isArray(node.items)) {
          fail("INVALID_IR", "An array IR node contains an invalid item list.");
        }
        for (const item of node.items) pending.push(item);
        break;
      case "object": {
        if (!Array.isArray(node.entries)) {
          fail("INVALID_IR", "An object IR node contains an invalid entry list.");
        }
        const keys = new Set<string>();
        for (const entry of node.entries) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
            fail("INVALID_IR", "An object IR node contains an invalid entry.");
          }
          const [key, value] = entry;
          assertWellFormedUnicode(key);
          if (keys.has(key)) fail("INVALID_IR", "An object IR node contains a duplicate key.");
          keys.add(key);
          pending.push(value);
        }
        break;
      }
      default:
        fail("INVALID_IR", "An IR node has an unsupported kind.");
    }
  }
  const calculated = createMorphIR(ir.root, ir.inputKind).semanticDigest;
  if (calculated !== ir.semanticDigest) {
    fail("SEMANTIC_DIGEST_MISMATCH", "The IR semantic digest does not match its content.");
  }
}

export function readInputIdentity(metadata: Readonly<Record<string, unknown>>): InputIdentity {
  requireLiteral(metadata, "irVersion", "morph-ir/1");
  const inputKind = metadata.inputKind;
  if (inputKind !== "json-text" && inputKind !== "js-value") {
    fail(
      "INVALID_LAYOUT_METADATA",
      "The representation has an unsupported input kind.",
      undefined,
      {
        field: "inputKind",
      },
    );
  }
  const semanticDigest = requireString(metadata, "semanticDigest");
  if (!/^[0-9a-f]{64}$/.test(semanticDigest)) {
    fail("INVALID_LAYOUT_METADATA", "The representation semantic digest is malformed.", undefined, {
      field: "semanticDigest",
    });
  }
  return { inputKind, semanticDigest };
}

export function finishDecodedIr(
  root: IRNode,
  metadata: Readonly<Record<string, unknown>>,
): MorphIR {
  const identity = readInputIdentity(metadata);
  const ir = createMorphIR(root, identity.inputKind);
  if (ir.semanticDigest !== identity.semanticDigest) {
    fail(
      "SEMANTIC_DIGEST_MISMATCH",
      "Decoded content does not match the representation semantic digest.",
    );
  }
  return ir;
}

export function assertPayloadBounds(payload: string): void {
  if (typeof payload !== "string") {
    fail("INVALID_ENCODED_SECTION", "The encoded payload must be a string.");
  }
  const payloadBytes = textEncoder.encode(payload).byteLength;
  if (payloadBytes > MAX_DECODE_BYTES) {
    fail(
      "MAX_RENDERED_BYTES_EXCEEDED",
      "The encoded payload exceeds the decoder byte limit.",
      undefined,
      {
        maximum: MAX_DECODE_BYTES,
        payloadBytes,
      },
    );
  }
}

export function parsePayloadNode(payload: string): IRNode {
  assertPayloadBounds(payload);
  return parseJsonNode(payload, {
    maxInputBytes: MAX_DECODE_BYTES,
    maxDepth: MAX_DECODE_DEPTH,
    maxNodes: MAX_DECODE_NODES,
  });
}

export function countNodesBounded(root: IRNode, maximum = MAX_DECODE_NODES): number {
  const pending: IRNode[] = [root];
  let count = 0;
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    count += 1;
    if (count > maximum) {
      fail("MAX_NODES_EXCEEDED", "Decoded content exceeds the node limit.", undefined, {
        maximum,
      });
    }
    if (node.kind === "array") {
      for (const item of node.items) pending.push(item);
    } else if (node.kind === "object") {
      for (const [, value] of node.entries) pending.push(value);
    }
  }
  return count;
}

export function assertSection(
  section: EncodedSection,
  encoding: string,
  formatVersion: string,
  interpretationGuideId: string,
  metadataKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (section === null || typeof section !== "object") {
    fail("INVALID_ENCODED_SECTION", "The encoded section must be an object.");
  }
  if (section.encoding !== encoding || section.formatVersion !== formatVersion) {
    fail(
      "UNSUPPORTED_FORMAT_VERSION",
      "The encoded section does not match this decoder.",
      undefined,
      {
        expectedEncoding: encoding,
        expectedFormatVersion: formatVersion,
      },
    );
  }
  if (section.interpretationGuideId !== interpretationGuideId) {
    fail("INVALID_ENCODED_SECTION", "The encoded section uses an unexpected interpretation guide.");
  }
  assertPayloadBounds(section.payload);
  const metadata = assertRecord(
    section.layoutMetadata,
    "INVALID_LAYOUT_METADATA",
    "Layout metadata must be an object.",
  );
  assertAllowedKeys(metadata, ["irVersion", "inputKind", "semanticDigest", ...metadataKeys]);
  readInputIdentity(metadata);
  return metadata;
}

export function planIssues(
  plan: EncoderPlan,
  encoding: string,
  formatVersion: string,
  optionKeys: readonly string[],
): readonly string[] {
  const issues: string[] = [];
  if (plan.encoding !== encoding) issues.push("PLAN_ENCODING_MISMATCH");
  if (plan.formatVersion !== formatVersion) issues.push("PLAN_VERSION_MISMATCH");
  if (!isRecord(plan.options)) {
    issues.push("PLAN_OPTIONS_INVALID");
  } else {
    const allowed = new Set(optionKeys);
    if (Object.keys(plan.options).some((key) => !allowed.has(key))) {
      issues.push("PLAN_OPTIONS_INVALID");
    }
  }
  return issues;
}

export function assertPlan(
  plan: EncoderPlan,
  encoding: string,
  formatVersion: string,
  optionKeys: readonly string[],
): void {
  const issues = planIssues(plan, encoding, formatVersion, optionKeys);
  if (issues.length > 0) {
    fail("INVALID_ENCODER_PLAN", "The encoder plan is not supported by this encoder.", undefined, {
      reasons: issues,
    });
  }
}

export function isPrimitiveNode(node: IRNode): boolean {
  return (
    node.kind === "null" ||
    node.kind === "boolean" ||
    node.kind === "string" ||
    node.kind === "number"
  );
}

export function inspectUniformPrimitiveTable(ir: MorphIR): {
  readonly table?: UniformPrimitiveTable;
  readonly reasons: readonly string[];
} {
  if (ir.root.kind !== "array") return { reasons: ["ROOT_NOT_ARRAY"] };
  if (ir.root.items.length === 0) return { reasons: ["EMPTY_RECORD_ARRAY"] };
  const first = ir.root.items[0];
  if (first?.kind !== "object") return { reasons: ["ELEMENT_NOT_OBJECT"] };
  const fields = first.entries.map(([key]) => key);
  if (fields.length === 0) return { reasons: ["ZERO_COLUMN_RECORDS"] };
  if (new Set(fields).size !== fields.length) return { reasons: ["DUPLICATE_FIELD"] };

  const expected = new Set(fields);
  const rows: Extract<IRNode, { readonly kind: "object" }>[] = [];
  for (const item of ir.root.items) {
    if (item.kind !== "object") return { reasons: ["ELEMENT_NOT_OBJECT"] };
    const keys = item.entries.map(([key]) => key);
    if (new Set(keys).size !== keys.length) return { reasons: ["DUPLICATE_FIELD"] };
    if (keys.length !== fields.length || keys.some((key) => !expected.has(key))) {
      return { reasons: ["NON_UNIFORM_KEY_SET"] };
    }
    if (item.entries.some(([, value]) => !isPrimitiveNode(value))) {
      return { reasons: ["NON_PRIMITIVE_CELL"] };
    }
    rows.push(item);
  }
  return { table: { fields, rows }, reasons: [] };
}

export function requireUniformPrimitiveTable(ir: MorphIR): UniformPrimitiveTable {
  const result = inspectUniformPrimitiveTable(ir);
  if (result.table === undefined) {
    fail(
      "ENCODER_NOT_APPLICABLE",
      "The encoder requires a nonempty uniform primitive record array.",
      undefined,
      {
        reasons: result.reasons,
      },
    );
  }
  return result.table;
}

export function primitiveText(node: IRNode): string {
  if (!isPrimitiveNode(node)) {
    fail("INVALID_PRIMITIVE_CELL", "A table cell must contain a JSON primitive.");
  }
  return printJsonNode(node);
}

export function parsePrimitiveText(text: string): IRNode {
  if (text.trim() !== text || text.length === 0) {
    fail("INVALID_PRIMITIVE_CELL", "A table cell must be one JSON scalar token.");
  }
  const node = parsePayloadNode(text);
  if (!isPrimitiveNode(node)) {
    fail("INVALID_PRIMITIVE_CELL", "A table cell must contain a JSON primitive.");
  }
  if (node.kind === "number") assertJsonNumberLexeme(node.lexeme);
  return node;
}

export function entriesByKey(
  row: Extract<IRNode, { readonly kind: "object" }>,
): ReadonlyMap<string, IRNode> {
  const result = new Map<string, IRNode>();
  for (const [key, value] of row.entries) {
    if (result.has(key)) fail("INVALID_IR", "An object contains a duplicate key.");
    result.set(key, value);
  }
  return result;
}
