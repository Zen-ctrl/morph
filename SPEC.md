# MORPH: Model Optimized Representation for Prompt Handoffs

## Implementation specification for a coding agent

Specification version: 0.1.0  
Prepared: September 21, 2026  
Status: Proposed engineering specification, not an implemented or benchmarked product  
Canonical filename in the implementation repository: `SPEC.md`

## 0. Your assignment

Build MORPH as a working representation compiler, not a chatbot, not another format manifesto, and not a dashboard with mocked numbers.

MORPH accepts structured data, its schema when available, a task description, a target model/tokenizer profile, and constraints. It generates several reversible physical representations, measures the actual rendered text with the selected tokenizer, applies policy and evidence gates, and returns a selected representation with a reproducible explanation.

The primary deliverables are a local TypeScript SDK, a command-line interface, a conformance and evaluation harness, and a local browser comparison workbench. A Jev planner adapter is an optional extension. The core must work without an account, API key, network connection, Firebase project, or hosted database after its dependencies and tokenizer assets have been installed.

Implement working code and tests in dependency order. Do not stop after writing an architecture document. Do not claim a live integration or model-quality result unless it has actually been exercised. Record unavailable credentials or unsupported provider capabilities as specific blockers while completing the independent local work.

Read `AGENTS.md`, this specification, and `REFERENCES.md` before implementing. This specification controls the product contract. Record deliberate deviations in `docs/decisions/` and explain their impact.

### 0.1 Writing and repository conventions

Use clear English and no em dashes in authored documentation or product copy. Do not add an AI model, coding agent, or vendor as an invented author, contributor, or coauthor. Preserve legitimate upstream attribution and license notices. Do not falsify commit identity or remove attribution already required by dependencies.

Use the user's installed GitHub CLI when repository operations are authorized. Repository publication and package publication are separate actions. The safe default is a new private repository; do not change an existing repository's visibility. Build an open-source-ready codebase, but public release requires an explicit owner-selected setting. The presence of Firebase and Vercel CLIs does not make those services dependencies of this project.

### 0.2 The central invariant

For every supported encoding and every accepted input:

```text
semanticEqual(decode(encode(input)), input) == true
```

Also test that the self-contained model-facing bundle, not merely an undisclosed machine-side original, contains everything required to reconstruct the input.

This is a software preservation guarantee. It is not a guarantee that a language model will understand every encoding equally well.

## 1. Product definition

MORPH is a compiler for structured model context. Its input object is a request, not the entire product. Its output artifact contains a physical plan and rendered data. The compiler is the software that connects them.

```text
Application data and optional schema
                 |
                 v
Strict JSON-compatible intermediate representation
                 |
                 v
Shape profiler and task hints
                 |
                 v
Legal candidate plans
                 |
                 v
Encoders, decoder checks, complete-prompt token counting
                 |
                 v
Compatibility, resource, budget, and quality gates
                 |
                 v
Deterministic selection and explain report
                 |
                 v
Self-contained model context plus machine-readable artifact
```

The logical data model stays stable while the physical text can change. Examples of targets include compact JSON, JSON Lines, typed delimited rows, column-oriented JSON, typed path/value records, and an official TOON adapter.

An initial hypothesis is that access patterns can inform layout selection. Entity-centered tasks may favor records, some comparisons may favor aligned columns, and sparse trees may favor paths. These are hypotheses to evaluate, not database facts automatically inherited by transformer models.

### 1.1 A concrete successful interaction

A developer supplies the same complete customer dataset twice, once with a lookup task and once with a comparison task. MORPH generates eligible alternatives and produces an explain report for each request. The selected plans may differ, or the same plan may win both times. Every row and field remains recoverable in lossless mode. Every displayed token count identifies its tokenizer and scope.

A valid outcome is that compact JSON wins. Another valid outcome is that a compact alternative is smaller but remains unqualified for automatic use because no model-quality evidence exists.

### 1.2 What MORPH is not

MORPH v1 is not a database engine, general-purpose query executor, language-model trainer, agent operating system, retrieval system, or universal binary codec. It does not replace native provider tool-call schemas. It does not make private schema IDs intrinsically meaningful to a model. It does not promise a fixed token reduction or improved reasoning.

It does not silently summarize, truncate, filter, project columns, reorder arrays, deduplicate records, round numbers, translate values, invent units, or calculate aggregates. Those are separate transformations that require separate contracts.

## 2. Corrections that must survive implementation

These are important product boundaries, not optional caveats.

**Re-encoding is not projection.** Sending only `country` and `revenue` from a larger customer record drops information. That is not a lossless representation of the original record. Task hints may influence physical layout without authorizing data removal.

**A schema ID is not model memory.** A registry can resolve an ID for software. The model must still receive the relevant definition through an included bundle, a verified retained context, or an explicit tool/runtime mechanism. In the default path, include all required meanings.

**Smaller is not necessarily easier.** Dictionaries, masks, compact labels, and arithmetic encodings can create an interpretation burden. A passing decoder test establishes recoverability, not model accuracy.

**Binary transport and model input are distinct.** A compressed file or base64 string can reduce a transport concern while making text-model input less useful. Do not count compressed bytes as prompt tokens.

**Tokenizers are explicit dependencies.** An unknown model ID must not silently map to a convenient tokenizer. Character estimates are estimates, never exact counts.

**Quality estimates require evidence.** Heuristic preferences and a model's confidence are not measured downstream accuracy. Never fabricate an `expectedAccuracy` field.

**Caching is a separate dimension.** Repeated prefix reuse, schema registry hits, local plan-cache hits, and smaller prompt text are different things. Keep their metrics separate. See reference R4 for provider prompt caching and R8 for Jev confidence.

## 3. Release scope

### 3.1 Required local release

Deliver all of the following before declaring the local release complete:

1. A strict parser and typed JSON-compatible IR with preservation tests.
2. A profiler and bounded deterministic candidate generator.
3. Five native targets: compact JSON, JSON Lines, delimited rows, column JSON, and typed path/value.
4. An optional official TOON target with versioned conformance checks.
5. At least one real local tokenizer adapter, explicit model binding, and exact-text versus request-estimate labels.
6. A planner with explain output, budget enforcement, baseline fallback, and no invented quality evidence.
7. A self-contained artifact format, model renderer, decoder, SDK, and CLI.
8. Offline conformance tests, deterministic token benchmarks, and a model-evaluation harness that does not run paid calls by default.
9. A browser workbench that uses the real compiler and displays honest states.
10. Documentation, reproducible build commands, local examples, and a release checklist.

### 3.2 Optional extension release

Add dictionary transforms, explicit missingness masks, block-wise hybrid layouts, schema registry hydration, and Jev after the native compiler is stable. These extensions must not be quietly represented as complete in the local release.

A verified Jev integration is desirable but must not block local compilation. Packed bitmaps, delta encoding, arbitrary binary targets, query execution, and learned cost models trained on evaluation results belong after the core release.

### 3.3 Unsupported scope must be explicit

An unsupported input or transform must yield a typed error or an explained baseline choice. Do not silently change the request's semantics to make an encoder succeed.

## 4. Implementation stack and repository structure

Use TypeScript with strict type checking, an actively supported Node.js LTS compatible with the selected packages, and a locked package manager version. Determine actual versions from the local environment and official package documentation at implementation time. Record exact selections and why in `docs/dependencies.md`.

Use a pnpm workspace unless the local project already requires a different manager. Use a normal unit-test runner, property-based testing such as fast-check, and a minimal React/Vite browser workbench. These are implementation choices, not claims that those packages are uniquely optimal. Reference R10 documents the property-testing approach.

Keep the compiler's pure modules browser-compatible. Put filesystem, process, HTTP, and provider-specific code in adapters. Tokenizer assets must be locally available for offline operation. A development-only Python oracle may use official tiktoken to generate or verify TypeScript tokenizer fixtures; Python must not become a hidden runtime dependency of the browser or SDK.

Suggested workspace:

```text
morph/
  AGENTS.md
  SPEC.md
  README.md
  REFERENCES.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  .gitignore
  .env.example
  .github/workflows/ci.yml
  packages/
    core/src/
      api/
      ir/
      validation/
      profiling/
      planning/
      artifacts/
      rendering/
      errors/
    encoders/src/
      json-compact/
      json-lines/
      rows-delimited/
      columns-json/
      path-value/
    tokenizer-adapters/src/
    toon-adapter/src/
    cli/src/
    evaluation/src/
    schema-registry/src/       # extension
    jev-planner/src/           # extension
  apps/
    workbench/
  fixtures/
    conformance/
    examples/
    tokenizer/
    benchmark-manifests/
  tests/
    unit/
    property/
    integration/
    security/
    e2e/
  scripts/
  docs/
    architecture.md
    format.md
    semantics.md
    api.md
    cli.md
    benchmarking.md
    security.md
    dependencies.md
    release.md
    decisions/
  reports/                    # ignored except curated synthetic examples
```

