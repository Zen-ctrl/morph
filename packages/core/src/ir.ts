import { compareCodeUnits, semanticDigest } from "./canonical.js";
import { fail } from "./errors.js";
import { appendJsonPointer } from "./pointer.js";
import type { IRNode, MorphIR, ParseLimits } from "./types.js";

export const DEFAULT_PARSE_LIMITS: ParseLimits = {
  maxInputBytes: 5 * 1024 * 1024,
  maxDepth: 64,
  maxNodes: 250_000,
};

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const JSON_NUMBER_PREFIX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

export function isJsonNumberLexeme(value: string): boolean {
  return JSON_NUMBER.test(value);
}

export function assertJsonNumberLexeme(value: string, path?: string): void {
  if (!isJsonNumberLexeme(value)) {
    fail("INVALID_NUMBER_LEXEME", "The value is not a valid JSON number token.", path);
  }
}

export function assertWellFormedUnicode(value: string, path?: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("LONE_SURROGATE", "Strings must contain well-formed Unicode scalar values.", path);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("LONE_SURROGATE", "Strings must contain well-formed Unicode scalar values.", path);
    }
  }
}

export function createMorphIR(root: IRNode, inputKind: "json-text" | "js-value"): MorphIR {
  return {
    irVersion: "morph-ir/1",
    root,
    inputKind,
    semanticDigest: semanticDigest(root),
  };
}

class StrictJsonParser {
  private index = 0;
  private nodes = 0;

  constructor(
    private readonly text: string,
    private readonly limits: ParseLimits,
  ) {}

