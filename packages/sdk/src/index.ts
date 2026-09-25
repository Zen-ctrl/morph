import { createMorph, type MorphOptions, type MorphRegistry } from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import { localO200kBaseProfile, localO200kBaseTokenizer } from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";

export * from "@morph/core";
export * from "@morph/encoders";
export * from "@morph/tokenizer-adapters";
export * from "@morph/toon-adapter";

export const defaultMorphRegistry: MorphRegistry = Object.freeze({
  encoders: Object.freeze([...builtInEncoders, toonEncoder]),
  tokenizers: Object.freeze([localO200kBaseTokenizer]),
  targetProfiles: Object.freeze([localO200kBaseProfile]),
  qualityProfiles: Object.freeze([]),
});

export function createDefaultMorph(options: MorphOptions = {}) {
  return createMorph(defaultMorphRegistry, options);
}