Workspace package scopes are provisional. Do not assume an npm scope or package name is owned or available. Keep package publication disabled until explicitly approved.

### 4.1 Dependency direction

`core` owns interfaces and orchestration. Encoders and tokenizers implement those interfaces. Core does not import a provider SDK, Jev, filesystem access, or a browser UI. The CLI and workbench compose registered adapters. Evaluation imports the compiler, not vice versa. A quality profile is an input artifact, not an excuse for core to launch live tests during a production compile.

## 5. Semantic model and strict input handling

### 5.1 Two input entry points

Support `compileJson(text, options)` and `compileValue(value, options)` through one underlying request API.

For JSON text, preserve number lexemes in the IR before any conversion to JavaScript numbers. For JavaScript values, accept only the documented JSON-compatible subset and create numeric lexemes from the already-existing number values. The compiler cannot restore precision that was lost before it received a JavaScript value.

Do not implement input handling as `JSON.parse(JSON.stringify(value))`. That silently invokes behaviors and drops distinctions that the compiler must either preserve or reject.

### 5.2 IR definition

Use an explicit tagged tree. This reference shape is normative in intent; equivalent readonly types are acceptable.

```ts
type IRNode =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "number"; lexeme: string }
  | { kind: "array"; items: readonly IRNode[] }
  | {
      kind: "object";
      entries: readonly (readonly [string, IRNode])[];
    };

interface MorphIR {
  irVersion: "morph-ir/1";
  root: IRNode;
  inputKind: "json-text" | "js-value";
  semanticDigest: string;
}
```

A number lexeme is a grammar-validated JSON numeric token, such as `123`, `-0`, `1.2300`, or `9e30`. It is never an arbitrary executable expression. Preserve it across native encoders. Do not round or automatically expand it.

Use a strict parser that retains numeric tokens and detects duplicate keys before a map can overwrite them. A reviewed dependency is preferable when it satisfies this contract. A small dedicated parser is acceptable only with grammar, fuzz, depth-limit, and differential tests. Reference R1 explains JSON's types, duplicate-key interoperability concern, and numeric limitations.

### 5.3 What equality means

For the preservation assertion, require:

- Identical object key sets and recursively equivalent values. Object member display order is not part of the guarantee.
- Identical array length, item order, and recursively equivalent items.
- Identical string contents, including whitespace. Do not normalize Unicode or line endings inside strings.
- Identical booleans and nulls.
- Identical number lexemes for JSON-text inputs. This is deliberately stricter than mathematical equality.
- Identical numeric representation generated by the JS-value adapter for accepted JavaScript numbers, including explicit handling of negative zero.

Original source whitespace, object member display order, and escape spelling such as `"a"` versus `"\u0061"` do not have to be preserved. Do not call this byte-for-byte source preservation.

`decode()` returns an IR. `decodeJson()` returns valid JSON text using preserved numeric lexemes. A convenience conversion to JavaScript values is optional and must reject precision-unsafe conversions by default. A conservative rejection of an uncertain conversion is acceptable. Never silently change numeric nodes into strings just to pass tests.

### 5.4 Input rejection and edge cases

Reject invalid JSON, duplicate object keys, cycles, undefined values, functions, symbols, BigInt passed as a JS value, nonfinite JS numbers, sparse JS arrays, unsupported class instances, and input beyond configured resource limits. Reject a BigInt input with a message explaining that exact large JSON numbers can instead enter as JSON text.

For the JS-value path, do not call custom `toJSON` methods or access getters. Inspect ordinary own data properties. Reject unsupported prototypes or accessor properties. Treat arbitrary hostile JavaScript objects or proxies as outside the untrusted-text security boundary; use the JSON-text entry point for hostile inputs.

Choose and document a Unicode policy. Recommended v1 policy: accept well-formed Unicode scalar strings and reject lone surrogates rather than silently rewriting them. Test composed and decomposed Unicode as distinct strings. Do not imply support for every permissive JSON parser's Unicode behavior.

Keys such as `__proto__`, `constructor`, `prototype`, empty strings, slashes, tildes, numeric-looking strings, and delimiter characters are valid data. Preserve them safely using Maps, null-prototype objects, or safe property construction. They must not modify prototypes.

### 5.5 Digests and reproducibility

Define a versioned deterministic canonical serialization for semantic digests. Sort object keys using a fixed, locale-independent comparison. Include node types and unambiguous lengths. Preserve numeric lexemes and array order. Use a standard cryptographic digest implementation.

A digest detects mismatches; it is not an authentication signature or proof that an artifact is safe. Do not expose cross-tenant data digests through a future public cache.

## 6. Schema handling

An input schema is optional. When supplied, retain its original meaning and associate it with the input's semantic scope. Use an explicit JSON Schema dialect, with draft 2020-12 as the initial supported choice. Reference R9 documents that dialect.

Schema validation and schema inference are different operations. Inference may produce structural observations such as field types or nullability. It must not invent units, business rules, meanings, permissions, identifiers, or required-field claims from a sample. Report inference coverage and uncertainty.

Disable remote `$ref` fetching by default. Accept bundled schemas or references resolved by an explicitly registered local resolver. Configure validators so they do not coerce types, insert defaults, remove additional properties, or mutate data.

A schema validator built on JavaScript numbers cannot automatically validate arbitrary-precision numeric bounds over raw number lexemes. Either implement exact numeric validation for the relevant keywords or return a clear `SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` result for those cases. Never round numbers before validating and report that as exact validation.

The default model bundle includes caller-supplied schema meaning when the caller has requested it as context. Structural layout metadata, such as a list of column names, does not replace user-supplied descriptions or units. An optional smaller prompt-schema projection requires an explicit, auditable contract and is not part of lossless v1 schema handling.

Treat untrusted descriptions and property names as data, not high-priority instructions.

## 7. Public SDK contracts

These interfaces define the intended public behavior. Implement runtime validation as well as static types. Final exported types must have no unresolved placeholders or `any` in core contracts.

```ts
type AccessPattern =
  | "unknown"
  | "entity-lookup"
  | "multi-entity-comparison"
  | "aggregation"
  | "filtering"
  | "nested-path-lookup"
  | "sequence-analysis";

type PlannerPolicy =
  | "compatibility"
  | "economy-experimental"
  | "validated";

interface MorphTask {
  instruction: string;
  accessPattern?: AccessPattern;
  relevantPaths?: readonly string[];
  preserveReadableLabels?: boolean;
}

interface TargetProfile {
  profileId: string;
  tokenizerId: string;
  tokenizerRevision: string;
  modelId?: string;
  modelRevision?: string;
  providerId?: string;
  contextWindowTokens?: number;
}

interface MorphConstraints {
  mode: "lossless";
  maxPromptTokens?: number;
  reservedOutputTokens?: number;
  maxInputBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxCandidates?: number;
  maxRenderedBytes?: number;
  maxPlanningMs?: number;
  allowNetwork?: boolean;
}

interface PlannerOptions {
  policy: PlannerPolicy;
  objective: "prompt-tokens" | "estimated-request-cost";
  allowedEncodings?: readonly string[];
  forcedEncoding?: string;
  allowExperimentalTransforms?: boolean;
  qualityProfileId?: string;
  pricingProfileId?: string;
  minimumSavingsTokens?: number;
  minimumSavingsFraction?: number;
}

interface MorphRequest {
  data:
    | { kind: "json-text"; text: string }
    | { kind: "js-value"; value: unknown };
  schema?: unknown;
  task: MorphTask;
  target: TargetProfile;
  constraints: MorphConstraints;
  planner: PlannerOptions;
  context?: {
    prefix: string;
    suffix: string;
  };
}

interface TokenMeasurement {
  count: number;
  tokenizerId: string;
  tokenizerRevision: string;
  textDigest: string;
  scope: "rendered-text" | "provider-request";
  certainty: "exact-for-tokenizer" | "provider-reported" | "estimate";
  assumptions: readonly string[];
}

interface QualityEvidence {
  status: "unknown" | "insufficient" | "qualified" | "failed";
  profileId?: string;
  taskFamily?: string;
  baselineEncoding: "json-compact";
  pairedAccuracyDelta?: number;
  lowerConfidenceBound?: number;
  upperConfidenceBound?: number;
  uniqueCaseCount?: number;
  independentDatasetCount?: number;
  evidenceDigest?: string;
}

interface MorphError {
  code: string;
  message: string;
  path?: string;
  details?: Readonly<Record<string, unknown>>;
}

type CompileResult =
  | { ok: true; artifact: MorphArtifact; report: ExplainReport }
  | { ok: false; error: MorphError; report?: ExplainReport };
```

`MorphArtifact` and `ExplainReport` are specified in sections 12 and 13. Implement their full types in code.

Expose at least:

```ts
createMorph(registry, options)
morph.compile(request): Promise<CompileResult>
morph.compare(request): Promise<ComparisonReport>
morph.decode(artifact): MorphIR
morph.decodeJson(artifact): string
morph.renderModelContext(artifact): ModelContext
morph.verify(artifact): VerificationReport
```

`compare()` may evaluate and report candidates that are not eligible for automatic selection, but it must label their eligibility. A forced encoding never bypasses semantic correctness, resource limits, or tokenizer requirements. Experimental quality risk requires the explicit experimental policy.

An unknown `accessPattern` is normal. Do not require an LLM call to interpret every task. `relevantPaths` is a layout hint, not authorization to delete the other paths.

## 8. Profiler and candidate generation

Traverse the IR once where practical. Record root kind, total nodes, depth, object counts, array counts, candidate record-array paths, record counts, field sets, uniformity, observed type sets, string lengths, boolean counts, null counts, missing-key counts, and repeated scalar statistics.

Separate missingness from explicit null. A field absent in 80% of records is not equivalent to a field present as null in 80% of records.

Use exact statistics for bounded input. When sampling is needed for candidate generation, make it seeded and report sample coverage. Sampling cannot authorize dropping rows, declare full-input conformance, or replace full final token measurement. Encoder eligibility must be verified against all encoded data.

Cap cardinality maps and sampled strings to avoid using more memory on profiling than on the input. Do not include raw values in public telemetry. By default, explain reports show counts and paths, not sensitive example values.

### 8.1 Candidate search

Always generate the compact JSON baseline first. Generate a bounded, stable list of applicable layouts. For delimited rows, enumerate only a small safe delimiter set, initially tab, comma, pipe, and semicolon. Reject unsupported combinations rather than constructing arbitrary punctuation grammars.

Use estimated byte size and shape statistics only to prune obvious nonstarters. Fully encode, decode-verify, render, and tokenize every finalist used for final selection. Keep candidate enumeration order and tie-breaking deterministic.

Default target: at most 24 candidate configurations and at most 8 fully retained candidate buffers at once. These are configurable engineering limits, not measured optimal values. Render sequentially or with bounded concurrency, keep small metrics records, and release discarded buffers.

Report both candidates considered and candidates pruned, including reasons. Do not advertise a global optimum over encodings that were never searched.

## 9. Encoder interface and physical formats

### 9.1 Interface

Every encoder must expose a version, applicability checks, candidate enumeration, encoding, decoding, and a static interpretation guide. Registration is explicit. Do not load arbitrary executable plugins from an uploaded artifact.

```ts
interface EncoderApplicability {
  supported: boolean;
  reasons: readonly string[];
}

interface EncoderPlan {
  encoding: string;
  formatVersion: string;
  options: Readonly<Record<string, unknown>>;
}

interface EncodedSection {
  encoding: string;
  formatVersion: string;
  payload: string;
  layoutMetadata: Readonly<Record<string, unknown>>;
  interpretationGuideId: string;
}

interface MorphEncoder {
  readonly id: string;
  readonly formatVersion: string;
  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability;
  enumerate(ir: MorphIR, hints: MorphTask): readonly EncoderPlan[];
  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection;
  decode(section: EncodedSection): MorphIR;
}
```

The decoder must validate the representation. It must not repair malformed input, guess missing cells, coerce types, or read the original data from a closure or hidden cache. Decoder invariants include declared lengths, row widths, duplicate fields, valid scalar grammars, and bounded allocations.

Each guide is trusted, versioned compiler-owned text. Values and caller-supplied descriptions are not interpolated into high-priority instructions. A guide describes how to interpret data, not how to override an application's policy.

### 9.2 `json-compact`, format version 1

Support every accepted IR. Print strict JSON without unnecessary structural whitespace. Preserve numeric lexemes. Escape strings correctly and preserve their contents. Do not simply cast arbitrary-precision IR numbers through JavaScript's native number type.

This is the baseline against which prompt savings are calculated. A prettified JSON baseline may be shown as an additional comparison, but it must not replace compact JSON as the primary baseline to inflate savings.

The interpretation guide may be empty or minimal for this target. Do not add an artificial verbose guide to JSON while omitting necessary guides from unfamiliar formats.

### 9.3 `json-lines`, format version 1

Support a root array. Encode each array element as one compact JSON value per physical line. Use a shared layout declaration containing the root type, element count, and line framing version. A zero-length array is an explicit zero-count representation, not an ambiguous empty file.

The decoder uses the declared array count and rejects extra or missing lines. Escaped newline characters inside strings stay inside a single physical line. Preserve every element, including repeated or primitive elements. A root object is not automatically converted to an array.

Keep metadata required to reconstruct the root in the self-contained bundle. Label this as a MORPH-framed JSON Lines representation, rather than pretending an unframed stream preserves its root type by itself.

### 9.4 `rows-delimited`, format version 1

Initial applicability: a nonempty root array of objects with identical key sets, where every cell is a JSON primitive. Null is a valid primitive. A zero-row or zero-column special case may fall back to JSON until explicitly supported and tested.

Field names are declared once. Cells appear in that exact field order. The field order is deterministic, initially based on the first record's key order. Do not sort or reorder rows.

Use JSON scalar lexical rules for cells. Strings are always quoted and escaped as JSON strings. Numbers retain their JSON lexemes. Booleans and null use their literal spelling. This avoids the ambiguity between `123` and `"123"`, between null and `"null"`, and between an empty string and a missing value.

The section's layout metadata contains:

```json
{
  "root": "array-of-objects",
  "rowCount": 3,
  "fields": ["id", "country", "revenue", "active"],
  "delimiter": "\t",
  "cellCodec": "json-scalar-v1"
}
```

Conceptual payload, with actual tabs between cells:

```text
"c1"\t"US"\t129\ttrue
"c2"\t"CA"\t85\tfalse
"c3"\t"US"\t220\ttrue
```

The displayed `\t` above is explanatory notation; the real tab candidate uses U+0009 as its delimiter. Document that distinction in examples.

The parser must recognize separators only outside quoted JSON strings. It must not use a naive `split(delimiter)`. Reject invalid scalar text, extra cells, missing cells, duplicate field names, extra rows, and count mismatches. A pipe inside `"a|b"` is part of the string.

This is MORPH's typed delimited dialect. Do not claim universal compatibility with arbitrary CSV or TSV readers. A future generic CSV export is a separate interoperable format target.

### 9.5 `columns-json`, format version 1

Initial applicability: the same uniform primitive record arrays as `rows-delimited`. Render one JSON array per field, retaining row alignment and source row order.

The logical section consists of:

```json
{
  "fields": ["id", "country", "revenue", "active"],
  "rowCount": 3,
  "columns": [
    ["c1", "c2", "c3"],
    ["US", "CA", "US"],
    [129, 85, 220],
    [true, false, true]
  ]
}
```

The actual printer must preserve number lexemes. The guide explains that index `i` across every column reconstructs original row `i`. Validate identical column lengths, unique field names, and the declared row count.

This target may keep data as JSON while changing the logical arrangement of the prompt representation. That is intentional: MORPH is not required to invent a new syntax to provide a new physical layout.

Do not assume column layout wins aggregation. Test row alignment, cross-field conditions, positional mistakes, and joins back to identifiers. Blocked column layouts may be a later candidate to limit long-distance alignment demands.

### 9.6 `path-value`, format version 1

Support every accepted IR. Use JSON Pointer paths following RFC 6901. The root path is the empty string, not `/`. Encode `~` in a key as `~0` and `/` as `~1`; decode in the correct order. Reference R2 defines these rules.

Use typed JSON Lines node records. Emit a record for every container, including empty containers. Numbers are represented by a type tag plus a string containing their exact numeric lexeme. This is unambiguous because the tag distinguishes a number from a string value.

Record shapes:

```text
[path, "object"]
[path, "array", itemCount]
[path, "string", stringValue]
[path, "number", numericLexemeString]
[path, "boolean", booleanValue]
[path, "null"]
```

Example input:

```json
{"account":{"id":"c1"},"flags":[true,null],"empty":{},"amount":1.2300}
```

Example payload:

```json
["","object"]
["/account","object"]
["/account/id","string","c1"]
["/flags","array",2]
["/flags/0","boolean",true]
["/flags/1","null"]
["/empty","object"]
["/amount","number","1.2300"]
```

A key `"0"` inside an object and index zero inside an array are distinguished by the parent container record. A null value is not an absent path. An empty object is not an empty array.

Reject duplicate node paths, missing parents, conflicting container declarations, children under primitives, out-of-range indices, holes in arrays, invalid pointer escapes, invalid type tags, incorrect record arity, invalid numeric lexemes, and more than one root.

Use Maps or safe object construction during reconstruction. Do not allow an input path to traverse filesystem paths or JavaScript prototypes.

### 9.7 `toon`, external adapter

