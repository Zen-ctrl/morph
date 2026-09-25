import { createDefaultMorph, localO200kBaseProfile } from "@morph/sdk";
import { describe, expect, it } from "vitest";

describe("composed SDK", () => {
  it("offers a ready offline compiler without credentials", async () => {
    const morph = createDefaultMorph();
    const result = await morph.compileJson('{"ready":true}', {
      task: { instruction: "Return ready." },
      target: localO200kBaseProfile,
      constraints: { mode: "lossless", allowNetwork: false },
      planner: { policy: "compatibility", objective: "prompt-tokens" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(morph.decodeJson(result.artifact)).toBe('{"ready":true}');
  });
});
