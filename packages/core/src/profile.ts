import { canonicalizeNode, compareCodeUnits } from "./canonical.js";
import { fail } from "./errors.js";
import { appendJsonPointer } from "./pointer.js";
import type { IRNode, MorphIR, ProfileOptions, RecordArrayProfile, ShapeProfile } from "./types.js";

function analyzeRecordArray(
  node: Extract<IRNode, { kind: "array" }>,
  path: string,
): RecordArrayProfile | undefined {
  if (node.items.length === 0 || node.items.some((item) => item.kind !== "object"))
    return undefined;
  const records = node.items as readonly Extract<IRNode, { kind: "object" }>[];
  const union = new Set<string>();
  let intersection = new Set(records[0]?.entries.map(([key]) => key) ?? []);
  const observed = new Map<string, Set<IRNode["kind"]>>();
  const presentCounts = new Map<string, number>();
  const nulls = new Map<string, number>();
  let primitiveCellsOnly = true;
  for (const record of records) {
    const present = new Set<string>();
    for (const [key, value] of record.entries) {
      present.add(key);
      union.add(key);
      presentCounts.set(key, (presentCounts.get(key) ?? 0) + 1);
      const types = observed.get(key) ?? new Set<IRNode["kind"]>();
      types.add(value.kind);
      observed.set(key, types);
      if (value.kind === "null") nulls.set(key, (nulls.get(key) ?? 0) + 1);
      if (value.kind === "array" || value.kind === "object") primitiveCellsOnly = false;
    }
    intersection = new Set([...intersection].filter((key) => present.has(key)));
  }
  const missing = new Map(
    [...union].map((key) => [key, records.length - (presentCounts.get(key) ?? 0)] as const),
  );
  const fieldUnion = [...union].sort(compareCodeUnits);
  const uniformKeySet = union.size === intersection.size;
  return {
    path,
    recordCount: records.length,
    fieldUnion,
    fieldIntersection: [...intersection].sort(compareCodeUnits),
    uniformKeySet,
    primitiveCellsOnly,
    observedTypes: Object.fromEntries(
      [...observed.entries()]
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, types]) => [key, [...types].sort(compareCodeUnits)]),
    ),
    missingKeyCounts: Object.fromEntries(
      [...missing.entries()].sort(([left], [right]) => compareCodeUnits(left, right)),
    ),
    nullCounts: Object.fromEntries(
      [...nulls.entries()].sort(([left], [right]) => compareCodeUnits(left, right)),
    ),
  };
}

export function profileIR(ir: MorphIR, options: ProfileOptions = {}): ShapeProfile {
  const cardinalityCap = options.maxScalarCardinality ?? 4_096;
  if (!Number.isSafeInteger(cardinalityCap) || cardinalityCap < 0) {
    fail("INVALID_LIMIT", "maxScalarCardinality must be a nonnegative safe integer.");
  }
  let totalNodes = 0;
  let maxDepth = 0;
  let objectCount = 0;
  let arrayCount = 0;
  let stringCount = 0;
  let numberCount = 0;
  let booleanCount = 0;
  let nullCount = 0;
  let totalStringCodePoints = 0;
  let repeatedScalarCount = 0;
  let untrackedScalarCount = 0;
  let scalarCardinalityCapped = false;
  const scalarCounts = new Map<string, number>();
  const recordArrays: RecordArrayProfile[] = [];

  const visit = (node: IRNode, depth: number, path: string): void => {
    totalNodes += 1;
    maxDepth = Math.max(maxDepth, depth);
    switch (node.kind) {
      case "null":
        nullCount += 1;
        break;
      case "boolean":
        booleanCount += 1;
        break;
      case "number":
        numberCount += 1;
        break;
      case "string":
        stringCount += 1;
        totalStringCodePoints += [...node.value].length;
        break;
      case "object":
        objectCount += 1;
        for (const [key, value] of node.entries) {
          visit(value, depth + 1, appendJsonPointer(path, key));
        }
        return;
      case "array": {
        arrayCount += 1;
        const recordArray = analyzeRecordArray(node, path);
        if (recordArray !== undefined) recordArrays.push(recordArray);
        node.items.forEach((item, index) => {
          visit(item, depth + 1, appendJsonPointer(path, String(index)));
        });
        return;
      }
    }
    const scalarKey = canonicalizeNode(node);
    const previous = scalarCounts.get(scalarKey);
    if (previous !== undefined) {
      scalarCounts.set(scalarKey, previous + 1);
      repeatedScalarCount += 1;
    } else if (scalarCounts.size < cardinalityCap) {
      scalarCounts.set(scalarKey, 1);
    } else {
      scalarCardinalityCapped = true;
      untrackedScalarCount += 1;
    }
  };
  visit(ir.root, 0, "");
  return {
    rootKind: ir.root.kind,
    totalNodes,
    maxDepth,
    objectCount,
    arrayCount,
    stringCount,
    numberCount,
    booleanCount,
    nullCount,
    totalStringCodePoints,
    repeatedScalarCount,
    cappedScalarCardinality: scalarCounts.size,
    untrackedScalarCount,
    scalarCardinalityCapped,
    recordArrays,
    exact: !scalarCardinalityCapped,
  };
}
