import { parseJsonStrict, printCompactJsonWithSourceMap } from "@morph/core";
import { describe, expect, it } from "vitest";

describe("compact JSON source map", () => {
  it("uses documented UTF-16 offsets across Unicode and escapes", () => {
    const map = printCompactJsonWithSourceMap(
      parseJsonStrict('{"🧭/name":"结构\\ntext","plain":1.2300}'),
    );
    expect(map.offsetUnit).toBe("utf16-code-units");
    const entry = map.entries.find((item) => item.pointer === "/🧭~1name");
    expect(entry).toBeDefined();
    const value = entry?.spans.find((span) => span.role === "value");
    const key = entry?.spans.find((span) => span.role === "key");
    expect(map.text.slice(value?.start, value?.end)).toBe('"结构\\ntext"');
    expect(map.text.slice(key?.start, key?.end)).toBe('"🧭/name"');
    expect(map.text).toBe('{"🧭/name":"结构\\ntext","plain":1.2300}');
  });
});