Use the official `@toon-format/toon` implementation rather than inventing a TOON-like grammar and calling it TOON. Pin the package, format version, supported options, and conformance fixtures. The official documentation exposes encode/decode support and configuration; recheck exact APIs at implementation time. See R3.

An official library's accepted JSON-serializable values may be broader or narrower than MORPH's preservation contract. The adapter must gate supported inputs. In particular, converting number lexemes to JavaScript numbers can lose precision or spelling. Only accept conversions demonstrated to preserve the MORPH equality contract, or use an implementation path that retains those tokens. Otherwise report `ENCODER_NOT_APPLICABLE` and keep native candidates.

Validate TOON round trips independently. Include the actual interpretation guide and any required schema in its counted model input. Do not copy headline benchmark percentages into MORPH's README as MORPH results.

### 9.8 Dictionaries, extension

Implement dictionary encoding as an explicit typed column transform, not global text search-and-replace. Initially allow it only on caller-approved categorical fields or in explicitly experimental mode.

A transformed string column may be represented as:

```json
{
  "kind": "dictionary-column",
  "valueType": "string",
  "dictionary": ["United States", "Canada"],
  "indices": [0, 1, 0]
}
```

Include all dictionary entries in the model bundle. Use deterministic entry ordering, initially first occurrence. A dictionary index is never an application identifier. Count the dictionary and guide overhead along with the indices. Low cardinality alone does not prove a net token saving.

Do not replace long free-text descriptions, names that the task must recognize, or readable labels with opaque codes by default. A model may need direct semantic access to them. A task-aware candidate must still pass the same model-quality gate.

Null and missingness require explicit channels, not overloading a valid string or index. Out-of-range indices are fatal decode errors. Duplicate dictionary entries are rejected in the canonical form to avoid nondeterministic representations.

### 9.9 Missingness and boolean masks, extension

For heterogeneous record arrays, distinguish at least three states: absent property, present null, and present value. A nullable boolean may require four: absent, null, false, and true.

A simple first extension uses explicit `present` and `nonNull` masks plus values. Specify mask length, order, interpretation, and tail rules. Validate consistency before allocating or decoding.

Do not assume that concatenated bits are easy for a model to index. Test readable arrays, blocked bit strings, and sparse index lists before selecting any. Packed binary masks are not default text-model context. The ordinary JSON/row/path targets remain available.

### 9.10 Hybrid layouts, later extension

A hybrid plan is a tree of disjoint source subtrees, each with a selected encoding. Every original subtree must have exactly one reconstructable owner. The manifest binds each section to its original JSON Pointer. Detect overlaps, holes, duplicate ownership, and shape conflicts.

When a dataset contains metadata plus a uniform records array, metadata may remain JSON while the array uses a table target. Preserve both. Count section framing and reconstruction metadata. Do not introduce hybrid planning until flat targets are stable; it multiplies the search space.

## 10. Token measurement and target binding

### 10.1 Adapter contract

A tokenizer adapter identifies its vocabulary, revision or content digest, normalization behavior, added/special-token policy, and count method. Expose a deterministic `countText(text)` and, where practical, token IDs for debugging on synthetic fixtures.

A user-specified model profile binds a model to a tokenizer through verified configuration. A tokenizer name is not necessarily the same as a model name. No guessed aliases, invented model IDs, or default fallback mappings.

At least one genuine local text tokenizer is required. A TypeScript port must be checked against authoritative fixtures from the corresponding implementation, including whitespace, punctuation, Unicode, numeric strings, delimiters, and special-token-looking input. Reference R5 is the official tiktoken project. Label third-party ports accurately.

When the model's exact tokenizer or full request accounting is unavailable, either reject an exact-budget request or require an explicitly labeled estimate. A rough `characters / 4` counter must never appear as a real tokenizer adapter.

### 10.2 Measure the final rendered text

For every finalist, render exactly what the downstream integration will send, including:

- Compiler interpretation guide.
- Layout declaration and field names.
- Included input schema and descriptions.
- Dictionary and mask definitions.
- Framing, task text, and caller-provided prefix/suffix.
- Payload.

Tokenize that complete render. Tokenization can cross component boundaries, so a sum of separately tokenized pieces is not necessarily the count of their concatenation. Component diagnostics may be presented as standalone counts, clearly marked non-additive, or as ordered prefix deltas. The final full-render count is authoritative for that rendering.

Keep explain JSON, checksums, debugging details, and performance statistics outside the model prompt unless the renderer really sends them. This prevents both unfair overhead and recursive self-counting.

### 10.3 Text counts versus provider request counts

Exact counting with a local tokenizer establishes a count for the visible rendered text under that tokenizer. It does not automatically establish exact billed tokens for a chat request with provider framing, hidden instructions, tool schemas, images, or output-schema handling.

Provider adapters may add full request counting when officially supported. They must label whether a count is provider-reported, an exact local text count, or an estimate. Record assumptions and compare actual usage in live evaluations.

Offline profiles without a verified model binding must say `model quality unbound` and `exact for tokenizer only`. Do not display a fake production model name to make the workbench look complete.

### 10.4 Budget rules

A caller's `maxPromptTokens` limits the declared counting scope. When a context-window size is supplied, enforce the provider-specific rule for prompt plus reserved output and known overhead. Reject inconsistent configuration. Unknown overhead must not be presented as zero.

If no candidate fits, return `BUDGET_EXCEEDED` with the smallest verified count and a diagnostic explanation. Do not silently truncate or return an over-budget JSON fallback as success.

When even the baseline cannot be completely rendered within a resource limit, return a resource error rather than a misleading token result.

## 11. Planner policy, evidence, and objective

### 11.1 Three policies

`compatibility` is the default. With no applicable quality evidence, select compact JSON. Still allow `compare()` to show smaller alternatives and why they were not auto-selected. When a qualified profile is explicitly installed, compatible alternatives can be considered under that profile.

`economy-experimental` selects among reversible, supported alternatives using measured prompt tokens and the user's allowed set. It must state that model comprehension is unverified unless actual evidence exists. This is the mode for trying new representations, not a claim of production-grade noninferiority.

`validated` requires an applicable quality profile for every nonbaseline selected family, matching the actual target and workload scope. If no alternative is qualified, use JSON when it fits. If strict requirements cannot be met, return the specific failure rather than weakening policy silently.

A forced format in experimental mode is useful for benchmark construction. In validated mode it must also have qualifying evidence. Forcing a format bypasses cost ranking and minimum-savings hysteresis, but does not bypass decoding, policy, or budget checks. Its reason code must identify an explicit caller selection rather than a cost-optimizer win.

Always measure the JSON baseline for comparison. If an explicit `allowedEncodings` set excludes JSON, do not silently select it as a fallback. With no permitted qualified plan, return `NO_ELIGIBLE_PLAN`. The default allowed set includes JSON.

### 11.2 Hard gates before cost ranking

Apply these gates before ranking:

```text
input accepted
-> encoder supports full input
-> candidate within resource limits
-> decode/round-trip verification passes
-> self-contained dependency check passes
-> tokenizer and model/profile binding acceptable
-> requested experimental-feature policy satisfied
-> applicable quality gate satisfied
-> actual rendered prompt fits the budget
-> eligible for final ranking
```

Keep a rejection reason at each gate. A round-trip failure is a bug signal, not a normal optimization opportunity. In development and CI, fail loudly. In a production fail-closed mode, quarantine the broken encoder and return a verified baseline only when the baseline is valid and within budget, with an explicit warning.

### 11.3 Initial selection rule

For the default `prompt-tokens` objective, select the eligible candidate with the lowest final rendered token count, subject to a minimum net improvement over baseline. Proposed initial hysteresis defaults: at least 16 tokens and at least 2% savings, both configurable. These are policy defaults to test, not empirical facts.

Tie-break deterministically: baseline preference, fewer interpretation mechanisms, then a stable plan ID. Do not use a noisy wall-clock sample to break ties and then claim deterministic plans.

Task hints can limit the candidate set or prioritize bounded search. Do not invent an accuracy penalty such as `columnarError = 0.02` without evidence. Label hand-written preferences as heuristics in the trace.

### 11.4 Cost-aware mode

`estimated-request-cost` requires a versioned pricing/caching profile and a declared reuse scenario. Unknown prices must remain unknown. Do not hardcode advertised prices into core or equate fewer uncached bytes with cheaper model input.

Conceptually:

```text
estimated total cost =
  compiler compute cost
  + optional planner call cost
  + uncached input cost
  + cache read/write cost, when applicable
  + estimated output cost
  + estimated retry cost, when supported by evidence
```

Only use components with defensible inputs. Report estimates and ranges. Without a usable price profile, reject that objective or explicitly use a caller-approved token objective. Do not silently substitute it.

The planner should expose Pareto candidates for token count, measured compiler time, and qualified task quality. Do not combine unlike units with unexplained weights and call the result scientifically optimal.

### 11.5 Quality qualification

