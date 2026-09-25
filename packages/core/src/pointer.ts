import { fail } from "./errors.js";

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function unescapeJsonPointerSegment(segment: string): string {
  for (let index = 0; index < segment.length; index += 1) {
    if (segment[index] === "~") {
      const next = segment[index + 1];
      if (next !== "0" && next !== "1") {
        fail("INVALID_JSON_POINTER", "A JSON Pointer contains an invalid escape.");
      }
      index += 1;
    }
  }
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function appendJsonPointer(path: string, segment: string): string {
  return `${path}/${escapeJsonPointerSegment(segment)}`;
}

export function parseJsonPointer(pointer: string): readonly string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    fail("INVALID_JSON_POINTER", "A non-root JSON Pointer must start with '/'.");
  }
  return pointer.slice(1).split("/").map(unescapeJsonPointerSegment);
}