  parse(): IRNode {
    this.skipWhitespace();
    const value = this.parseValue(0, "");
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      fail("INVALID_JSON", "Unexpected content after the JSON value.", "", {
        offset: this.index,
      });
    }
    return value;
  }

  private countNode(path: string): void {
    this.nodes += 1;
    if (this.nodes > this.limits.maxNodes) {
      fail("MAX_NODES_EXCEEDED", "The input exceeds the configured node limit.", path, {
        maxNodes: this.limits.maxNodes,
      });
    }
  }

  private parseValue(depth: number, path: string): IRNode {
    if (depth > this.limits.maxDepth) {
      fail("MAX_DEPTH_EXCEEDED", "The input exceeds the configured nesting depth.", path, {
        maxDepth: this.limits.maxDepth,
      });
    }
    this.countNode(path);
    const current = this.text[this.index];
    if (current === '"') return { kind: "string", value: this.parseString(path) };
    if (current === "{") return this.parseObject(depth, path);
    if (current === "[") return this.parseArray(depth, path);
    if (current === "t") {
      this.expectLiteral("true", path);
      return { kind: "boolean", value: true };
    }
    if (current === "f") {
      this.expectLiteral("false", path);
      return { kind: "boolean", value: false };
    }
    if (current === "n") {
      this.expectLiteral("null", path);
      return { kind: "null" };
    }
    if (current === "-" || (current !== undefined && current >= "0" && current <= "9")) {
      return { kind: "number", lexeme: this.parseNumber(path) };
    }
    fail("INVALID_JSON", "Expected a JSON value.", path, { offset: this.index });
  }

  private parseObject(depth: number, path: string): IRNode {
    this.index += 1;
    this.skipWhitespace();
    const entries: Array<readonly [string, IRNode]> = [];
    const keys = new Set<string>();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return { kind: "object", entries };
    }
    while (this.index < this.text.length) {
      if (this.text[this.index] !== '"') {
        fail("INVALID_JSON", "Object keys must be JSON strings.", path, { offset: this.index });
      }
      const key = this.parseString(path);
      const keyPath = appendJsonPointer(path, key);
      if (keys.has(key)) {
        fail("DUPLICATE_KEY", "Duplicate object keys are not accepted.", keyPath);
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        fail("INVALID_JSON", "Expected ':' after an object key.", keyPath, {
          offset: this.index,
        });
      }
      this.index += 1;
      this.skipWhitespace();
      entries.push([key, this.parseValue(depth + 1, keyPath)] as const);
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === "}") {
        this.index += 1;
        return { kind: "object", entries };
      }
      if (separator !== ",") {
        fail("INVALID_JSON", "Expected ',' or '}' in an object.", path, {
          offset: this.index,
        });
      }
      this.index += 1;
      this.skipWhitespace();
    }
    fail("INVALID_JSON", "Unterminated JSON object.", path);
  }

  private parseArray(depth: number, path: string): IRNode {
    this.index += 1;
    this.skipWhitespace();
    const items: IRNode[] = [];
    if (this.text[this.index] === "]") {
      this.index += 1;
      return { kind: "array", items };
    }
    while (this.index < this.text.length) {
      const itemPath = appendJsonPointer(path, String(items.length));
      items.push(this.parseValue(depth + 1, itemPath));
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === "]") {
        this.index += 1;
        return { kind: "array", items };
      }
      if (separator !== ",") {
        fail("INVALID_JSON", "Expected ',' or ']' in an array.", path, {
          offset: this.index,
        });
      }
      this.index += 1;
      this.skipWhitespace();
    }
    fail("INVALID_JSON", "Unterminated JSON array.", path);
  }

  private parseString(path: string): string {
    this.index += 1;
    let result = "";
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (character === '"') {
        this.index += 1;
        assertWellFormedUnicode(result, path);
        return result;
      }
      if (character === "\\") {
        this.index += 1;
        result += this.parseEscape(path);
        continue;
      }
      if (character === undefined) break;
      const code = character.charCodeAt(0);
      if (code < 0x20) {
        fail("INVALID_JSON", "Unescaped control characters are not valid in JSON strings.", path, {
          offset: this.index,
        });
      }
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = this.text[this.index + 1];
        const nextCode = next?.charCodeAt(0) ?? 0;
        if (!(nextCode >= 0xdc00 && nextCode <= 0xdfff)) {
          fail("LONE_SURROGATE", "Strings must contain well-formed Unicode scalar values.", path);
        }
        result += character + next;
        this.index += 2;
        continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff) {
        fail("LONE_SURROGATE", "Strings must contain well-formed Unicode scalar values.", path);
      }
      result += character;
      this.index += 1;
    }
    fail("INVALID_JSON", "Unterminated JSON string.", path);
  }

  private parseEscape(path: string): string {
    const escapeSequence = this.text[this.index];
    this.index += 1;
    switch (escapeSequence) {
      case '"':
      case "\\":
      case "/":
        return escapeSequence;
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "u": {
        const first = this.parseHexCodeUnit(path);
        if (first >= 0xd800 && first <= 0xdbff) {
          if (this.text.slice(this.index, this.index + 2) !== "\\u") {
            fail(
              "LONE_SURROGATE",
              "A high surrogate escape must be followed by a low surrogate.",
              path,
            );
          }
          this.index += 2;
          const second = this.parseHexCodeUnit(path);
          if (!(second >= 0xdc00 && second <= 0xdfff)) {
            fail(
              "LONE_SURROGATE",
              "A high surrogate escape must be followed by a low surrogate.",
              path,
            );
          }
          return String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
        }
        if (first >= 0xdc00 && first <= 0xdfff) {
          fail("LONE_SURROGATE", "A low surrogate escape cannot appear alone.", path);
        }
        return String.fromCharCode(first);
      }
      default:
        return fail("INVALID_JSON", "Invalid JSON string escape.", path, {
          offset: this.index - 1,
        });
    }
  }

  private parseHexCodeUnit(path: string): number {
    const digits = this.text.slice(this.index, this.index + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) {
      fail("INVALID_JSON", "A Unicode escape must contain four hexadecimal digits.", path, {
        offset: this.index,
      });
    }
    this.index += 4;
    return Number.parseInt(digits, 16);
  }

  private parseNumber(path: string): string {
    const match = JSON_NUMBER_PREFIX.exec(this.text.slice(this.index));
    if (match === null) {
      fail("INVALID_JSON", "Invalid JSON number.", path, { offset: this.index });
    }
    const lexeme = match[0];
    this.index += lexeme.length;
    const next = this.text[this.index];
    if (next !== undefined && !/[\s,}\]]/.test(next)) {
      fail("INVALID_JSON", "Invalid character after a JSON number.", path, {
        offset: this.index,
      });
    }
    assertJsonNumberLexeme(lexeme, path);
    return lexeme;
  }

  private expectLiteral(literal: string, path: string): void {
    if (this.text.slice(this.index, this.index + literal.length) !== literal) {
      fail("INVALID_JSON", `Expected '${literal}'.`, path, { offset: this.index });
    }
    this.index += literal.length;
  }

  private skipWhitespace(): void {
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (character === " " || character === "\t" || character === "\n" || character === "\r") {
        this.index += 1;
      } else {
        return;
      }
    }
  }
}

