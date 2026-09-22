# Artifact, model-context, and codec formats

This document describes the formats emitted by the current implementation. Format names
and version strings are compatibility contracts. A decoder fails closed when an encoding
or major envelope version is not registered.

## Common conventions

- Text is Unicode and is measured as UTF-8 where a byte limit or canonical length is
  required.
- Rendered framing uses U+000A line feeds.
- JSON payloads are strict JSON.
- JSON-text number nodes retain their original grammar-valid lexeme.
- JSON Pointer paths follow [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901.html).
- SHA-256 digests are lowercase hexadecimal.
- Digests detect accidental or deliberate mismatches. They are not signatures or trust
  assertions.

## Machine artifact: `morph-artifact/1`

A selected plan is saved as a JSON object matching this shape:

```ts
interface MorphArtifact {
  artifactVersion: "morph-artifact/1";
  artifactId: string;
  inputSemanticDigest: string;
  inputKind: "json-text" | "js-value";
  plan: {
    encoding: string;
    formatVersion: string;
    options: Readonly<Record<string, unknown>>;
    plannerPolicy: "compatibility" | "economy-experimental" | "validated";
  };
  section: {
    encoding: string;
    formatVersion: string;
    payload: string;
    layoutMetadata: Readonly<Record<string, unknown>>;
    interpretationGuideId: string;
  };
  modelDependencies: {
    schema?: unknown;
    dictionaries?: readonly unknown[];
    interpretationGuideId: string;
    interpretationGuideVersion: string;
    interpretationGuideText: string;
  };
  dependencyMode: "self-contained";
  target: TargetProfile;
  requestFrame: {
    task: MorphTask;
    prefix: string;
    suffix: string;
    templateVersion: "morph-prompt/1";
  };
  integrity: {
    payloadDigest: string;
    dependenciesDigest: string;
    algorithm: "sha256";
    canonicalizationVersion: "morph-c14n/1";
  };
}
```

`payloadDigest` hashes the encoded payload text. `dependenciesDigest` hashes the
deterministic canonical JSON form of the model dependencies. `artifactId` hashes a
canonical identity object containing the input digest and kind, physical plan, section
identity and payload digest, dependency digest, target, and prompt frame. It does not
hide a copy of the original source JSON.

`dictionaries` remains visible in the shared artifact type for a future artifact version,
but the `morph-artifact/1` importer rejects it with
`UNSUPPORTED_ARTIFACT_DEPENDENCY`. No current codec needs a dictionary, and the version 1
framing grammar has no dictionary section.

Runtime artifact import rejects unsupported fields at the envelope, plan, section,
dependency, target, request-frame, task, and integrity levels. It checks required field
types, known envelope and dependency modes, exact `morph-prompt/1` template version,
target identity fields, task fields, and supported integrity algorithms. The registered
encoder then validates its own exact section grammar.

## Semantic canonicalization: `morph-c14n/1`

The semantic digest starts with the UTF-8 bytes of:

```text
morph-c14n/1\n
```

followed by a tagged serialization of the root node. Object entries are sorted by
locale-independent JavaScript code-unit comparison. Arrays retain order. String, key,
and numeric-lexeme lengths are UTF-8 byte lengths.

| Node | Canonical form |
| --- | --- |
| null | `N;` |
| false | `B0;` |
| true | `B1;` |
| string | `S<byteLength>:<text>;` |
| number | `D<byteLength>:<lexeme>;` |
| array | `A<count>:[<item forms>]` |
| object | `O<count>:{K<keyByteLength>:<key>;<value form>...}` |

The digest is independent of object display order but remains sensitive to array order,
types, string contents, and numeric spelling.

## Self-contained bundle: `MORPH-CONTEXT/1`

`frameModelBundle` emits all information needed by a registered decoder to reconstruct
the IR without the original dataset or an external registry.

The canonical emitted order is:

