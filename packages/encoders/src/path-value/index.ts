import type {
  EncodedSection,
  EncoderApplicability,
  EncoderPlan,
  IRNode,
  MorphEncoder,
  MorphIR,
  MorphTask,
} from "@morph/core";
import {
  assertJsonNumberLexeme,
  escapeJsonPointerSegment,
  fail,
  parseJsonPointer,
} from "@morph/core";
import {
  assertPlan,
  assertSection,
  baseMetadata,
  finishDecodedIr,
  MAX_DECODE_DEPTH,
  MAX_DECODE_NODES,
  parsePayloadNode,
  planIssues,
  requireLiteral,
  requireSafeInteger,
} from "../shared.js";

export const PATH_VALUE_FORMAT_VERSION = "1";
export const PATH_VALUE_GUIDE_ID = "morph-guide/path-value";
export const PATH_VALUE_GUIDE_VERSION = "1";
export const PATH_VALUE_GUIDE_TEXT =
  "Each payload line is a typed JSON array describing one node. The first item is an RFC 6901 JSON Pointer, with the empty string naming the root. Object and array records declare containers, array records include item count, and scalar records include an explicit type tag and value. Number values are exact JSON numeric lexemes stored as strings. Parent container types distinguish object keys from array indexes.";

interface DescriptorBase {
  readonly path: string;
  readonly segments: readonly string[];
  readonly order: number;
}

type Descriptor =
  | (DescriptorBase & { readonly type: "object" })
  | (DescriptorBase & { readonly type: "array"; readonly itemCount: number })
  | (DescriptorBase & {
      readonly type: "scalar";
      readonly node: Exclude<IRNode, { readonly kind: "object" } | { readonly kind: "array" }>;
    });

interface ChildDescriptor {
  readonly segment: string;
  readonly descriptor: Descriptor;
}

function pointerFromSegments(segments: readonly string[]): string {
  return segments.map((segment) => `/${escapeJsonPointerSegment(segment)}`).join("");
}

function stringItem(items: readonly IRNode[], index: number, field: string): string {
  const item = items[index];
  if (item?.kind !== "string") {
    fail(
      "INVALID_PATH_VALUE_RECORD",
      "A typed node record field must be a JSON string.",
      undefined,
      {
        field,
      },
    );
  }
  return item.value;
}

function exactArity(items: readonly IRNode[], expected: number, tag: string): void {
  if (items.length !== expected) {
    fail("INVALID_PATH_VALUE_RECORD", "A typed node record has incorrect arity.", undefined, {
      tag,
      expected,
      actual: items.length,
    });
  }
}

function parseDescriptor(line: string, order: number): Descriptor {
  const record = parsePayloadNode(line);
  if (record.kind !== "array") {
    fail("INVALID_PATH_VALUE_RECORD", "Each path/value line must be a JSON array.");
  }
  if (record.items.length < 2) {
    fail("INVALID_PATH_VALUE_RECORD", "A typed node record is missing its path or type tag.");
  }
  const path = stringItem(record.items, 0, "path");
  const tag = stringItem(record.items, 1, "tag");
  const segments = parseJsonPointer(path);
  if (segments.length > MAX_DECODE_DEPTH) {
    fail("MAX_DEPTH_EXCEEDED", "A path/value record exceeds the decoder depth limit.", path, {
      maximum: MAX_DECODE_DEPTH,
    });
  }
  if (pointerFromSegments(segments) !== path) {
    fail("INVALID_JSON_POINTER", "A path/value record uses a noncanonical JSON Pointer.", path);
  }
  const base = { path, segments, order } as const;

  switch (tag) {
    case "object":
      exactArity(record.items, 2, tag);
      return { ...base, type: "object" };
    case "array": {
      exactArity(record.items, 3, tag);
      const countNode = record.items[2];
      if (countNode?.kind !== "number" || !/^(?:0|[1-9]\d*)$/.test(countNode.lexeme)) {
        fail(
          "INVALID_PATH_VALUE_RECORD",
          "An array record must contain a canonical nonnegative item count.",
        );
      }
      const itemCount = Number(countNode.lexeme);
      if (!Number.isSafeInteger(itemCount) || itemCount > MAX_DECODE_NODES) {
        fail(
          "INVALID_PATH_VALUE_RECORD",
          "An array record item count is outside the supported range.",
        );
      }
      return { ...base, type: "array", itemCount };
    }
    case "string":
      exactArity(record.items, 3, tag);
      return {
        ...base,
        type: "scalar",
        node: { kind: "string", value: stringItem(record.items, 2, "value") },
      };
    case "number": {
      exactArity(record.items, 3, tag);
      const lexeme = stringItem(record.items, 2, "value");
      assertJsonNumberLexeme(lexeme, path);
      return { ...base, type: "scalar", node: { kind: "number", lexeme } };
    }
    case "boolean": {
      exactArity(record.items, 3, tag);
      const value = record.items[2];
      if (value?.kind !== "boolean") {
        fail("INVALID_PATH_VALUE_RECORD", "A boolean record must contain a JSON boolean value.");
      }
      return { ...base, type: "scalar", node: { kind: "boolean", value: value.value } };
    }
    case "null":
      exactArity(record.items, 2, tag);
      return { ...base, type: "scalar", node: { kind: "null" } };
    default:
      fail("INVALID_PATH_VALUE_RECORD", "A path/value record has an unsupported type tag.");
  }
}

