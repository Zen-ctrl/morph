import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { IRNode } from "./types.js";

const encoder = new TextEncoder();

function utf8Length(value: string): number {
  return encoder.encode(value).byteLength;
}

export function compareCodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function canonicalizeNode(node: IRNode): string {
  switch (node.kind) {
    case "null":
      return "N;";
    case "boolean":
      return node.value ? "B1;" : "B0;";
    case "string":
      return `S${utf8Length(node.value)}:${node.value};`;
    case "number":
      return `D${utf8Length(node.lexeme)}:${node.lexeme};`;
    case "array":
      return `A${node.items.length}:[${node.items.map(canonicalizeNode).join("")}]`;
    case "object": {
      const entries = [...node.entries].sort(([left], [right]) => compareCodeUnits(left, right));
      const body = entries
        .map(([key, value]) => `K${utf8Length(key)}:${key};${canonicalizeNode(value)}`)
        .join("");
      return `O${entries.length}:{${body}}`;
    }
  }
}

export function sha256Bytes(value: Uint8Array): string {
  return bytesToHex(sha256(value));
}

export function sha256Text(value: string): string {
  return sha256Bytes(encoder.encode(value));
}

export function semanticDigest(root: IRNode): string {
  return sha256Text(`morph-c14n/1\n${canonicalizeNode(root)}`);
}