```text
MORPH-CONTEXT/1 <24 lowercase hex boundary>
<<<MORPH:<boundary>:BEGIN:GUIDE>>>
<compiler-owned interpretation guide>
<<<MORPH:<boundary>:END:GUIDE>>>
<<<MORPH:<boundary>:BEGIN:METADATA>>>
<canonical compact JSON metadata>
<<<MORPH:<boundary>:END:METADATA>>>
<<<MORPH:<boundary>:BEGIN:SCHEMA>>>
<canonical compact JSON schema, or null>
<<<MORPH:<boundary>:END:SCHEMA>>>
<<<MORPH:<boundary>:BEGIN:PAYLOAD>>>
<encoded payload>
<<<MORPH:<boundary>:END:PAYLOAD>>>
<<<MORPH:<boundary>:END>>>
```

There is no trailing line feed after the final marker in the emitted form.

Bundle metadata contains exactly the representation facts needed by the parser:

```json
{
  "encoding": "...",
  "formatVersion": "...",
  "inputKind": "json-text",
  "inputSemanticDigest": "...",
  "interpretationGuideId": "...",
  "interpretationGuideVersion": "...",
  "layoutMetadata": {}
}
```

The emitter derives candidate boundaries deterministically. For attempt `n`, it hashes:

```text
morph-boundary/1\n<n>\n<guide>\0<metadata>\0<schema>\0<payload>
```

and uses the first 24 hex characters. It tries at most 1,024 values and accepts only a
boundary for which none of the complete section markers occurs in any framed part. This
is collision avoidance for parsing, not prompt-injection defense.

`parseModelContext` accepts only a `MORPH-CONTEXT/1` header with a 24-hex boundary,
requires each named start and end sequence exactly once, requires a unique final marker
at the end, enforces a 16 MiB bundle allocation limit, parses metadata and schema as
strict JSON, and validates required metadata field types. Codec-specific decoding then
checks the payload and layout metadata.

The bundle parser does not assign trust to guide, schema, or data text. Artifact integrity
must be checked separately when the bundle originates from an artifact.

## Complete prompt: `MORPH-PROMPT/1`

The local renderer assembles the exact tokenizer input in this order:

```text
MORPH-PROMPT/1 <20 lowercase hex boundary>
<<<MORPH-PROMPT:<boundary>:BEGIN:PREFIX>>>
<caller prefix>
<<<MORPH-PROMPT:<boundary>:END:PREFIX>>>
<<<MORPH-PROMPT:<boundary>:BEGIN:SELF-CONTAINED-BUNDLE>>>
<complete MORPH-CONTEXT/1 bundle>
<<<MORPH-PROMPT:<boundary>:END:SELF-CONTAINED-BUNDLE>>>
<<<MORPH-PROMPT:<boundary>:BEGIN:TASK>>>
<task instruction>
<<<MORPH-PROMPT:<boundary>:END:TASK>>>
<<<MORPH-PROMPT:<boundary>:BEGIN:SUFFIX>>>
<caller suffix>
<<<MORPH-PROMPT:<boundary>:END:SUFFIX>>>
<<<MORPH-PROMPT:<boundary>:END>>>
```

The prompt boundary is selected deterministically from the four parts and is rejected if
the generic marker prefix for that boundary occurs in any part. The renderer returns:

- `interpretationGuide`, the guide alone;
- `dataBlock`, the same text as `selfContainedBundle`;
- `selfContainedBundle`, the full `MORPH-CONTEXT/1` value;
- `rendered`, the complete `MORPH-PROMPT/1` text;
- `renderedDigest`, SHA-256 of `rendered`.

Candidate selection tokenizes `rendered` in one call. Separate component counts are not
summed because tokenizer merges can cross component boundaries.

## Shared native layout metadata

Every native codec includes these fields in `layoutMetadata`:

```json
{
  "irVersion": "morph-ir/1",
  "inputKind": "json-text",
  "semanticDigest": "64 lowercase hex characters"
}
```