function recordFor(path: string, node: IRNode): string {
  switch (node.kind) {
    case "object":
      return JSON.stringify([path, "object"]);
    case "array":
      return JSON.stringify([path, "array", node.items.length]);
    case "string":
      return JSON.stringify([path, "string", node.value]);
    case "number":
      assertJsonNumberLexeme(node.lexeme, path);
      return JSON.stringify([path, "number", node.lexeme]);
    case "boolean":
      return JSON.stringify([path, "boolean", node.value]);
    case "null":
      return JSON.stringify([path, "null"]);
  }
}

function encodeRecords(root: IRNode): readonly string[] {
  const lines: string[] = [];
  const pending: Array<{ readonly path: string; readonly node: IRNode }> = [
    { path: "", node: root },
  ];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    lines.push(recordFor(current.path, current.node));
    if (current.node.kind === "array") {
      for (let index = current.node.items.length - 1; index >= 0; index -= 1) {
        const child = current.node.items[index];
        if (child !== undefined) {
          pending.push({ path: `${current.path}/${index}`, node: child });
        }
      }
    } else if (current.node.kind === "object") {
      for (let index = current.node.entries.length - 1; index >= 0; index -= 1) {
        const entry = current.node.entries[index];
        if (entry !== undefined) {
          const [key, child] = entry;
          pending.push({ path: `${current.path}/${escapeJsonPointerSegment(key)}`, node: child });
        }
      }
    }
  }
  return lines;
}

export class PathValueEncoder implements MorphEncoder {
  readonly id = "path-value";
  readonly formatVersion = PATH_VALUE_FORMAT_VERSION;
  readonly interpretationGuideId = PATH_VALUE_GUIDE_ID;
  readonly interpretationGuideVersion = PATH_VALUE_GUIDE_VERSION;
  readonly interpretationGuideText = PATH_VALUE_GUIDE_TEXT;
  readonly mechanismCount = 2;

  supports(_ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const reasons = planIssues(plan, this.id, this.formatVersion, []);
    return { supported: reasons.length === 0, reasons };
  }

