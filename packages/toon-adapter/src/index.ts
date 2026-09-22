import {
  createMorphIR,
  type EncodedSection,
  type EncoderApplicability,
  type EncoderPlan,
  fail,
  fromJsValue,
  type IRNode,
  type MorphEncoder,
  type MorphIR,
  type MorphTask,
  semanticEqual,
} from "@morph/core";
import {
  type Delimiter,
  decode as decodeToon,
  encode as encodeToon,
  type JsonValue,
} from "@toon-format/toon";

export const TOON_PACKAGE_NAME = "@toon-format/toon";
export const TOON_PACKAGE_VERSION = "4.1.1";
export const TOON_FORMAT_VERSION = "4.1.1";
export const TOON_GUIDE_ID = "morph-guide/toon-official";
export const TOON_GUIDE_VERSION = "1";

export const TOON_INTERPRETATION_GUIDE =
  "The data block uses official TOON 4.1.1. Read indented key and value lines as objects. " +
  "Bracketed declarations describe arrays and their declared lengths, and braces can declare shared fields for tabular object arrays. " +
  "Use the delimiter named in the layout metadata for inline and tabular values. Preserve array order, all object fields, empty containers, nulls, booleans, numbers, and strings. Quoted strings use TOON escaping.";

const DELIMITERS = [",", "\t", "|"] as const satisfies readonly Delimiter[];
const INDENT_SIZE = 2;
const MAX_TOON_PAYLOAD_BYTES = 16 * 1024 * 1024;

interface ToonPlanOptions {
  readonly delimiter: Delimiter;
  readonly indentSize: typeof INDENT_SIZE;
}

interface ToonLayoutMetadata extends Readonly<Record<string, unknown>> {
  readonly adapter: "official-@toon-format/toon";
  readonly packageVersion: typeof TOON_PACKAGE_VERSION;
  readonly delimiter: Delimiter;
  readonly indentSize: typeof INDENT_SIZE;
  readonly strictDecode: true;
  readonly inputKind: "json-text" | "js-value";
}

function pointer(path: string, segment: string): string {
  const escaped = segment.replaceAll("~", "~0").replaceAll("/", "~1");
  return `${path}/${escaped}`;
}

function validateNumberLexeme(lexeme: string, path: string): string | undefined {
  const value = Number(lexeme);
  if (!Number.isFinite(value)) {
    return `TOON_NUMBER_NONFINITE at ${path || "<root>"}`;
  }
  if (Object.is(value, -0) || String(value) !== lexeme) {
    return `TOON_NUMBER_NONCANONICAL at ${path || "<root>"}`;
  }
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    return `TOON_NUMBER_PRECISION_UNSAFE at ${path || "<root>"}`;
  }
  return undefined;
}

function findUnsupportedNumber(node: IRNode, path = ""): string | undefined {
  switch (node.kind) {
    case "number":
      return validateNumberLexeme(node.lexeme, path);
    case "array":
      for (let index = 0; index < node.items.length; index += 1) {
        const reason = findUnsupportedNumber(
          node.items[index] as IRNode,
          pointer(path, String(index)),
        );
        if (reason !== undefined) return reason;
      }
      return undefined;
    case "object":
      for (const [key, value] of node.entries) {
        const reason = findUnsupportedNumber(value, pointer(path, key));
        if (reason !== undefined) return reason;
      }
      return undefined;
    default:
      return undefined;
  }
}

