import { appendJsonPointer } from "./pointer.js";
import type { IRNode, MorphIR } from "./types.js";

export interface SourceMapSpan {
  readonly start: number;
  readonly end: number;
  readonly unit: "utf16-code-units";
  readonly role: "key" | "value";
}

export interface SourceMapEntry {
  readonly pointer: string;
  readonly spans: readonly SourceMapSpan[];
}

export interface CompactJsonSourceMap {
  readonly format: "morph-source-map/1";
  readonly encoding: "json-compact";
  readonly offsetUnit: "utf16-code-units";
  readonly text: string;
  readonly entries: readonly SourceMapEntry[];
}

export function printCompactJsonWithSourceMap(ir: MorphIR): CompactJsonSourceMap {
  const chunks: string[] = [];
  const spans = new Map<string, SourceMapSpan[]>();
  let offset = 0;
  const append = (value: string): void => {
    chunks.push(value);
    offset += value.length;
  };
  const addSpan = (pointer: string, span: SourceMapSpan): void => {
    const existing = spans.get(pointer);
    if (existing === undefined) spans.set(pointer, [span]);
    else existing.push(span);
  };
  const write = (node: IRNode, pointer: string): void => {
    const valueStart = offset;
    switch (node.kind) {
      case "null":
        append("null");
        break;
      case "boolean":
        append(node.value ? "true" : "false");
        break;
      case "number":
        append(node.lexeme);
        break;
      case "string":
        append(JSON.stringify(node.value));
        break;
      case "array":
        append("[");
        node.items.forEach((item, index) => {
          if (index > 0) append(",");
          write(item, appendJsonPointer(pointer, String(index)));
        });
        append("]");
        break;
      case "object":
        append("{");
        node.entries.forEach(([key, value], index) => {
          if (index > 0) append(",");
          const childPointer = appendJsonPointer(pointer, key);
          const keyStart = offset;
          append(JSON.stringify(key));
          addSpan(childPointer, {
            start: keyStart,
            end: offset,
            unit: "utf16-code-units",
            role: "key",
          });
          append(":");
          write(value, childPointer);
        });
        append("}");
        break;
    }
    addSpan(pointer, {
      start: valueStart,
      end: offset,
      unit: "utf16-code-units",
      role: "value",
    });
  };
  write(ir.root, "");
  return {
    format: "morph-source-map/1",
    encoding: "json-compact",
    offsetUnit: "utf16-code-units",
    text: chunks.join(""),
    entries: [...spans.entries()].map(([pointer, entrySpans]) => ({ pointer, spans: entrySpans })),
  };
}