  enumerate(_ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    return [{ encoding: this.id, formatVersion: this.formatVersion, options: {} }];
  }

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    assertPlan(plan, this.id, this.formatVersion, []);
    const lines = encodeRecords(ir.root);
    return {
      encoding: this.id,
      formatVersion: this.formatVersion,
      payload: lines.join("\n"),
      layoutMetadata: {
        ...baseMetadata(ir),
        root: "typed-node-records",
        recordCount: lines.length,
        pointer: "rfc6901",
        recordCodec: "typed-json-lines-v1",
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
      ["root", "recordCount", "pointer", "recordCodec"],
    );
    requireLiteral(metadata, "root", "typed-node-records");
    requireLiteral(metadata, "pointer", "rfc6901");
    requireLiteral(metadata, "recordCodec", "typed-json-lines-v1");
    const recordCount = requireSafeInteger(metadata, "recordCount", MAX_DECODE_NODES);
    if (recordCount === 0) {
      fail("INVALID_PATH_VALUE_PAYLOAD", "A path/value payload must contain one root record.");
    }
    if (section.payload.includes("\r")) {
      fail("INVALID_PATH_VALUE_PAYLOAD", "Path/value records use U+000A as the line separator.");
    }
    if (section.payload.length === 0 || section.payload.endsWith("\n")) {
      fail(
        "INVALID_PATH_VALUE_PAYLOAD",
        "The path/value payload is empty or has a trailing empty record.",
      );
    }
    const lines = section.payload.split("\n");
    if (lines.length !== recordCount) {
      fail(
        "COUNT_MISMATCH",
        "The declared path/value record count does not match the payload.",
        undefined,
        {
          declared: recordCount,
          actual: lines.length,
        },
      );
    }

    const descriptors = new Map<string, Descriptor>();
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || line.length === 0) {
        fail("INVALID_PATH_VALUE_PAYLOAD", "Every path/value line must contain one typed record.");
      }
      const descriptor = parseDescriptor(line, index);
      if (descriptors.has(descriptor.path)) {
        fail(
          "DUPLICATE_NODE_PATH",
          "A path/value payload contains a duplicate node path.",
          descriptor.path,
        );
      }
      descriptors.set(descriptor.path, descriptor);
    }

    const rootDescriptor = descriptors.get("");
    if (rootDescriptor === undefined) {
      fail("MISSING_ROOT", "A path/value payload must contain exactly one root record.");
    }

    const children = new Map<string, ChildDescriptor[]>();
    for (const descriptor of descriptors.values()) {
      if (descriptor.path === "") continue;
      const parentSegments = descriptor.segments.slice(0, -1);
      const segment = descriptor.segments[descriptor.segments.length - 1];
      if (segment === undefined) {
        fail("INVALID_JSON_POINTER", "A non-root node path must contain a final pointer segment.");
      }
      const parentPath = pointerFromSegments(parentSegments);
      const parent = descriptors.get(parentPath);
      if (parent === undefined) {
        fail(
          "MISSING_PARENT",
          "A path/value node is missing its parent container.",
          descriptor.path,
        );
      }
      if (parent.type === "scalar") {
        fail(
          "CHILD_UNDER_PRIMITIVE",
          "A primitive path/value node cannot contain children.",
          descriptor.path,
        );
      }
      if (parent.type === "array") {
        if (!/^(?:0|[1-9]\d*)$/.test(segment)) {
          fail(
            "INVALID_ARRAY_INDEX",
            "An array child path must end in a canonical nonnegative index.",
            descriptor.path,
          );
        }
        const index = Number(segment);
        if (!Number.isSafeInteger(index) || index >= parent.itemCount) {
          fail(
            "ARRAY_INDEX_OUT_OF_RANGE",
            "An array child index is outside the declared range.",
            descriptor.path,
          );
        }
      }
      const siblings = children.get(parentPath);
      const child = { segment, descriptor };
      if (siblings === undefined) children.set(parentPath, [child]);
      else siblings.push(child);
    }

    for (const descriptor of descriptors.values()) {
      if (descriptor.type !== "array") continue;
      const arrayChildren = children.get(descriptor.path) ?? [];
      if (arrayChildren.length !== descriptor.itemCount) {
        fail(
          "ARRAY_LENGTH_MISMATCH",
          "An array record does not have its declared number of children.",
          descriptor.path,
          {
            declared: descriptor.itemCount,
            actual: arrayChildren.length,
          },
        );
      }
      const indexes = new Set(arrayChildren.map((child) => Number(child.segment)));
      for (let index = 0; index < descriptor.itemCount; index += 1) {
        if (!indexes.has(index)) {
          fail("ARRAY_HOLE", "A path/value array contains a missing index.", descriptor.path, {
            index,
          });
        }
      }
    }

    const buildNode = (descriptor: Descriptor): IRNode => {
      if (descriptor.type === "scalar") return descriptor.node;
      const nodeChildren = children.get(descriptor.path) ?? [];
      if (descriptor.type === "object") {
        const ordered = [...nodeChildren].sort(
          (left, right) => left.descriptor.order - right.descriptor.order,
        );
        return {
          kind: "object",
          entries: ordered.map((child) => [child.segment, buildNode(child.descriptor)] as const),
        };
      }
      const items = new Array<IRNode>(descriptor.itemCount);
      for (const child of nodeChildren) {
        const index = Number(child.segment);
        items[index] = buildNode(child.descriptor);
      }
      if (items.some((item) => item === undefined)) {
        fail("ARRAY_HOLE", "A path/value array contains a missing index.", descriptor.path);
      }
      return { kind: "array", items };
    };

    return finishDecodedIr(buildNode(rootDescriptor), metadata);
  }
}

export const pathValueEncoder: MorphEncoder = new PathValueEncoder();
