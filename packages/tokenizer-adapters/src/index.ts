import { sha256Text, type TargetProfile, type TokenizerAdapter } from "@morph/core";
import { Tiktoken } from "js-tiktoken/lite";
import o200kBaseRanks from "js-tiktoken/ranks/o200k_base";

/** Digest of the expanded o200k_base.tiktoken vocabulary asset. */
export const O200K_BASE_ASSET_SHA256 =
  "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d";

/** Digest of the bundled js-tiktoken representation, including its pattern and special tokens. */
export const O200K_BASE_BUNDLED_RANKS_SHA256 =
  "61b17bd0591944b89b499a90a28bae236cd8dbb33932fb92125b9c6de5510479";

export const O200K_BASE_ASSET = Object.freeze({
  vocabulary: "o200k_base",
  sourcePackage: "js-tiktoken",
  sourcePackageVersion: "1.0.21",
  sourceStatus: "third-party TypeScript port",
  digestScope: "expanded o200k_base.tiktoken vocabulary asset",
  digestAlgorithm: "sha256",
  digest: O200K_BASE_ASSET_SHA256,
  bundledRanksCanonicalization: "morph-tokenizer-asset/1",
  bundledRanksDigest: O200K_BASE_BUNDLED_RANKS_SHA256,
  bundled: true,
  networkRequired: false,
} as const);

export const O200K_BASE_TOKENIZER_REVISION =
  `js-tiktoken@1.0.21:o200k_base:sha256:${O200K_BASE_ASSET_SHA256}` as const;

let sharedEncoding: Tiktoken | undefined;

export interface TokenizerAssetVerification {
  readonly valid: boolean;
  readonly expandedAssetDigest: string;
  readonly bundledRanksDigest: string;
}

export function verifyLocalO200kAsset(): TokenizerAssetVerification {
  const specialTokens = Object.entries(o200kBaseRanks.special_tokens)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${JSON.stringify(key)}:${value}`)
    .join("\n");
  const canonicalAsset =
    `morph-tokenizer-asset/1\npat_str:${o200kBaseRanks.pat_str.length}:${o200kBaseRanks.pat_str}` +
    `\nspecial_tokens:${specialTokens.length}:${specialTokens}` +
    `\nbpe_ranks:${o200kBaseRanks.bpe_ranks.length}:${o200kBaseRanks.bpe_ranks}`;
  let expandedAsset = "";
  for (const compressedLine of o200kBaseRanks.bpe_ranks.split("\n").filter(Boolean)) {
    const [, offsetText, ...tokens] = compressedLine.split(" ");
    const offset = Number.parseInt(offsetText as string, 10);
    for (const [index, token] of tokens.entries()) {
      expandedAsset += `${token} ${offset + index}\n`;
    }
  }
  const bundledRanksDigest = sha256Text(canonicalAsset);
  const expandedAssetDigest = sha256Text(expandedAsset);
  return {
    valid:
      bundledRanksDigest === O200K_BASE_BUNDLED_RANKS_SHA256 &&
      expandedAssetDigest === O200K_BASE_ASSET_SHA256,
    expandedAssetDigest,
    bundledRanksDigest,
  };
}

function getEncoding(): Tiktoken {
  sharedEncoding ??= new Tiktoken(o200kBaseRanks);
  return sharedEncoding;
}

function assertText(text: string): void {
  if (typeof text !== "string") {
    throw new TypeError("Tokenizer input must be a string.");
  }
}

/**
 * A local, browser-compatible o200k_base text tokenizer.
 *
 * Special-token-looking text is treated as ordinary text. This adapter counts
 * only the supplied text and does not claim provider request accounting or a
 * binding to any model.
 */
export const localO200kBaseTokenizer: TokenizerAdapter = Object.freeze({
  id: "o200k_base",
  revision: O200K_BASE_TOKENIZER_REVISION,
  vocabulary: "o200k_base",
  normalization: "none",
  specialTokenPolicy:
    "ordinary-text; no special tokens are recognized, and special-token-looking input is encoded as ordinary text",
  implementation: "js-tiktoken@1.0.21 third-party TypeScript port with bundled ranks",
  countText(text: string): number {
    assertText(text);
    return getEncoding().encode(text, [], []).length;
  },
  tokenIds(text: string): readonly number[] {
    assertText(text);
    return getEncoding().encode(text, [], []);
  },
});

/**
 * An offline tokenizer profile. It intentionally has no modelId or providerId.
 */
export const localO200kBaseProfile: TargetProfile = Object.freeze({
  profileId: "local-o200k-base",
  tokenizerId: localO200kBaseTokenizer.id,
  tokenizerRevision: localO200kBaseTokenizer.revision,
});

export function createLocalO200kBaseTokenizer(): TokenizerAdapter {
  return localO200kBaseTokenizer;
}

export const builtInTokenizers = Object.freeze([localO200kBaseTokenizer] as const);
export const builtInTargetProfiles = Object.freeze([localO200kBaseProfile] as const);