function irNodeToSafeJsonValue(node: IRNode): JsonValue {
  switch (node.kind) {
    case "null":
      return null;
    case "boolean":
    case "string":
      return node.value;
    case "number": {
      const reason = validateNumberLexeme(node.lexeme, "");
      if (reason !== undefined) {
        fail("ENCODER_NOT_APPLICABLE", "TOON cannot preserve this numeric lexeme exactly.", "", {
          reason,
        });
      }
      return Number(node.lexeme);
    }
    case "array":
      return node.items.map(irNodeToSafeJsonValue);
    case "object": {
      const result = Object.create(null) as Record<string, JsonValue>;
      for (const [key, value] of node.entries) {
        Object.defineProperty(result, key, {
          value: irNodeToSafeJsonValue(value),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
  }
}

function parsePlan(plan: EncoderPlan): ToonPlanOptions | undefined {
  if (plan.encoding !== "toon" || plan.formatVersion !== TOON_FORMAT_VERSION) return undefined;
  const keys = Object.keys(plan.options);
  if (keys.some((key) => key !== "delimiter" && key !== "indentSize")) return undefined;
  const candidateOptions = plan.options as {
    readonly delimiter?: unknown;
    readonly indentSize?: unknown;
  };
  const delimiter = candidateOptions.delimiter;
  const indentSize = candidateOptions.indentSize;
  if (!DELIMITERS.some((candidate) => candidate === delimiter) || indentSize !== INDENT_SIZE) {
    return undefined;
  }
  return { delimiter: delimiter as Delimiter, indentSize: INDENT_SIZE };
}

function requirePlan(plan: EncoderPlan): ToonPlanOptions {
  const options = parsePlan(plan);
  if (options === undefined) {
    fail(
      "INVALID_ENCODER_PLAN",
      "The TOON plan must use format 4.1.1, indent size 2, and an official comma, tab, or pipe delimiter.",
    );
  }
  return options;
}

function parseMetadata(metadata: Readonly<Record<string, unknown>>): ToonLayoutMetadata {
  const expectedKeys = [
    "adapter",
    "packageVersion",
    "delimiter",
    "indentSize",
    "strictDecode",
    "inputKind",
  ];
  const candidate = metadata as {
    readonly adapter?: unknown;
    readonly packageVersion?: unknown;
    readonly delimiter?: unknown;
    readonly indentSize?: unknown;
    readonly strictDecode?: unknown;
    readonly inputKind?: unknown;
  };
  if (
    Object.keys(metadata).length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(metadata, key)) ||
    candidate.adapter !== "official-@toon-format/toon" ||
    candidate.packageVersion !== TOON_PACKAGE_VERSION ||
    !DELIMITERS.some((delimiter) => delimiter === candidate.delimiter) ||
    candidate.indentSize !== INDENT_SIZE ||
    candidate.strictDecode !== true ||
    (candidate.inputKind !== "json-text" && candidate.inputKind !== "js-value")
  ) {
    fail("INVALID_ENCODED_SECTION", "The TOON layout metadata is missing or invalid.");
  }
  return metadata as unknown as ToonLayoutMetadata;
}

function decodePayload(payload: string, metadata: ToonLayoutMetadata): MorphIR {
  const payloadBytes = new TextEncoder().encode(payload).byteLength;
  if (payloadBytes > MAX_TOON_PAYLOAD_BYTES) {
    fail(
      "MAX_RENDERED_BYTES_EXCEEDED",
      "The TOON payload exceeds the adapter's decode allocation limit.",
      "",
      { maxPayloadBytes: MAX_TOON_PAYLOAD_BYTES, payloadBytes },
    );
  }
  let decoded: JsonValue;
  try {
    decoded = decodeToon(payload, {
      indentSize: metadata.indentSize,
      strict: true,
    });
  } catch {
    fail("INVALID_ENCODED_SECTION", "The TOON payload is not valid strict TOON 4.1.1.");
  }

  let decodedJsIr: MorphIR;
  try {
    decodedJsIr = fromJsValue(decoded, {
      maxInputBytes: MAX_TOON_PAYLOAD_BYTES,
      maxDepth: 64,
      maxNodes: 250_000,
    });
  } catch {
    fail(
      "INVALID_ENCODED_SECTION",
      "The decoded TOON value is outside MORPH's accepted value set.",
    );
  }

  const unsupported = findUnsupportedNumber(decodedJsIr.root);
  if (unsupported !== undefined) {
    fail(
      "INVALID_ENCODED_SECTION",
      "The TOON payload contains a number MORPH cannot preserve.",
      "",
      {
        reason: unsupported,
      },
    );
  }

  const canonicalPayload = encodeToon(irNodeToSafeJsonValue(decodedJsIr.root), {
    delimiter: metadata.delimiter,
    indentSize: metadata.indentSize,
  });
  if (canonicalPayload !== payload) {
    fail("INVALID_ENCODED_SECTION", "The TOON payload is not in the adapter's canonical form.");
  }

  return createMorphIR(decodedJsIr.root, metadata.inputKind);
}

function encodeAndVerify(ir: MorphIR, options: ToonPlanOptions): EncodedSection {
  const unsupported = findUnsupportedNumber(ir.root);
  if (unsupported !== undefined) {
    fail("ENCODER_NOT_APPLICABLE", "TOON cannot preserve this numeric lexeme exactly.", "", {
      reason: unsupported,
    });
  }

  const metadata: ToonLayoutMetadata = {
    adapter: "official-@toon-format/toon",
    packageVersion: TOON_PACKAGE_VERSION,
    delimiter: options.delimiter,
    indentSize: options.indentSize,
    strictDecode: true,
    inputKind: ir.inputKind,
  };
  const payload = encodeToon(irNodeToSafeJsonValue(ir.root), options);
  const section: EncodedSection = {
    encoding: "toon",
    formatVersion: TOON_FORMAT_VERSION,
    payload,
    layoutMetadata: metadata,
    interpretationGuideId: TOON_GUIDE_ID,
  };
  const restored = decodePayload(payload, metadata);
  if (!semanticEqual(restored, ir)) {
    fail(
      "ENCODER_NOT_APPLICABLE",
      "The official TOON round trip did not preserve MORPH semantics for this input.",
    );
  }
  return section;
}

export const toonEncoder: MorphEncoder = Object.freeze({
  id: "toon",
  formatVersion: TOON_FORMAT_VERSION,
  interpretationGuideId: TOON_GUIDE_ID,
  interpretationGuideVersion: TOON_GUIDE_VERSION,
  interpretationGuideText: TOON_INTERPRETATION_GUIDE,
  mechanismCount: 2,

  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability {
    const options = parsePlan(plan);
    if (options === undefined) {
      return { supported: false, reasons: ["TOON_PLAN_UNSUPPORTED"] };
    }
    const numberReason = findUnsupportedNumber(ir.root);
    if (numberReason !== undefined) {
      return { supported: false, reasons: [numberReason] };
    }
    return { supported: true, reasons: [] };
  },

  enumerate(_ir: MorphIR, _hints: MorphTask): readonly EncoderPlan[] {
    return DELIMITERS.map((delimiter) => ({
      encoding: "toon",
      formatVersion: TOON_FORMAT_VERSION,
      options: { delimiter, indentSize: INDENT_SIZE },
    }));
  },

  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection {
    return encodeAndVerify(ir, requirePlan(plan));
  },

  decode(section: EncodedSection): MorphIR {
    if (
      section.encoding !== "toon" ||
      section.formatVersion !== TOON_FORMAT_VERSION ||
      section.interpretationGuideId !== TOON_GUIDE_ID ||
      typeof section.payload !== "string"
    ) {
      fail("INVALID_ENCODED_SECTION", "The encoded section is not a supported MORPH TOON section.");
    }
    return decodePayload(section.payload, parseMetadata(section.layoutMetadata));
  },
});

export function createToonEncoder(): MorphEncoder {
  return toonEncoder;
}