function resolveLimits(limits?: Partial<ParseLimits>): ParseLimits {
  const resolved = { ...DEFAULT_PARSE_LIMITS, ...limits };
  for (const [key, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail("INVALID_LIMIT", `${key} must be a nonnegative safe integer.`);
    }
  }
  return resolved;
}

export function parseJsonStrict(text: string, limits?: Partial<ParseLimits>): MorphIR {
  if (typeof text !== "string") fail("INVALID_INPUT", "JSON input must be a string.");
  const resolved = resolveLimits(limits);
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > resolved.maxInputBytes) {
    fail("MAX_INPUT_BYTES_EXCEEDED", "The input exceeds the configured byte limit.", "", {
      maxInputBytes: resolved.maxInputBytes,
      inputBytes: byteLength,
    });
  }
  const root = new StrictJsonParser(text, resolved).parse();
  return createMorphIR(root, "json-text");
}

export function parseJsonNode(text: string, limits?: Partial<ParseLimits>): IRNode {
  return parseJsonStrict(text, limits).root;
}

export function fromJsValue(value: unknown, limits?: Partial<ParseLimits>): MorphIR {
  const resolved = resolveLimits(limits);
  let nodes = 0;
  const visiting = new WeakSet<object>();

  const visit = (current: unknown, depth: number, path: string): IRNode => {
    if (depth > resolved.maxDepth) {
      fail("MAX_DEPTH_EXCEEDED", "The input exceeds the configured nesting depth.", path, {
        maxDepth: resolved.maxDepth,
      });
    }
    nodes += 1;
    if (nodes > resolved.maxNodes) {
      fail("MAX_NODES_EXCEEDED", "The input exceeds the configured node limit.", path, {
        maxNodes: resolved.maxNodes,
      });
    }
    if (current === null) return { kind: "null" };
    switch (typeof current) {
      case "boolean":
        return { kind: "boolean", value: current };
      case "string":
        assertWellFormedUnicode(current, path);
        return { kind: "string", value: current };
      case "number": {
        if (!Number.isFinite(current)) {
          fail("UNSUPPORTED_JS_VALUE", "Nonfinite numbers are not JSON-compatible.", path);
        }
        const lexeme = Object.is(current, -0) ? "-0" : String(current);
        assertJsonNumberLexeme(lexeme, path);
        return { kind: "number", lexeme };
      }
      case "bigint":
        return fail(
          "UNSUPPORTED_JS_VALUE",
          "BigInt is not accepted. Supply exact large JSON numbers through the JSON-text entry point.",
          path,
        );
      case "undefined":
      case "function":
      case "symbol":
        return fail(
          "UNSUPPORTED_JS_VALUE",
          `Values of type ${typeof current} are not JSON-compatible.`,
          path,
        );
      case "object":
        break;
    }

    const object = current as object;
    if (visiting.has(object)) {
      fail("CYCLIC_JS_VALUE", "Cyclic JavaScript values are not accepted.", path);
    }
    visiting.add(object);
    try {
      if (Array.isArray(object)) {
        if (Object.getPrototypeOf(object) !== Array.prototype) {
          fail("UNSUPPORTED_JS_VALUE", "Array subclasses are not accepted.", path);
        }
        const keys = Reflect.ownKeys(object);
        for (const key of keys) {
          if (typeof key === "symbol") {
            fail("UNSUPPORTED_JS_VALUE", "Symbol properties are not accepted.", path);
          }
          if (key !== "length") {
            const index = Number(key);
            const isArrayIndex =
              /^(?:0|[1-9]\d*)$/.test(key) &&
              Number.isSafeInteger(index) &&
              index >= 0 &&
              index < 0xffff_ffff &&
              String(index) === key;
            if (!isArrayIndex) {
              fail("UNSUPPORTED_JS_VALUE", "Arrays with extra properties are not accepted.", path);
            }
          }
        }
        const items: IRNode[] = [];
        for (let index = 0; index < object.length; index += 1) {
          const itemPath = appendJsonPointer(path, String(index));
          const descriptor = Object.getOwnPropertyDescriptor(object, String(index));
          if (descriptor === undefined) {
            fail("SPARSE_ARRAY", "Sparse JavaScript arrays are not accepted.", itemPath);
          }
          if (!("value" in descriptor)) {
            fail("ACCESSOR_PROPERTY", "Accessor properties are not accepted.", itemPath);
          }
          items.push(visit(descriptor.value, depth + 1, itemPath));
        }
        return { kind: "array", items };
      }

      const prototype = Object.getPrototypeOf(object);
      if (prototype !== Object.prototype && prototype !== null) {
        fail(
          "UNSUPPORTED_JS_VALUE",
          "Only ordinary objects and null-prototype objects are accepted.",
          path,
        );
      }
      const entries: Array<readonly [string, IRNode]> = [];
      for (const key of Reflect.ownKeys(object)) {
        if (typeof key === "symbol") {
          fail("UNSUPPORTED_JS_VALUE", "Symbol properties are not accepted.", path);
        }
        const keyPath = appendJsonPointer(path, key);
        assertWellFormedUnicode(key, keyPath);
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (descriptor === undefined || !("value" in descriptor)) {
          fail("ACCESSOR_PROPERTY", "Accessor properties are not accepted.", keyPath);
        }
        if (!descriptor.enumerable) {
          fail("UNSUPPORTED_JS_VALUE", "Non-enumerable properties are not accepted.", keyPath);
        }
        entries.push([key, visit(descriptor.value, depth + 1, keyPath)] as const);
      }
      return { kind: "object", entries };
    } finally {
      visiting.delete(object);
    }
  };

  const root = visit(value, 0, "");
  const byteLength = new TextEncoder().encode(printJsonNode(root)).byteLength;
  if (byteLength > resolved.maxInputBytes) {
    fail("MAX_INPUT_BYTES_EXCEEDED", "The input exceeds the configured byte limit.", "", {
      maxInputBytes: resolved.maxInputBytes,
      inputBytes: byteLength,
    });
  }
  return createMorphIR(root, "js-value");
}

