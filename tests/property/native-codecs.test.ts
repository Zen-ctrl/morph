import {
  createArtifact,
  type MorphTask,
  parseJsonStrict,
  parseModelContext,
  printJson,
  renderArtifactModelContext,
  semanticEqual,
} from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import { localO200kBaseProfile } from "@morph/tokenizer-adapters";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const targetRoundTrips = Number(process.env.MORPH_PROPERTY_RUNS ?? "500");
const genericRuns = Math.max(50, Math.ceil(targetRoundTrips / 2));
const tableRuns = Math.max(50, Math.ceil(targetRoundTrips / 8));
const seed = 20_260_921;
const task: MorphTask = { instruction: "Inspect all values.", accessPattern: "unknown" };

const safeText = fc
  .array(
    fc.constantFrom("a", "Z", "0", "é", "中", "🧭", "\t", "\n", "|", ",", ";", "~", "/", '"'),
    {
      maxLength: 18,
    },
  )
  .map((parts) => parts.join(""));

const primitive = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  safeText,
);

describe("native codec properties", () => {
  it("round-trips generic accepted JSON through every applicable native plan", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const text = JSON.stringify(value);
        let ir: ReturnType<typeof parseJsonStrict>;
        try {
          ir = parseJsonStrict(text);
        } catch {
          return;
        }
        for (const encoder of builtInEncoders) {
          for (const plan of encoder.enumerate(ir, task)) {
            if (!encoder.supports(ir, plan).supported) continue;
            const section = encoder.encode(ir, plan);
            expect(semanticEqual(encoder.decode(section), ir)).toBe(true);
            const artifact = createArtifact({
              ir,
              plan,
              section,
              plannerPolicy: "economy-experimental",
              target: localO200kBaseProfile,
              task,
              guideId: encoder.interpretationGuideId,
              guideVersion: encoder.interpretationGuideVersion,
              guideText: encoder.interpretationGuideText,
            });
            const parsedBundle = parseModelContext(
              renderArtifactModelContext(artifact).selfContainedBundle,
            );
            const restored = encoder.decode(parsedBundle.section);
            expect(semanticEqual(restored, ir)).toBe(true);
            expect(semanticEqual(parseJsonStrict(printJson(restored)), ir)).toBe(true);
          }
        }
      }),
      { numRuns: genericRuns, seed },
    );
  });

  it("round-trips uniform primitive rows through every native table plan", () => {
    const table = fc.array(
      fc.record({
        id: safeText,
        label: safeText,
        value: primitive,
        active: fc.boolean(),
        none: fc.constant(null),
      }),
      { minLength: 1, maxLength: 18 },
    );
    fc.assert(
      fc.property(table, (rows) => {
        const ir = parseJsonStrict(JSON.stringify(rows));
        let planCount = 0;
        for (const encoder of builtInEncoders) {
          for (const plan of encoder.enumerate(ir, task)) {
            if (!encoder.supports(ir, plan).supported) continue;
            expect(semanticEqual(encoder.decode(encoder.encode(ir, plan)), ir)).toBe(true);
            planCount += 1;
          }
        }
        expect(planCount).toBeGreaterThanOrEqual(8);
      }),
      { numRuns: tableRuns, seed: seed + 1 },
    );
  });
});