A quality profile records benchmark provenance, exact or recorded model revision, tokenizer revision, prompt/guide version, encoding options, task family, dataset characteristics, case counts, answer schema, evaluation metric, paired results, and uncertainty.

Define quality as a change relative to compact JSON on matched cases. For binary correctness, let:

```text
delta = accuracy(candidate) - accuracy(compact JSON)
```

A noninferiority gate qualifies only when the lower confidence bound for delta exceeds `-allowedRegression`. Choose the regression margin before evaluating the held-out test set. A point estimate alone is insufficient.

Implement a documented paired, dataset-clustered uncertainty method or a conservative supported alternative. Do not treat repeated calls on the same dataset as independent datasets. Small smoke tests may be labeled informative but must not produce a strong quality certification.

Quality evidence can become stale after a model, guide, renderer, encoder, or workload change. Invalidate profiles on those mismatches. A model alias that may change behind the scenes needs an expiration/revalidation policy.

### 11.6 Determinism and planning budgets

Given the same accepted IR, task, profiles, configuration, and completed search budget, compilation must produce the same selected plan and model context. Timestamps and measured runtimes belong in a separate report, not the semantic artifact identity.

A wall-clock deadline can interrupt work at different points on different machines. Do not select an arbitrary incomplete-search winner and claim strict determinism. Prefer a deterministic candidate cap; return an explicit timeout or a documented baseline-only fallback when the deadline is hit. Keep timeout behavior distinguishable from a completed optimization.

## 12. Artifact, model bundle, and decoder contract

Separate the machine envelope from what is actually sent to a model. Debug reports must not accidentally become prompt overhead.

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
    plannerPolicy: PlannerPolicy;
  };
  section: EncodedSection;
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
    templateVersion: string;
  };
  integrity: {
    payloadDigest: string;
    dependenciesDigest: string;
    algorithm: string;
    canonicalizationVersion: string;
  };
}

interface ModelContext {
  format: "morph-context/1";
  interpretationGuide: string;
  dataBlock: string;
  selfContainedBundle: string;
  rendered: string;
  renderedDigest: string;
}
```

Extensions may add a new artifact version or a separately typed dependency mode. Do not add an ambiguous optional reference that can silently change a self-contained artifact into a reference-only one.

### 12.1 Self-contained rendering

The rendered model context must contain all layout metadata, schema meaning required by the selected mode, dictionaries, and payload needed to interpret the data. A decoder must be able to reconstruct the IR from that rendered context without access to the original dataset or hidden registry entries.

`selfContainedBundle` contains the representation, schema, guide, and framing. `rendered` is the full assembled text including the task and caller prefix/suffix. Token selection measures `rendered`. The artifact's `requestFrame` stores those assembly inputs so the complete count can be reproduced after saving and reloading the artifact; it is not a hidden copy of the source dataset.

Implement `parseModelContext(selfContainedBundle)` and test its round trip. Freeze a canonical framing grammar in `docs/format.md`. A suitable implementation uses a version header, machine-parseable layout metadata, a static interpretation guide, and collision-checked begin/end markers around the payload. Markers must be deterministic and selected so complete marker strings do not occur inside the framed content. Reject malformed or ambiguous framing. Do not claim framing prevents prompt injection.

An alternative length-delimited grammar is acceptable when byte lengths and Unicode handling are correctly implemented. Models should not need to perform byte arithmetic to understand the contents. The framing choice and its overhead must appear in token benchmarks.

The artifact may include machine-only hashes, a physical-plan description, and identity metadata. Exclude them from the prompt unless necessary. The artifact must not contain an undisclosed copy of the original JSON solely to make decode tests pass.

### 12.2 Prompt assembly

Define a canonical text assembly for local comparison:

```text
caller prefix
trusted compiler interpretation guide
self-contained data block
task instruction
caller suffix
```

Use explicit separators and a versioned template. The actual implementation may separate trusted guides and untrusted data into different messages in provider adapters. When it does, measure and record that actual request assembly, not a different convenient test string.

Do not promote task text originating in tool output or user data into a system/developer role. Only caller-controlled policy and compiler-owned guides may be treated as trusted instructions. Keep native tool schemas and output schemas unchanged unless the caller uses a separate documented integration that explicitly supports the change.

### 12.3 Integrity and compatibility

Verify format versions, required fields, payload lengths where used, digests, and dependency completeness. Unknown major versions must fail closed. A tampered payload or dictionary must not decode using stale metadata.

Provide a checksum verification result distinct from semantic validity and model-quality evidence. Matching hashes do not establish that instructions are trustworthy.

### 12.4 Optional source map

After the basic decoder works, provide mappings from original JSON Pointers to encoded spans. Specify whether offsets are UTF-8 bytes or UTF-16 code units. Test Unicode and escaped strings.

A dictionary-transformed value can map to both an index span and a dictionary-entry span. A source map is allowed to be one-to-many. Do not pretend a character search alone reliably identifies the origin of repeated values.

## 13. Explain reports and observable behavior

The explanation should come from deterministic facts and reason codes. Do not call a language model to manufacture a convincing narrative.

Each comparison row must include plan ID, encoding and version, transform options, applicability, round-trip status, dependency completeness, full rendered tokens, baseline delta, measured compiler duration, quality-evidence status, selection eligibility, and rejection or selection reason codes.

Suggested report contract:

```ts
interface CandidateReport {
  planId: string;
  encoding: string;
  formatVersion: string;
  selected: boolean;
  applicable: boolean;
  roundTrip: "passed" | "failed" | "not-run";
  dependencies: "complete" | "incomplete" | "not-run";
  tokens?: TokenMeasurement;
  savingsTokens?: number;
  savingsFraction?: number;
  quality: QualityEvidence;
  eligible: boolean;
  reasonCodes: readonly string[];
  elapsedMs?: number;
}

