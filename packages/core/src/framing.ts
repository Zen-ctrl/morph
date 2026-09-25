import { sha256Text } from "./canonical.js";
import { fail } from "./errors.js";
import { parseJsonStrict, printJson } from "./ir.js";
import { canonicalJsonText, sanitizeSchema } from "./schema.js";
import type { EncodedSection, ModelContext, MorphArtifact, ParsedModelContext } from "./types.js";

const CONTEXT_VERSION = "MORPH-CONTEXT/1";
const PROMPT_VERSION = "MORPH-PROMPT/1";
const MAX_CONTEXT_BYTES = 16 * 1024 * 1024;

type SectionName = "GUIDE" | "METADATA" | "SCHEMA" | "PAYLOAD";

function beginMarker(boundary: string, name: SectionName): string {
  return `<<<MORPH:${boundary}:BEGIN:${name}>>>`;
}

function endMarker(boundary: string, name: SectionName): string {
  return `<<<MORPH:${boundary}:END:${name}>>>`;
}

function selectBoundary(parts: readonly string[]): string {
  const seed = parts.join("\u0000");
  for (let attempt = 0; attempt < 1_024; attempt += 1) {
    const boundary = sha256Text(`morph-boundary/1\n${attempt}\n${seed}`).slice(0, 24);
    const markers = (["GUIDE", "METADATA", "SCHEMA", "PAYLOAD"] as const).flatMap((name) => [
      beginMarker(boundary, name),
      endMarker(boundary, name),
    ]);
    markers.push(`<<<MORPH:${boundary}:END>>>`);
    if (parts.every((part) => markers.every((marker) => !part.includes(marker)))) return boundary;
  }
  fail("FRAMING_COLLISION", "Unable to select a collision-free deterministic frame boundary.");
}

function framedSection(boundary: string, name: SectionName, content: string): string {
  return `${beginMarker(boundary, name)}\n${content}\n${endMarker(boundary, name)}`;
}

function metadataForArtifact(artifact: MorphArtifact): Readonly<Record<string, unknown>> {
  return {
    encoding: artifact.section.encoding,
    formatVersion: artifact.section.formatVersion,
    inputKind: artifact.inputKind,
    inputSemanticDigest: artifact.inputSemanticDigest,
    interpretationGuideId: artifact.modelDependencies.interpretationGuideId,
    interpretationGuideVersion: artifact.modelDependencies.interpretationGuideVersion,
    layoutMetadata: artifact.section.layoutMetadata,
  };
}

export function frameModelBundle(artifact: MorphArtifact): string {
  if (artifact.modelDependencies.dictionaries !== undefined) {
    fail(
      "UNSUPPORTED_ARTIFACT_DEPENDENCY",
      "Dictionary dependencies require a future framing version and cannot be omitted.",
    );
  }
  const guide = artifact.modelDependencies.interpretationGuideText;
  const metadata = canonicalJsonText(metadataForArtifact(artifact));
  const schema =
    artifact.modelDependencies.schema === undefined
      ? "null"
      : canonicalJsonText(artifact.modelDependencies.schema);
  const payload = artifact.section.payload;
  const boundary = selectBoundary([guide, metadata, schema, payload]);
  return [
    `${CONTEXT_VERSION} ${boundary}`,
    framedSection(boundary, "GUIDE", guide),
    framedSection(boundary, "METADATA", metadata),
    framedSection(boundary, "SCHEMA", schema),
    framedSection(boundary, "PAYLOAD", payload),
    `<<<MORPH:${boundary}:END>>>`,
  ].join("\n");
}

function extractSection(bundle: string, boundary: string, name: SectionName): string {
  const startMarker = `${beginMarker(boundary, name)}\n`;
  const endSequence = `\n${endMarker(boundary, name)}`;
  const start = bundle.indexOf(startMarker);
  if (start < 0 || start !== bundle.lastIndexOf(startMarker)) {
    fail("MALFORMED_MODEL_CONTEXT", `The ${name} section is missing or duplicated.`);
  }
  const contentStart = start + startMarker.length;
  const end = bundle.indexOf(endSequence, contentStart);
  if (end < 0 || end !== bundle.lastIndexOf(endSequence)) {
    fail("MALFORMED_MODEL_CONTEXT", `The ${name} section terminator is missing or duplicated.`);
  }
  return bundle.slice(contentStart, end);
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(code, "Expected a JSON object in model-context metadata.");
  }
  return value as Record<string, unknown>;
}

