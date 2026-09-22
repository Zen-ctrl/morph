import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import o200kBaseRanks from "js-tiktoken/ranks/o200k_base";
import { get_encoding } from "tiktoken";
import { describe, expect, it } from "vitest";
import {
  localO200kBaseProfile,
  localO200kBaseTokenizer,
  O200K_BASE_ASSET,
  O200K_BASE_ASSET_SHA256,
  O200K_BASE_BUNDLED_RANKS_SHA256,
} from "./index.js";

const CROSS_CHECK_TEXTS = [
  "",
  "hello world",
  " leading and  repeated whitespace\nnext line\tcell",
  "punctuation: []{}(),.;!? | comma, tab\t semicolon;",
  "中文文本, café, e\u0301, emoji: 🧪🚀",
  "-0 1.2300 9007199254740993 9e30",
  "<|endoftext|> and <|endofprompt|> are ordinary text here",
] as const;

interface TokenizerFixture {
  readonly oracle: string;
  readonly oraclePackage: string;
  readonly oracleVersion: string;
  readonly assetSha256: string;
  readonly cases: readonly {
    readonly text: string;
    readonly ids: readonly number[];
    readonly count: number;
  }[];
}

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/tokenizer/o200k-base-v1.json", import.meta.url), "utf8"),
) as TokenizerFixture;

describe("local o200k_base tokenizer", () => {
  it("cross-checks token IDs against the installed tiktoken implementation", () => {
    const oracle = get_encoding("o200k_base");
    try {
      for (const text of CROSS_CHECK_TEXTS) {
        const expected = Array.from(oracle.encode_ordinary(text));
        expect(localO200kBaseTokenizer.tokenIds?.(text)).toEqual(expected);
        expect(localO200kBaseTokenizer.countText(text)).toBe(expected.length);
      }
    } finally {
      oracle.free();
    }
  });

  it("matches the committed reproducible tokenizer fixture", () => {
    expect(fixture.oracle).toBe("official Python tiktoken 0.14.0 encode_ordinary");
    expect(fixture.oraclePackage).toBe("tiktoken");
    expect(fixture.oracleVersion).toBe("0.14.0");
    expect(fixture.assetSha256).toBe(O200K_BASE_ASSET_SHA256);
    expect(fixture.cases.map((item) => item.text)).toEqual(CROSS_CHECK_TEXTS);
    for (const item of fixture.cases) {
      expect(localO200kBaseTokenizer.tokenIds?.(item.text)).toEqual(item.ids);
      expect(localO200kBaseTokenizer.countText(item.text)).toBe(item.count);
    }
  });

  it("records the bundled asset and exposes no invented model binding", () => {
    const specialTokens = Object.entries(o200kBaseRanks.special_tokens)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, value]) => `${JSON.stringify(key)}:${value}`)
      .join("\n");
    const canonicalAsset =
      `morph-tokenizer-asset/1\npat_str:${o200kBaseRanks.pat_str.length}:${o200kBaseRanks.pat_str}` +
      `\nspecial_tokens:${specialTokens.length}:${specialTokens}` +
      `\nbpe_ranks:${o200kBaseRanks.bpe_ranks.length}:${o200kBaseRanks.bpe_ranks}`;
    const calculatedBundledDigest = createHash("sha256")
      .update(canonicalAsset, "utf8")
      .digest("hex");
    const newline = "\n";
    let expandedAsset = "";
    for (const compressedLine of o200kBaseRanks.bpe_ranks.split(newline).filter(Boolean)) {
      const [, offsetText, ...tokens] = compressedLine.split(" ");
      const offset = Number.parseInt(offsetText as string, 10);
      for (const [index, token] of tokens.entries()) {
        expandedAsset += `${token} ${offset + index}${newline}`;
      }
    }
    const calculatedAssetDigest = createHash("sha256").update(expandedAsset, "utf8").digest("hex");

    expect(calculatedBundledDigest).toBe(O200K_BASE_BUNDLED_RANKS_SHA256);
    expect(calculatedAssetDigest).toBe(O200K_BASE_ASSET_SHA256);
    expect(O200K_BASE_ASSET.digest).toBe(O200K_BASE_ASSET_SHA256);
    expect(O200K_BASE_ASSET.networkRequired).toBe(false);
    expect(localO200kBaseProfile.profileId).toBe("local-o200k-base");
    expect(localO200kBaseProfile).not.toHaveProperty("modelId");
    expect(localO200kBaseProfile).not.toHaveProperty("providerId");
  });

  it("is deterministic", () => {
    const text = "same input 🧪 <|endoftext|>";
    expect(localO200kBaseTokenizer.tokenIds?.(text)).toEqual(
      localO200kBaseTokenizer.tokenIds?.(text),
    );
  });
});