interface ExplainReport {
  reportVersion: "morph-explain/1";
  completedSearch: boolean;
  baselinePlanId: string;
  selectedPlanId?: string;
  policy: PlannerPolicy;
  candidates: readonly CandidateReport[];
  warnings: readonly string[];
  resourceSummary: Readonly<Record<string, number>>;
}
```

For a candidate token count `Tc` and compact JSON count `Tb`, calculate savings as `Tb - Tc` and fraction as `(Tb - Tc) / Tb`, with a defined zero-baseline rule. Negative savings must remain visible. Do not clip them to zero.

Useful reason codes include `BASELINE_COMPATIBILITY`, `LOWEST_ELIGIBLE_TOKEN_COUNT`, `QUALITY_UNKNOWN`, `QUALITY_PROFILE_MISMATCH`, `BELOW_MINIMUM_SAVINGS`, `ENCODER_NOT_APPLICABLE`, `ROUNDTRIP_FAILED`, `OVER_TOKEN_BUDGET`, `EXPERIMENTAL_DISABLED`, and `SCHEMA_DEPENDENCY_MISSING`.

Use `unknown`, `not-run`, or null for unmeasured results. Zero is a measurement and must not substitute for missing data.

## 14. Schema registry, caching, and repeated handoffs

### 14.1 Registry scope

The first registry extension can be an in-memory or local-filesystem resolver. It stores versioned schema/guide bundles, resolves a content-addressed identifier, verifies its digest, and hydrates a self-contained artifact before rendering.

A registry hit reduces application lookup or transport duplication. It does not automatically remove the schema from the model's current context. In the default hydrated path, count the complete schema again as part of the rendered input.

Never fetch an arbitrary URL embedded in a schema or model artifact. Resolution must use an explicit allowlisted resolver and caller authorization.

### 14.2 Verified retained-context mode

A later integration may keep a schema in an existing conversation or provider-managed context. To omit a repeated definition, require a runtime contract that identifies the actual retained context and verifies that the schema version remains available. An application cache Boolean alone is insufficient.

A cache miss, context compaction, conversation reset, model switch, or schema change requires rehydration. A schema ID without a verified definition must not count as a valid self-contained handoff.

### 14.3 Provider prompt caching

Provider prompt caching can reuse processing for matching prefixes. It is not equivalent to sending a schema identifier in place of missing schema content. Reference R4 describes matching rendered prefixes and provider-specific behavior.

Keep static guide and schema sections stable where the provider integration benefits from prefix reuse. A task-dependent physical layout may reduce tokens but also change reusable context. Evaluate both fresh and repeated-request scenarios.

Do not promise cache hits, a fixed cache discount, or a particular TTL. Read current provider documentation, record the actual configuration, and use reported usage in live evaluations. Cached tokens still belong to the model's input/context accounting as defined by the provider; do not subtract them from context-window planning merely because their price differs.

### 14.4 Local plan-cache keys

Any plan cache must include semantic digest, schema digest, task/hints digest, target model and tokenizer revisions, renderer and guide versions, encoder versions, planner configuration, quality profile, and applicable cost profile. Do not cache by schema name alone.

Bound cache size and lifetime. Store no raw datasets by default. A future multi-user deployment must partition caches and registry permissions by tenant.

## 15. Optional Jev planner adapter

### 15.1 Role

Jev is not MORPH. It is an optional semantic decision component within MORPH. TypeSafe's current documentation describes typed questions over state, including Choice, Score, and Noul. Choice exposes a selection, probabilities, and confidence. See R6 and R7.

Jev may help classify the task's access pattern or provide bounded hints among already legal plans. It must not encode the data, calculate actual token counts, prove preservation, authorize network calls, bypass constraints, decide repository visibility, or certify downstream task accuracy.

### 15.2 Implementation sequence

First inspect the current official TypeSafe API documentation. Record the endpoint, request fields, response schema, model identifier, version resolution, timeouts, and error semantics. The inspected quick-start uses the System One endpoint and a request with state, model, and questions, but implementation must use the then-current verified contract rather than a guessed SDK.

Build a separate HTTP adapter behind an interface. Use environment-managed credentials only in an explicitly enabled local or server-side process. Do not put credentials in browser bundles, test snapshots, command-line arguments, URLs, logs, or committed files.

Create offline tests using clearly marked recorded or synthetic fixtures. Then, only with authorized credentials and a cost limit, run a real contract test. Record the resolved model version. An unrun live test must say `not-run`, not `passed`.

No global agent-plugin installation, remote shell script execution, or new dependency is authorized just because a vendor documentation page suggests it.

### 15.3 Recommended first question

Use a bounded access-pattern classification rather than asking Jev to magically predict which serialization the downstream model will understand best.

Choices:

```text
entity_lookup
multi_entity_comparison
aggregation
filtering
nested_path_lookup
sequence_analysis
unknown
```

Supply the task and permitted coarse shape statistics. Exclude raw values by default. Task text, field names, and schema descriptions can also contain private information, so remote transmission requires explicit caller permission even when the raw dataset is omitted.

Return an internal typed result containing the selected label, full option probabilities, provider confidence, model version, latency, token usage, and an abstention reason when applicable. Keep it distinct from `QualityEvidence`.

### 15.4 Authority and confidence

A Jev hint may affect bounded candidate priority or act as a tie-break among plans already qualified by deterministic policy. It cannot make an ineligible plan eligible. No plan ID returned by a remote service is trusted unless it is in the current allowed set.

Validate response type, expected option keys, finite probabilities, allowed ranges, and total probability within a documented tolerance. Reject malformed, partial, or unexpected answers.

TypeSafe documents confidence as a statistic derived from the probability distribution. It is not automatically an empirically measured probability that MORPH's selected representation will preserve downstream answer accuracy. Do not map `confidence = 0.9` into `accuracy = 90%`. See R8.

Start with a configurable conservative abstention threshold, clearly labeled a policy choice. Calibrate it later on MORPH-specific held-out data. Low confidence, timeouts, service errors, absent credentials, unauthorized data transmission, or unavailable models all return to the deterministic planner without data loss.

### 15.5 Evaluation requirement

Compare deterministic planning with Jev-assisted planning on held-out tasks. Report planner latency and cost in addition to downstream savings and answer quality. A planner that costs more than it saves is not a successful optimization merely because it uses another model.

Keep the Jev package optional. The offline CLI, tests, and workbench must run without importing or initializing it.

## 16. CLI requirements

Provide real commands after installation. The following syntax defines intended behavior; implement help text, validation, exit codes, and examples.

```bash
morph inspect --input fixtures/examples/customers.json

morph compare \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --target local-o200k-base \
  --policy economy-experimental \
  --report reports/comparison.json

morph compile \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --target local-o200k-base \
  --policy compatibility \
  --output artifacts/customers.morph.json

morph render \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.context.txt

morph decode \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.restored.json