Native decoders permit only their shared and codec-specific metadata keys. They validate
the declared input identity and recompute the semantic digest after reconstruction.
Payloads have a 16 MiB decoder limit, a depth limit of 64 where parsing or paths apply,
and a decoded node limit of 250,000.

## Compact JSON: `json-compact@1`

Applicability: every accepted IR.

Payload grammar: one strict compact JSON value without unnecessary structural
whitespace. Strings use JSON escaping and numbers use their stored lexemes.

Additional metadata:

```json
{ "rootKind": "null|boolean|string|number|array|object" }
```

The decoder parses one JSON value and rejects a mismatch between the declared and actual
root kind. This target is the primary baseline.

## MORPH-framed JSON Lines: `json-lines@1`

Applicability: a root array, including an empty root array.

Additional metadata:

```json
{
  "root": "array",
  "elementCount": 3,
  "lineFramingVersion": "1"
}
```

Each physical line is one complete compact JSON value. Array order and duplicate values
are retained. Newline characters inside strings remain JSON escapes. The empty root
array has an empty payload plus `elementCount: 0`.

The decoder rejects carriage returns, a trailing line feed, empty nonzero lines, extra or
missing lines, and total node counts beyond the limit. This is a MORPH-framed array
representation, not an unframed generic JSON Lines stream.

## Typed delimited rows: `rows-delimited@1`

Applicability: a nonempty root array of objects with identical key sets, at least one
field, and only JSON primitive cells. Null is a primitive. Sparse or nested record arrays
are inapplicable rather than changed.

The four candidate delimiters are:

| Option value | Actual character |
| --- | --- |
| `"\t"` | U+0009 tab |
| `","` | comma |
| `"|"` | pipe |
| `";"` | semicolon |

Additional metadata:

```json
{
  "root": "array-of-objects",
  "rowCount": 3,
  "fields": ["id", "country", "revenue", "active"],
  "delimiter": "\t",
  "cellCodec": "json-scalar-v1"
}
```

Field order is the first record's key display order. Later records may display their keys
in a different order, but are encoded against the declared field list. Row order is never
changed.

Every cell is exactly one JSON scalar token. Strings are always quoted JSON strings;
numbers retain their lexemes; booleans and null use JSON literals. A conceptual tab plan
looks like this, where the arrows below stand for actual U+0009 separators:

```text
"c1"  ->  "US"  ->  129  ->  true
"c2"  ->  "CA"  ->  85   ->  false
```

The actual payload contains no arrows. Its row separator is U+000A.

The decoder scans character by character, recognizes delimiters only outside quoted JSON
strings, then parses every cell with the strict scalar parser. It rejects CR characters,
trailing rows, unterminated strings, row-count and width mismatches, duplicate field
names, invalid scalars, and unsafe declared allocation sizes. This is not a universal CSV
or TSV dialect.

## Column JSON: `columns-json@1`

Applicability: the same nonempty uniform primitive record arrays as typed delimited rows.

Additional metadata:

```json
{
  "root": "array-of-objects",
  "rowCount": 3,
  "fields": ["id", "country", "revenue", "active"],
  "columnCodec": "json-array-v1"
}
```

The payload is one JSON array containing one JSON array per field:

```json
[
  ["c1", "c2", "c3"],
  ["US", "CA", "US"],
  [129, 85, 220],
  [true, false, true]
]
```

The emitted payload is compact. Index `j` across every column reconstructs source row
`j`. The decoder requires the column count to equal the field count, every column length
to equal `rowCount`, every cell to be primitive, field names to be unique, and projected
allocations to remain bounded.

## Typed path/value: `path-value@1`

Applicability: every accepted IR.

Additional metadata:

```json
{
  "root": "typed-node-records",
  "recordCount": 8,
  "pointer": "rfc6901",
  "recordCodec": "typed-json-lines-v1"
}
```

Every physical line is a JSON array describing exactly one node:

```text
[path, "object"]
[path, "array", itemCount]
[path, "string", stringValue]
[path, "number", numericLexemeString]
[path, "boolean", booleanValue]
[path, "null"]
```

The root pointer is the empty string. Pointer segments encode `~` as `~0` and `/` as
`~1`. The decoder first validates escapes and requires canonical re-encoding of every
pointer.

Example:

```text
["","object"]
["/account","object"]
["/account/id","string","c1"]
["/flags","array",2]
["/flags/0","boolean",true]
["/flags/1","null"]
["/empty","object"]
["/amount","number","1.2300"]
```

The decoder rejects incorrect record arity, unknown tags, malformed numeric lexemes,
duplicate paths, missing parents, children under scalars, noncanonical or out-of-range
array indices, holes, count mismatches, multiple logical roots, and declared sizes beyond
limits. Parent container type distinguishes object key `"0"` from array index zero.

## Official TOON adapter: `toon@4.1.1`

The adapter imports `encode` and strict `decode` from the pinned official
`@toon-format/toon` 4.1.1 package. It enumerates comma, U+0009 tab, and pipe delimiter
plans with `indentSize: 2`.

Layout metadata is exact and closed:

```json
{
  "adapter": "official-@toon-format/toon",
  "packageVersion": "4.1.1",
  "delimiter": ",",
  "indentSize": 2,
  "strictDecode": true,
  "inputKind": "json-text"
}
```

TOON uses JavaScript numbers. Before encoding, MORPH rejects a numeric node when:

- conversion is not finite;
- the value is negative zero;
- `String(Number(lexeme))` differs from the original lexeme;
- an integer is outside JavaScript's safe-integer range.

Consequently, lexemes such as `-0`, `1.2300`, `1e3`, and precision-unsafe integers are
inapplicable. Native codecs remain available and retain those lexemes.

`supports` performs an actual official encode, strict decode, and MORPH semantic equality
check. The decoder also re-encodes the result with the declared options and requires a
byte-identical canonical payload. The artifact's semantic digest provides the final
identity check.

TOON format documentation is maintained by its upstream project at
[toonformat.dev](https://toonformat.dev/reference/api) and in the
[TOON specification repository](https://github.com/toon-format/spec). MORPH does not
adopt upstream benchmark claims as its own results.

## Compatibility policy

The artifact, context, prompt, guide, and codec versions are all explicit. Compatibility
rules in the current implementation are:

- only `morph-artifact/1` and `dependencyMode: "self-contained"` are imported;
- only `MORPH-CONTEXT/1` is parsed;
- the local renderer emits `MORPH-PROMPT/1`;
- an artifact's encoding and exact format version must have a registered decoder;
- native decoders accept only documented metadata keys and values;
- TOON accepts only its exact pinned metadata and canonical payload;
- unknown formats fail rather than being guessed or repaired.

Adding fields or changing interpretation may require a new codec, guide, renderer, or
artifact version. Quality evidence is invalid across mismatched encoder, tokenizer,
guide, renderer, target, or model identity. No quality evidence ships in this release.

## Compact JSON source map: `morph-source-map/1`

Source maps are a separate diagnostic result and are not embedded in
`morph-artifact/1`. The implemented helper covers compact JSON only:

```ts
interface CompactJsonSourceMap {
  format: "morph-source-map/1";
  encoding: "json-compact";
  offsetUnit: "utf16-code-units";
  text: string;
  entries: readonly {
    pointer: string;
    spans: readonly {
      start: number;
      end: number;
      unit: "utf16-code-units";
      role: "key" | "value";
    }[];
  }[];
}
```

Spans are half-open `[start, end)` offsets into `text`. The empty JSON Pointer maps to
the root value. Every node receives a value span. Each object child pointer also receives
the quoted and escaped key span. A pointer can therefore have multiple spans with
different roles.

UTF-16 code units match JavaScript string indexing. They are not Unicode code points or
UTF-8 bytes. This distinction is tested with non-BMP and escaped Unicode content.