export function parseModelContext(bundle: string): ParsedModelContext {
  const byteLength = new TextEncoder().encode(bundle).byteLength;
  if (byteLength > MAX_CONTEXT_BYTES) {
    fail("MAX_RENDERED_BYTES_EXCEEDED", "The model context exceeds the decode allocation limit.");
  }
  const firstNewline = bundle.indexOf("\n");
  if (firstNewline < 0) fail("MALFORMED_MODEL_CONTEXT", "The model context header is incomplete.");
  const header = bundle.slice(0, firstNewline);
  const match = /^MORPH-CONTEXT\/1 ([0-9a-f]{24})$/.exec(header);
  if (match === null)
    fail("UNSUPPORTED_CONTEXT_VERSION", "Unsupported or malformed model context header.");
  const boundary = match[1] as string;
  const finalMarker = `<<<MORPH:${boundary}:END>>>`;
  if (
    !bundle.endsWith(finalMarker) ||
    bundle.indexOf(finalMarker) !== bundle.lastIndexOf(finalMarker)
  ) {
    fail("MALFORMED_MODEL_CONTEXT", "The model context final marker is missing or ambiguous.");
  }
  const guide = extractSection(bundle, boundary, "GUIDE");
  const metadataText = extractSection(bundle, boundary, "METADATA");
  const schemaText = extractSection(bundle, boundary, "SCHEMA");
  const payload = extractSection(bundle, boundary, "PAYLOAD");
  const canonicalFrame = [
    header,
    framedSection(boundary, "GUIDE", guide),
    framedSection(boundary, "METADATA", metadataText),
    framedSection(boundary, "SCHEMA", schemaText),
    framedSection(boundary, "PAYLOAD", payload),
    finalMarker,
  ].join("\n");
  if (bundle !== canonicalFrame) {
    fail(
      "MALFORMED_MODEL_CONTEXT",
      "The model-context sections are reordered, gapped, or contain unframed text.",
    );
  }
  const metadata = asRecord(
    JSON.parse(printJson(parseJsonStrict(metadataText))),
    "MALFORMED_MODEL_CONTEXT",
  );
  const encoding = metadata.encoding;
  const formatVersion = metadata.formatVersion;
  const inputKind = metadata.inputKind;
  const inputSemanticDigest = metadata.inputSemanticDigest;
  const interpretationGuideId = metadata.interpretationGuideId;
  const interpretationGuideVersion = metadata.interpretationGuideVersion;
  const layoutMetadata = metadata.layoutMetadata;
  if (
    typeof encoding !== "string" ||
    typeof formatVersion !== "string" ||
    (inputKind !== "json-text" && inputKind !== "js-value") ||
    typeof inputSemanticDigest !== "string" ||
    typeof interpretationGuideId !== "string" ||
    typeof interpretationGuideVersion !== "string" ||
    typeof layoutMetadata !== "object" ||
    layoutMetadata === null ||
    Array.isArray(layoutMetadata)
  ) {
    fail("MALFORMED_MODEL_CONTEXT", "Model-context metadata has invalid fields.");
  }
  const schema =
    schemaText === "null"
      ? undefined
      : sanitizeSchema(JSON.parse(printJson(parseJsonStrict(schemaText))) as unknown);
  const section: EncodedSection = {
    encoding,
    formatVersion,
    payload,
    layoutMetadata: layoutMetadata as Readonly<Record<string, unknown>>,
    interpretationGuideId,
  };
  return {
    format: "morph-context/1",
    section,
    ...(schema === undefined ? {} : { schema }),
    interpretationGuideId,
    interpretationGuideVersion,
    interpretationGuideText: guide,
    inputKind,
    inputSemanticDigest,
  };
}

function promptBoundary(parts: readonly string[]): string {
  const seed = parts.join("\u0000");
  for (let attempt = 0; attempt < 1_024; attempt += 1) {
    const boundary = sha256Text(`morph-prompt-boundary/1\n${attempt}\n${seed}`).slice(0, 20);
    const marker = `<<<MORPH-PROMPT:${boundary}:`;
    if (parts.every((part) => !part.includes(marker))) return boundary;
  }
  fail("FRAMING_COLLISION", "Unable to frame the complete prompt deterministically.");
}

export function renderArtifactModelContext(artifact: MorphArtifact): ModelContext {
  if (artifact.requestFrame.templateVersion !== "morph-prompt/1") {
    fail("UNSUPPORTED_PROMPT_TEMPLATE", "Only morph-prompt/1 request framing is supported.");
  }
  const bundle = frameModelBundle(artifact);
  const parts = [
    artifact.requestFrame.prefix,
    bundle,
    artifact.requestFrame.task.instruction,
    artifact.requestFrame.suffix,
  ];
  const boundary = promptBoundary(parts);
  const labels = ["PREFIX", "SELF-CONTAINED-BUNDLE", "TASK", "SUFFIX"] as const;
  const rendered = [
    `${PROMPT_VERSION} ${boundary}`,
    ...parts.flatMap((part, index) => [
      `<<<MORPH-PROMPT:${boundary}:BEGIN:${labels[index]}>>>`,
      part,
      `<<<MORPH-PROMPT:${boundary}:END:${labels[index]}>>>`,
    ]),
    `<<<MORPH-PROMPT:${boundary}:END>>>`,
  ].join("\n");
  return {
    format: "morph-context/1",
    interpretationGuide: artifact.modelDependencies.interpretationGuideText,
    dataBlock: bundle,
    selfContainedBundle: bundle,
    rendered,
    renderedDigest: sha256Text(rendered),
  };
}