morph verify --input artifacts/customers.morph.json
morph bench --suite conformance --offline
morph bench --suite tokens --offline
morph doctor
```

`local-o200k-base` is a local profile to implement with the real installed tokenizer and a recorded asset digest. It has no invented model binding. Its output must say exact text count for that tokenizer, with downstream model quality unbound.

Support stdin through `--input -`, and separate machine-readable stdout from diagnostic stderr. Do not overwrite existing files unless `--force` is explicit. Use atomic writes. Default reports and artifact outputs must not be uploaded anywhere.

`doctor` checks local versions, registered encoders, tokenizer assets, runtime compatibility, and optional integrations without printing credentials or making billable calls. Missing optional Jev access is informational, not a failure of the local compiler.

Use a documented nonzero exit code for invalid input, unsupported configuration, decode failure, resource limits, budget failure, timeout, and integration failure. A failed command must not leave an artifact that appears complete.

Include `--max-prompt-tokens`, `--reserved-output-tokens`, `--encoding`, `--allow-experimental`, and a network opt-in flag only where appropriate. Explain that task type `aggregation` does not execute an aggregation.

## 17. Browser comparison workbench

Build a functional local workbench after the SDK and CLI work. Do not use a UI as a substitute for the compiler.

### 17.1 Layout

Provide an input area for JSON, optional schema, task text, access-pattern hint, target profile, policy, and token budget. Include selectable synthetic examples for a uniform table, nested data, sparse objects, repeated strings, multilingual text, and tiny JSON.

Show a candidate table with encoding, tokens, savings, applicability, round-trip status, evidence status, selection status, and the reason a smaller candidate did not win. Show the selected context, machine artifact, decoded JSON, and a preservation diff. Do not replace real failures with a green success badge.

A compact summary should distinguish these four statements:

```text
Data preservation: verified / failed / not run
Token measurement: exact text / provider reported / estimated
Model comprehension: untested / evidence-qualified / failed
Selection policy: compatibility / experimental / validated
```

### 17.2 Interaction requirements

Run expensive profiling and tokenization in a worker when necessary. Allow cancellation, input-size warnings, and readable errors. Prevent stale results from a previous input from appearing as results for a newly edited input. A content digest can bind the displayed report to its input.

Allow copying the rendered context and downloading the artifact, report, and restored JSON. Include keyboard access, form labels, accessible status text, and a usable small-screen layout.

No automatic upload, account system, analytics, database, provider calls, third-party fonts, or remote tokenizer downloads on data entry. Do not persist input or tasks in browser storage by default. A user-initiated save must be explicit and clear about what is stored.

The workbench must function with locally bundled assets and networking disabled. A hosted static demo is optional and must use only synthetic defaults. Vercel deployment requires an explicit deployment instruction, not the mere existence of Vercel CLI.

## 18. Evaluation and benchmark design

### 18.1 Three independent test layers

**Layer A: Codec conformance.** Does software recover exactly the specified data semantics? This is mandatory and fully offline.

**Layer B: Prompt efficiency.** How many tokens does the final rendered context use under a specified tokenizer? This is mandatory and can be fully offline.

**Layer C: Model task quality.** Does the target model answer the actual task correctly from each representation? This requires actual model executions or clearly marked imported results. It is not implied by Layers A or B.

An implementation can complete the local release without paid evaluations, but it must then report Layer C as not run and leave automatic quality-qualified profiles empty.

### 18.2 Fixture families

Create a versioned, seeded synthetic corpus with at least these families:

| Family | Required variations |
| --- | --- |
| Uniform tables | Narrow/wide records, short/long field names, integers and strings |
| Nested trees | Objects, arrays, mixed depth, empty containers |
| Sparse records | Missing fields, explicit nulls, false, empty strings |
| Repeated categories | Small and large dictionaries, readable names, low repetition |
| Identifier-heavy data | Unique IDs, leading-zero strings, numeric-looking labels |
| Numeric edge cases | Large integers, exponents, negative zero, exact numeric lexemes |
| Unicode and escaping | Emoji, Chinese text, accents, combining marks, delimiters, newlines |
| Sequence-sensitive data | Ordered events, duplicates, position-dependent questions |
| Tiny payloads | Primitives and very small records where guide overhead dominates |
| Adversarial content | Prompt-like strings, framing markers, malicious-looking keys |

Use small, medium, and larger size strata within each family. Large performance-only fixtures must not automatically trigger remote model calls or context-window overflow.

### 18.3 Task families

Build deterministic ground-truth generators for single-record lookup, cross-record comparison, multi-field filtering, nested-path lookup, missing-versus-null questions, order-sensitive questions, and small exact aggregations. Include lookups by readable label as well as by ID, because dictionaries can affect them differently.

When a task requires exact aggregation over a large dataset, real applications should generally calculate it in code or a query engine and use a model to explain the result. That is a separate execution strategy. Do not mix precomputed answers into only one representation's benchmark and call the result a layout improvement.

### 18.4 Fair comparison protocol

Compare compact JSON and every applicable representation on the same complete information and task. Keep model settings, answer format, output token budget, and tool access consistent. Include each representation's actual necessary interpretation guide.

Keep output generation in the same structured answer format across input formats. This benchmark concerns input representation. Do not accidentally test TOON output generation against JSON input comprehension and combine the results.

Randomize trial order to reduce temporal confounding. Record random seeds and repeated trials. Use separate request contexts unless deliberately evaluating retained-context behavior. Keep fresh-request and cache-reuse experiments separate.

Record actual provider model identity, requested alias, observed version where supplied, tokenizer identity, request template, tool/output schema, request settings, input/output usage, cost basis, latency, truncation, refusal, invalid output, incorrect answer, and retry behavior.

### 18.5 Metrics

Report exact-match or task-specific deterministic correctness, format validity, unsupported/overflow rates, prompt tokens, actual reported usage when available, response length, compiler time, model latency, optional cost, and paired confidence intervals.

Report per task family, per data family, per model, and aggregate. Do not hide a bad family behind a good global average. A model refusal, parse failure, timeout, or truncation must remain in the accounting under a preregistered policy rather than disappearing from the denominator.

Separate amortized warm tokenizer performance from cold asset-loading time. Separate prompt savings from output savings, cache discounts, planner overhead, and application transport bytes.

### 18.6 Train/test separation

Keep heuristics, thresholds, and future learned cost models tuned only on development data. Hold out entire dataset generators/templates or dataset instances where appropriate, not merely different questions about the same leaked table. Freeze the test manifest before reporting qualified results.

No planner may see ground-truth answers for held-out evaluation tasks. Jev must not receive benchmark correctness labels. Do not add task answers to an interpretation guide.

### 18.7 Paid execution controls

Live evaluations are opt-in. Require explicit provider selection, authorized credentials, a maximum request count, concurrency limit, and either a cost cap with usable pricing or a separately approved call cap. No unbounded retries. Stop on budget exhaustion or repeated provider errors.

Do not run paid evaluations in pull-request CI. Store raw request/response data only when explicitly allowed, with redaction and retention controls. Synthetic fixtures are the default for shared reports.

### 18.8 Reports and claims

Export a machine-readable result manifest and a human-readable report that contains the commit, fixture version, test date, actual settings, known limitations, and all denominators. Any chart must be generated from those results.

Do not invent demonstration token counts. Test fixtures may contain expected counts only after those counts are generated and checked with the specified tokenizer. No marketing claim such as `50% cheaper` may be added until a reproducible benchmark actually supports the exact scope of that claim.

## 19. Security, privacy, and resource limits

### 19.1 Untrusted content

All dataset contents and untrusted schema text remain data. Encoding does not neutralize prompt injection. A malicious instruction inside JSON is still an instruction-shaped string after it becomes a table cell or dictionary entry.

Do not execute contents, interpolate them into shell commands, call `eval`, construct JavaScript functions, interpret paths as filesystem access, or promote content into privileged messages. Provider integrations must use least-privilege tools independently of MORPH.

Escape content in the browser as text. Do not render untrusted payloads or schema descriptions as raw HTML. Artifact imports must not cause external resource requests.

### 19.2 Network policy

Core compilation and offline tests make zero network calls. All network-capable adapters require explicit configuration and permission. A TypeSafe access-pattern query can leak the task even without raw data; treat it as a remote data disclosure.

No mandatory telemetry. No automatic uploads of fixtures, input, schema, prompt, artifact, or reports. No training-data collection switch enabled by default.

### 19.3 Resource defaults

Recommended initial local limits, to be made configurable and tested:

```text
maxInputBytes: 5 MiB
maxDepth: 64
maxNodes: 250,000
maxCandidates: 24
maxRenderedBytes per candidate: 16 MiB
max retained candidate buffers: 8
maxPlanningMs: 5,000 as an abort limit, not a performance promise
network: disabled
```

Enforce input byte limits before parsing. Check recursion depth during parsing and decoding, not only after building an enormous tree. Limit declared array lengths and dictionary sizes before allocation. Avoid quadratic repeated concatenation and repeated full-tree scans.

Reject decompression bombs if a later artifact transport supports compression. The initial artifact format should be plain text/JSON without automatic archive extraction.

Use cooperative cancellation in the pure core and worker/process termination where a hard deadline is needed. Document the difference. A user cancellation should not produce a partial successful artifact.

### 19.4 Files, logs, and secrets

Ignore datasets, generated artifacts, reports, credentials, local profiles with secrets, and environment files in Git by default. Commit only curated synthetic examples and public test data with clear licensing.

Do not print raw values in error reports by default. Include a JSON Pointer and error code. A debug option may reveal data locally with explicit consent. Test redaction against credentials, tasks, schema text, and provider error echoes.

Use atomic output files, path validation, and no-overwrite defaults. Imports should not write outside a selected workspace. Do not alter unrelated projects, production resources, or global account configuration.

## 20. Test requirements and acceptance matrix

### 20.1 Required automated tests

Create focused unit tests and property tests for each native codec. Use reproducible seeds and retain minimal failing cases produced by shrinking. Initial target: at least 5,000 generated round trips across the supported native paths in the extended offline suite, plus a faster deterministic subset in ordinary CI. A number of passing random tests is not a proof; it complements explicit edge cases and invariants.

Test each encoder independently from the planner. Test planner behavior with real encoders and tokenizers. A mock tokenizer is permitted only for isolated planner logic tests, and those outputs must never become performance evidence.

Test the whole path:

```text
JSON text
-> IR
-> candidate artifact
-> rendered model context
-> parsed model context
-> decoded IR
-> restored JSON text
-> parsed IR
-> semantic equality
```

### 20.2 Acceptance matrix

| ID | Scenario | Required result |
| --- | --- | --- |
| A01 | Simple uniform customer table | Every eligible codec round-trips all rows and fields |
| A02 | JSON text with integer 9007199254740993 | Native codecs preserve the original numeric lexeme |
| A03 | JSON text with -0 and 1.2300 | Numeric lexemes preserved, not normalized away |
| A04 | JS input containing undefined, NaN, or BigInt | Explicit rejection, no silent conversion |
| A05 | Duplicate object keys in JSON text | Rejected before one key overwrites another |
| A06 | Array order and duplicate records | Order and multiplicity preserved |
| A07 | Missing field versus null versus false versus empty string | Distinctions preserved or encoder declared inapplicable |
| A08 | Empty array, empty object, primitive root | Supported by general targets with no shape ambiguity |
| A09 | String containing tabs, pipes, commas, quotes, and newlines | Exact string recovery |
| A10 | Keys containing /, ~, empty text, and numeric-looking text | Correct typed path reconstruction |
| A11 | __proto__ and constructor keys | Preserved without prototype mutation |
| A12 | Tampered row width, column count, or array length | Decode fails, no guessing or repair |
| A13 | Tampered dictionary or out-of-range code | Decode fails |
| A14 | Unknown tokenizer/model mapping | Explicit unsupported binding or opted-in estimate |
| A15 | No candidate fits token budget | BUDGET_EXCEEDED, no truncation and no over-budget success |
| A16 | Tiny object with large alternative guide overhead | JSON remains eligible and can win |
| A17 | A schema reference is unresolved | No reference-only success in self-contained mode |
| A18 | Jev unavailable or disabled | Offline compiler remains functional |
| A19 | Jev selects an ineligible plan or malformed response | Hint rejected; deterministic constraints retained |
| A20 | No quality evaluations exist | Quality unknown, no invented percentage or badge |
| A21 | Repeated compile with identical fixed inputs | Same selected plan, model context, and semantic artifact identity |
| A22 | Unicode data in source map | Offsets use the documented unit and resolve correctly |
| A23 | Offline workbench session | No dataset or task transmitted and no hidden model calls |
| A24 | Exceeded nesting/byte/node limit | Bounded typed failure before dangerous allocation |
| A25 | Different task hint on identical data | Layout may change; full semantic content does not |
| A26 | Explicit known schema with descriptions | Required schema meaning retained in counted context |
| A27 | Quality profile for the wrong model or guide version | Profile rejected or invalidated |
| A28 | Cancelled compile or timed-out search | Clear incomplete result, not a completed-search claim |
| A29 | Raw number not safely supported by TOON adapter | TOON inapplicable; native fallback retains precision |
| A30 | Count of concatenation differs from sum of piece counts | Final full-render count used for selection |
| A31 | Hostile content includes framing markers | Correct framing and decode, no privilege promotion |
| A32 | Native provider tool-call/output schema supplied by integration | Not rewritten by core representation compilation |

### 20.3 Performance measurements

Create repeatable microbenchmarks for parse, profile, individual encode/decode, render, tokenize, and full compare. Report environment, warm/cold state, input sizes, median, p95, peak memory where measurable, and configuration.

The initial performance objective is responsive comparison on ordinary small and medium fixtures without blocking the browser main thread. Set concrete regression thresholds only after establishing a baseline on a documented machine. Do not publish a latency target as a measured result.

## 21. Implementation phases and exit gates

The phase order matters. Do not begin with a polished landing page or a remote planning model.

### Phase 0: Workspace and contracts

Inspect the working directory and installed tooling. Create a new isolated workspace. Confirm Node/package-manager compatibility. Initialize the monorepo, strict TypeScript configuration, test runner, formatter/linter, dependency lockfile, safe ignore rules, and documentation skeleton.

Turn the request, IR, artifact, error, and encoder contracts into runtime-validatable types. Create the initial synthetic customer and adversarial fixtures. Record dependency choices and unresolved provider capabilities.

Exit gate: local lint, typecheck, and a small real test suite run successfully. No provider credentials needed.

### Phase 1: Vertical compiler slice

Implement strict JSON parsing, number-lexeme preservation, semantic equality, deterministic hashing, compact JSON encode/decode, model framing, and one real tokenizer adapter. Implement minimal `compile`, `render`, `decode`, and `verify` CLI commands.

Add a second physical target, `rows-delimited`, on uniform primitive record arrays. Tokenize its complete guide, metadata, schema, and payload. Verify restoration from rendered context, not just from the machine envelope.

Exit gate: a real input can produce JSON and delimited alternatives, display real token counts, and restore the complete data. Do not claim model-quality improvements.

### Phase 2: Native targets and planner

Implement JSON Lines, columns JSON, and typed path/value. Add shape profiling, candidate applicability checks, delimiter enumeration, resource controls, baseline retention, policy modes, token budgets, minimum savings, and deterministic explain output.

Add TOON as an optional adapter after its conversion limits and version are verified. Build the `compare` and `inspect` commands.

Exit gate: all five native codecs pass their explicit fixtures and property tests; bounded search and every main failure path are tested. The default compatibility policy does not silently deploy unqualified encodings.

### Phase 3: Evaluation harness

Implement seeded corpus generators, deterministic ground-truth functions, token-only suites, result manifests, report generation, and a generic model-evaluator interface. Keep model output shape consistent between input formats.

Implement one real provider evaluator only when its documentation and authorized access are available. Do not guess an API or report a stub as integrated. Prepare a user-configurable live run with limits, but do not run paid calls merely to finish the phase.

Exit gate: conformance and token suites run offline. Model evaluation reports correctly distinguish not-run from measured results. Quality profile loading and rejection are testable using labeled fixtures, without presenting fixtures as live evidence.

### Phase 4: Workbench and integration examples

Build the local workbench against the SDK. Add cancellation, input/result binding, artifact export/import, decoded comparison, real candidate metrics, and visible uncertainty/evidence states.

Create integration examples that transform an application data block before a model call while leaving the tool schema and expected answer schema unchanged. The local example must work without a model call; a provider example must keep optional network setup isolated.

Exit gate: a user can reproduce CLI results in the browser with locally available tokenizer assets, and network-disabled tests pass.

### Phase 5: Controlled extensions

Implement dictionary columns and explicit missingness support behind feature flags. Add a local schema registry with hydration and digest verification. Add Jev as a separate optional package with bounded task classification and deterministic fallback.

Do not implement packed binary or delta encodings just to populate a feature list. Add them only with codec tests and an explicit experimental evaluation plan.

Exit gate: each enabled extension has independent round-trip tests, known applicability limits, honest integration status, and no route around constraints. Jev has a real contract-test result only when actually run.

### Phase 6: Release hardening

Run unit, property, integration, security, browser, and package-install smoke tests. Verify that the packed SDK works in a clean Node consumer and that the browser build contains no server-only modules or credentials.

Review dependency licenses and audit results. Document unresolved vulnerabilities with actual findings, not fabricated clean scans. Generate a software bill of materials if the selected tooling supports it. Keep default runtime networking disabled.

Exit gate: `RELEASE_REPORT.md` states exactly what was built, commands run, tests passed/failed, live evaluations run/not-run, measured results, extension status, remaining limitations, and repository/deployment state.

## 22. Repository, CI, and publication

### 22.1 Git workflow

Use the authenticated local GitHub CLI account only when repository creation/upload is authorized. Inspect existing remotes before adding one. Never force-push or repoint an unrelated repository. Never modify production Firebase or Vercel resources for this local compiler.

Default repository name: `morph`, with a clear alternative such as `morph-context-compiler` if the name is already in use under the user's account. Do not reuse an unrelated repository with a matching name.

Default visibility: private. Public publication requires explicit owner authorization. The user may override visibility for this project, but a public setting for a different project does not authorize this one.

When authorized and the local workspace is clean and new, the intended operation is a normal GitHub CLI creation and push, not a web-only mock repository. Verify the resulting owner, repository, default branch, and visibility. Record the actual remote in the release report. If authentication is absent, finish locally and report the exact blocker without fabricating a URL.

### 22.2 Repository description

Use this short, semi-lay description, adjusted only for the host's length limit:

> MORPH compiles structured data into model-facing context. It compares JSON, typed rows, columns, paths, and optional TOON, measures tokenizer-specific prompt size, preserves the source data, and explains its choices. Includes a local SDK, CLI, workbench, and evaluation tools.

The README should explain the idea more fully, with a working example and clear distinctions between data preservation, measured token counts, and unmeasured model quality. Avoid claims that MORPH universally beats every format.

### 22.3 CI

Required offline CI jobs: dependency install from lockfile, formatting/lint, strict typecheck, unit tests, deterministic property subset, security fixtures, build, CLI smoke tests, and a small browser smoke test.

Do not expose secrets to pull requests from forks. Do not enable paid provider evaluations as automatic CI jobs. A longer property suite can be manually triggered or run in a scheduled workflow only after owner approval of that workflow.

Keep artifact uploads restricted to synthetic reports. A failed scan or test remains visible. Do not delete failing cases to obtain a green pipeline.

### 22.4 Licensing and publication

Prepare the code for an owner-selected open-source license and preserve all dependency notices. Do not assert ownership of third-party source. Do not publish npm packages, GitHub releases, hosted demos, or public repositories without the corresponding authorization.

The local release is useful before publication. Missing publication permission is not a blocker to implementing and testing the compiler.

## 23. Required repository documentation

`README.md`: what the product does, installation, one working local example, design boundaries, supported encodings, and honest result labels.

`docs/architecture.md`: component responsibilities, dependency direction, compilation sequence, and why no model is required for core operation.

`docs/format.md`: complete artifact and model-context framing grammar, codec grammar versions, examples, validation rules, and compatibility policy.

`docs/semantics.md`: input subset, number preservation, object/array equality, Unicode policy, unsupported values, and the difference between re-encoding and projection.

`docs/api.md` and `docs/cli.md`: real implemented APIs/commands, options, defaults, errors, examples, and counting scope.

`docs/benchmarking.md`: corpus, ground truth, token methodology, quality methodology, uncertainty, costs, and reproduction commands.

`docs/security.md`: trust boundaries, prompt-injection limitations, no-network defaults, unsafe keys, resources, privacy, and integration permissions.

`docs/dependencies.md`: exact versions, official references checked, third-party tokenizer status, license information, and integration verification status.

`docs/release.md` and `RELEASE_REPORT.md`: acceptance results and actual state, including not-run model evaluations or publication steps.

Do not add roadmap features to the supported-feature list. Use distinct labels for implemented, experimental, planned, blocked, and not evaluated.

## 24. Explicit extension boundary: query execution

A future package may filter, project, aggregate, or summarize data before representation compilation. It must not be smuggled into the lossless compiler.

Suggested future contract:

```text
source data
-> explicit query/transform plan
-> derived dataset with provenance
-> MORPH lossless representation compiler
```

The derived dataset's identity and source provenance are separate from the original full dataset. Record dropped paths, row selection, aggregation definitions, input hashes, and the caller's authorization. Do not call a task-specific subset a reversible encoding of the full source.

This boundary lets MORPH later cooperate with a query engine without misrepresenting what it preserved.

## 25. Definition of done

The local implementation is done only when a clean machine with the documented runtime and installed dependencies can execute the SDK, CLI, offline suites, and local workbench using synthetic examples, with no required credentials or hidden network calls.

The compiler must preserve every accepted value under its documented equality contract, measure the actual rendered text with a real identified tokenizer, explain eligibility and selection, reject unsupported or over-budget requests clearly, and never invent quality results.

The first useful result is not a universal winner. It is a trustworthy answer to these questions for a particular request:

```text
Which representations are legal for this data?
Which representations can be reconstructed exactly?
What text would the model actually receive?
How many tokens does that text use under the selected tokenizer?
Which candidates fit the configured budget?
What evidence exists about downstream task quality?
Why did the planner choose this representation or stay with JSON?
```

Finish the implementation handoff with real commands, actual test outcomes, and verified artifact paths. Distinguish local completion from remote integration, quality evaluation, and public release. Never fabricate savings, availability, URLs, users, customers, contributors, or benchmark results.