export function printJsonNode(node: IRNode, sortObjectKeys = false): string {
  switch (node.kind) {
    case "null":
      return "null";
    case "boolean":
      return node.value ? "true" : "false";
    case "string":
      return JSON.stringify(node.value);
    case "number":
      assertJsonNumberLexeme(node.lexeme);
      return node.lexeme;
    case "array":
      return `[${node.items.map((item) => printJsonNode(item, sortObjectKeys)).join(",")}]`;
    case "object": {
      const entries = sortObjectKeys
        ? [...node.entries].sort(([left], [right]) => compareCodeUnits(left, right))
        : node.entries;
      return `{${entries
        .map(([key, value]) => `${JSON.stringify(key)}:${printJsonNode(value, sortObjectKeys)}`)
        .join(",")}}`;
    }
  }
}

export function printJson(ir: MorphIR, sortObjectKeys = false): string {
  return printJsonNode(ir.root, sortObjectKeys);
}

export function semanticEqual(left: MorphIR | IRNode, right: MorphIR | IRNode): boolean {
  const leftNode = "irVersion" in left ? left.root : left;
  const rightNode = "irVersion" in right ? right.root : right;
  if (leftNode.kind !== rightNode.kind) return false;
  switch (leftNode.kind) {
    case "null":
      return true;
    case "boolean":
    case "string":
      return leftNode.value === (rightNode as typeof leftNode).value;
    case "number":
      return leftNode.lexeme === (rightNode as typeof leftNode).lexeme;
    case "array": {
      const rightArray = rightNode as typeof leftNode;
      return (
        leftNode.items.length === rightArray.items.length &&
        leftNode.items.every((item, index) =>
          semanticEqual(item, rightArray.items[index] as IRNode),
        )
      );
    }
    case "object": {
      const rightObject = rightNode as typeof leftNode;
      if (leftNode.entries.length !== rightObject.entries.length) return false;
      const rightMap = new Map(rightObject.entries);
      return leftNode.entries.every(([key, value]) => {
        const counterpart = rightMap.get(key);
        return counterpart !== undefined && semanticEqual(value, counterpart);
      });
    }
  }
}

export function irNodeToJsonCompatible(node: IRNode): unknown {
  switch (node.kind) {
    case "null":
      return null;
    case "boolean":
    case "string":
      return node.value;
    case "number": {
      const value = Number(node.lexeme);
      if (!Number.isFinite(value) || String(value) !== node.lexeme) {
        fail(
          "PRECISION_UNSAFE_CONVERSION",
          "The numeric lexeme cannot be converted to a JavaScript number without changing its representation.",
        );
      }
      return value;
    }
    case "array":
      return node.items.map(irNodeToJsonCompatible);
    case "object": {
      const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const [key, value] of node.entries) {
        Object.defineProperty(result, key, {
          value: irNodeToJsonCompatible(value),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
  }
}
