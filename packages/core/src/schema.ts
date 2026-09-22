import type { ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { fail } from "./errors.js";
import { fromJsValue, printJson } from "./ir.js";
import type { IRNode, MorphIR, ParseLimits } from "./types.js";

function inspectReferences(node: IRNode, path: string): void {
  if (node.kind === "array") {
    node.items.forEach((item, index) => {
      inspectReferences(item, `${path}/${index}`);
    });
    return;
  }
  if (node.kind !== "object") return;
  for (const [key, value] of node.entries) {
    const childPath = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (key === "$ref" && value.kind === "string" && !value.value.startsWith("#")) {
      fail(
        "SCHEMA_DEPENDENCY_MISSING",
        "Remote and unregistered schema references are disabled in self-contained mode.",
        childPath,
      );
    }
    inspectReferences(value, childPath);
  }
}

export function sanitizeJsonCompatible(value: unknown, limits?: Partial<ParseLimits>): unknown {
  const ir = fromJsValue(value, limits);
  return JSON.parse(printJson(ir)) as unknown;
}

export function sanitizeSchema(schema: unknown, limits?: Partial<ParseLimits>): unknown {
  const ir = fromJsValue(schema, limits);
  if (ir.root.kind !== "object" && ir.root.kind !== "boolean") {
    fail("INVALID_SCHEMA", "A Draft 2020-12 schema must be an object or boolean schema.");
  }
  inspectReferences(ir.root, "");
  const sanitized = JSON.parse(printJson(ir)) as unknown;
  if (
    typeof sanitized === "object" &&
    sanitized !== null &&
    !Array.isArray(sanitized) &&
    Object.hasOwn(sanitized, "$schema") &&
    (sanitized as Record<string, unknown>).$schema !==
      "https://json-schema.org/draft/2020-12/schema"
  ) {
    fail("UNSUPPORTED_SCHEMA_DIALECT", "Only JSON Schema Draft 2020-12 is supported.", "/$schema");
  }
  return sanitized;
}

export function canonicalJsonText(value: unknown): string {
  return printJson(fromJsValue(value), true);
}

const EXACT_NUMERIC_BOUND_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
]);

function schemaNeedsExactNumericValidation(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(schemaNeedsExactNumericValidation);
  if (typeof value !== "object" || value === null) return false;
  for (const [key, child] of Object.entries(value)) {
    if (EXACT_NUMERIC_BOUND_KEYWORDS.has(key)) return true;
    if (key === "uniqueItems" && child === true) return true;
    if (key === "const" && typeof child === "number") return true;
    if (key === "enum" && Array.isArray(child) && child.some((item) => typeof item === "number"))
      return true;
    if (schemaNeedsExactNumericValidation(child)) return true;
  }
  return false;
}

function hasNonfiniteNumber(node: IRNode): boolean {
  switch (node.kind) {
    case "number":
      return !Number.isFinite(Number(node.lexeme));
    case "array":
      return node.items.some(hasNonfiniteNumber);
    case "object":
      return node.entries.some(([, value]) => hasNonfiniteNumber(value));
    default:
      return false;
  }
}

function hasPrecisionSensitiveNumber(node: IRNode): boolean {
  switch (node.kind) {
    case "number": {
      const value = Number(node.lexeme);
      return (
        !Number.isFinite(value) || !Number.isSafeInteger(value) || String(value) !== node.lexeme
      );
    }
    case "array":
      return node.items.some(hasPrecisionSensitiveNumber);
    case "object":
      return node.entries.some(([, value]) => hasPrecisionSensitiveNumber(value));
    default:
      return false;
  }
}

export interface SchemaValidationResult {
  readonly status: "passed" | "not-requested";
  readonly dialect?: "https://json-schema.org/draft/2020-12/schema";
}

export function validateSchemaInstance(
  schema: unknown | undefined,
  ir: MorphIR,
): SchemaValidationResult {
  if (schema === undefined) return { status: "not-requested" };
  if (
    hasNonfiniteNumber(ir.root) ||
    (schemaNeedsExactNumericValidation(schema) && hasPrecisionSensitiveNumber(ir.root))
  ) {
    fail(
      "SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED",
      "Exact numeric schema keywords cannot be validated over precision-sensitive raw number lexemes by the installed validator.",
    );
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
    removeAdditional: false,
    useDefaults: false,
    coerceTypes: false,
  });
  let validate: ValidateFunction;
  try {
    validate = ajv.compile(schema as object | boolean);
  } catch (error) {
    fail(
      "INVALID_SCHEMA",
      error instanceof Error ? error.message : "The JSON Schema could not be compiled.",
    );
  }
  const instance = JSON.parse(printJson(ir)) as unknown;
  if (!validate(instance)) {
    const details = (validate.errors ?? []).slice(0, 20).map((error) => ({
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
      keyword: error.keyword,
      message: error.message ?? "validation failed",
    }));
    fail(
      "SCHEMA_VALIDATION_FAILED",
      "The input does not satisfy the supplied Draft 2020-12 schema.",
      undefined,
      {
        errors: details,
      },
    );
  }
  return { status: "passed", dialect: "https://json-schema.org/draft/2020-12/schema" };
}
