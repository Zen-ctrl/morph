import type { MorphEncoder } from "@morph/core";
import { columnsJsonEncoder } from "./columns-json/index.js";
import { jsonCompactEncoder } from "./json-compact/index.js";
import { jsonLinesEncoder } from "./json-lines/index.js";
import { pathValueEncoder } from "./path-value/index.js";
import { rowsDelimitedEncoder } from "./rows-delimited/index.js";

export * from "./columns-json/index.js";
export * from "./json-compact/index.js";
export * from "./json-lines/index.js";
export * from "./path-value/index.js";
export * from "./rows-delimited/index.js";

export const builtInEncoders: readonly MorphEncoder[] = Object.freeze([
  jsonCompactEncoder,
  jsonLinesEncoder,
  rowsDelimitedEncoder,
  columnsJsonEncoder,
  pathValueEncoder,
]);

export const nativeEncoders = builtInEncoders;

export function createBuiltInEncoders(): readonly MorphEncoder[] {
  return [...builtInEncoders];
}

export function getBuiltInEncoder(encoding: string): MorphEncoder | undefined {
  return builtInEncoders.find((encoder) => encoder.id === encoding);
}
