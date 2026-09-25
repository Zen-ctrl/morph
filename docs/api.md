# TypeScript SDK API

The workspace exposes source packages for local development. Every package is currently
private and no npm publication is implied. The root and every workspace package manifest
require Node.js `>=22.12.0 <25`. The composed entry point is `@morph/sdk`, and the
underlying compiler contract is exported from `@morph/core`.

## Default composed SDK

```ts
import { createDefaultMorph } from "@morph/sdk";

const morph = createDefaultMorph();
```

`@morph/sdk` re-exports core, native encoder, tokenizer, and TOON APIs. Its frozen
`defaultMorphRegistry` contains all five native codecs, the gated official TOON adapter,
the local o200k tokenizer, the offline target profile, and an empty quality-profile list.

## Constructing a compiler

```ts
import { createMorph } from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import {
  localO200kBaseProfile,
  localO200kBaseTokenizer,
} from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";

const morph = createMorph({
  encoders: [...builtInEncoders, toonEncoder],
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});
```

Omit `toonEncoder` for a native-only custom compiler. The composed SDK, browser
workbench, CLI, and offline evaluation harness include gated TOON.

`createMorph` rejects duplicate encoder ID and format-version pairs, tokenizer ID and
revision pairs, target profile IDs, and quality profile IDs. Registration is explicit;
imported artifacts cannot load executable codecs.

The optional constructor configuration is:

```ts
interface MorphOptions {
  defaultConstraints?: Partial<MorphConstraints>;
  signal?: AbortSignal;
  encoderFailureMode?: "throw" | "quarantine";
}
```

`defaultConstraints` is merged before each request, with request values winning and mode
fixed to `lossless`. An aborted `signal` returns a typed `CANCELLED` compile failure and
an incomplete report. Core checks cancellation before planning and at cooperative
checkpoints between pipeline stages and candidate operations. It does not interrupt a
codec or tokenizer that is already executing.

`encoderFailureMode` defaults to `throw`, which makes an unexpected applicable-encoder
failure fatal and visible. Explicit `quarantine` mode records the failing candidate with
`ENCODER_QUARANTINED` and continues searching. It does not make a broken baseline valid,
bypass any gate, or persist a quarantine across compiler instances.

## Compiler methods

```ts
interface MorphCompiler {
  compile(request: MorphRequest): Promise<CompileResult>;
  compileJson(
    text: string,
    options: Omit<MorphRequest, "data">,
  ): Promise<CompileResult>;
  compileValue(
    value: unknown,
    options: Omit<MorphRequest, "data">,
  ): Promise<CompileResult>;
  compare(request: MorphRequest): Promise<ComparisonReport>;
  decode(artifact: MorphArtifact): MorphIR;
  decodeJson(artifact: MorphArtifact): string;
  renderModelContext(artifact: MorphArtifact): ModelContext;
  verify(artifact: MorphArtifact): VerificationReport;
}
```

### `compile`

Runs validation, parsing, profiling, bounded candidate enumeration, direct and
self-contained round-trip verification, complete-text tokenization, policy gates, budget
gates, and deterministic selection.

It resolves to:

```ts
type CompileResult =
  | { ok: true; artifact: MorphArtifact; report: ExplainReport }
  | { ok: false; error: MorphError; report?: ExplainReport };
```

Expected request or candidate failures are returned, not thrown. Errors that occur before
a useful search report exists are accompanied by an empty incomplete report.

### `compileJson`

Convenience wrapper over `compile` with `data: { kind: "json-text", text }`. Use this for
untrusted input and whenever number spelling must be retained exactly.

### `compileValue`

Convenience wrapper over `compile` with `data: { kind: "js-value", value }`. It accepts
only the subset documented in [semantics.md](semantics.md) and never invokes `toJSON` or
accessor properties.

### `compare`

Runs the same candidate pipeline and returns all retained and pruned candidate reports,
including alternatives that are inapplicable or ineligible. It does not return an
artifact.

Request-validation and other thrown setup errors reject the promise with
`MorphException`. A completed search that cannot select a plan is represented in the
report by no `selectedPlanId` plus candidate reason codes. Callers that require a typed
terminal error and selected artifact should use `compile`.

### `decode`

Checks artifact payload and dependency digests, resolves the exact registered encoder,
decodes the artifact section, and requires the decoded semantic digest to match
`inputSemanticDigest`. It returns `MorphIR` or throws `MorphException`.

### `decodeJson`

Calls `decode` and prints compact JSON directly from the IR. Numeric lexemes are not
routed through JavaScript numbers. Source whitespace, object display order, and original
escape spelling are not reconstructed.

### `renderModelContext`

Checks artifact integrity and returns the canonical self-contained bundle and complete
prompt assembly. It does not contact a provider.

### `verify`

Returns checksum, dependency, and self-contained semantic-round-trip results without
throwing for ordinary verification failures:

```ts
interface VerificationReport {
  valid: boolean;
  checksum: "passed" | "failed" | "not-run";
  dependencies: "complete" | "incomplete";
  semanticRoundTrip: "passed" | "failed" | "not-run";
  errors: readonly MorphError[];
}
```

Integrity verification recomputes the payload digest, model-dependency digest, and
deterministic `artifactId`, and it checks the plan, section, and guide bindings. Semantic
verification reparses the rendered self-contained bundle and decodes it. All hashes are
unkeyed consistency checks, so the artifact ID is not an authentication primitive.

## Request contract

```ts
interface MorphRequest {
  data:
    | { kind: "json-text"; text: string }
    | { kind: "js-value"; value: unknown };
  schema?: unknown;
  task: MorphTask;
  target: TargetProfile;
  constraints: MorphConstraints;
  planner: PlannerOptions;
  context?: { prefix: string; suffix: string };
}
```

### Task

```ts
type AccessPattern =
  | "unknown"
  | "entity-lookup"
  | "multi-entity-comparison"
  | "aggregation"
  | "filtering"
  | "nested-path-lookup"
  | "sequence-analysis";

interface MorphTask {
  instruction: string;
  accessPattern?: AccessPattern;
  relevantPaths?: readonly string[];
  preserveReadableLabels?: boolean;
}
```

These fields describe intended access. They do not execute a query and do not authorize
projection or removal. Current native encoders receive the hints but enumerate only from
input shape and fixed bounded format options.

### Target

```ts
interface TargetProfile {
  profileId: string;
  tokenizerId: string;
  tokenizerRevision: string;
  modelId?: string;
  modelRevision?: string;
  providerId?: string;
  contextWindowTokens?: number;
}
```

The full requested target must exactly equal the registered profile with that ID. The
tokenizer ID and revision must also match an adapter. Unknown mappings fail with
`UNSUPPORTED_TARGET_PROFILE`, `TARGET_PROFILE_MISMATCH`, or
`UNSUPPORTED_TOKENIZER_BINDING`.

The bundled `localO200kBaseProfile` is:

```ts
{
  profileId: "local-o200k-base",
  tokenizerId: "o200k_base",
  tokenizerRevision:
    "js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d"
}
```

It deliberately has no model or provider binding.

### Constraints and defaults

```ts
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
```

| Constraint | Default | Current behavior |
| --- | ---: | --- |
| `mode` | required | Only `lossless` is accepted. |
| `maxPromptTokens` | unset | Rejects candidates whose complete rendered-text count exceeds it. |
| `reservedOutputTokens` | unset | Used with a registered context window. The local profile has no context-window binding. |
| `maxInputBytes` | 5 MiB | Checked before JSON-text parsing and after safe JS-value printing. |
| `maxDepth` | 64 | Checked during input parsing and adaptation. Codec decoders also use bounded depth. |
| `maxNodes` | 250,000 | Checked during input parsing and adaptation. Decoders enforce bounded allocations. |
| `maxCandidates` | 24 | Retains a deterministic prefix and reports later candidates as pruned. |
| `maxRenderedBytes` | 16 MiB | Applied to payload and complete rendered prompt finalists. |
| `maxPlanningMs` | 5,000 | Cooperative abort check between candidate evaluations. |
| `allowNetwork` | false | Core has no network implementation. Setting true grants no capability by itself. |

A target with both `providerId` and `contextWindowTokens` currently fails with
`REQUEST_OVERHEAD_UNKNOWN` because no provider request-accounting adapter is bundled.

### Profiling

`profileIR(ir, options)` returns exact structural counts, maximum depth, scalar totals,
string code-point totals, and record-array observations including field unions,
intersections, observed types, missing counts, and null counts. Scalar cardinality is
bounded by `maxScalarCardinality`, default 4,096. If a scalar occurrence cannot be
tracked after the map reaches its cap, `scalarCardinalityCapped` becomes true,
`untrackedScalarCount` increases, and the
top-level `exact` field becomes false. Other structural fields remain full-input
observations.

### Planner

```ts
interface PlannerOptions {
  policy: "compatibility" | "economy-experimental" | "validated";
  objective: "prompt-tokens" | "estimated-request-cost";
  allowedEncodings?: readonly string[];
  forcedEncoding?: string;
  allowExperimentalTransforms?: boolean;
  qualityProfileId?: string;
  pricingProfileId?: string;
  minimumSavingsTokens?: number;
  minimumSavingsFraction?: number;
}
```

- `compatibility` keeps unqualified nonbaseline candidates ineligible.
- `economy-experimental` ranks reversible candidates by complete prompt tokens and labels
  unknown model quality.
- `validated` requires a matching qualified profile for a nonbaseline candidate. With no
  bundled profiles, compact JSON remains the eligible baseline when allowed and in budget.
- `allowedEncodings` is an exact family allowlist. If it excludes JSON, JSON is still
  measured as the baseline but cannot be selected.
- `forcedEncoding` restricts selection to that family and bypasses token ranking and
  minimum-savings hysteresis only.
- default hysteresis is 16 tokens and 2%, both required.
- `estimated-request-cost` currently returns `PRICING_PROFILE_REQUIRED`.
- `allowExperimentalTransforms` and `pricingProfileId` are reserved in current local
  behavior. No dictionary, mask, or cost profile is registered by core.

Quality profiles can be passed in the registry. Current matching requires exact encoding
and format, target profile, tokenizer, guide version, renderer version, model ID and
revision, plan-options digest, and task family. A declared qualified profile must also
have a finite ordered confidence interval, a lower bound above the negative allowed
regression, a positive case count, at least two independent datasets, a 64-hex evidence
digest, nonempty provenance and metric fields, dataset characteristics, an answer-schema
digest, and a future or absent expiry. The default registry is empty, so no repository
result currently qualifies a nonbaseline representation for model accuracy. These checks
validate the declared record and its binding. They do not independently reproduce the
statistical calculation, prove dataset clustering, or verify the asserted provenance.

The exported contracts are:

```ts
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

interface QualityProfile {
  profileId: string;
  encoding: string;
  formatVersion: string;
  targetProfileId: string;
  tokenizerId: string;
  tokenizerRevision: string;
  modelId: string;
  modelRevision: string;
  guideVersion: string;
  rendererVersion: "morph-prompt/1";
  planOptionsDigest: string;
  taskFamily: AccessPattern;
  benchmarkProvenance: string;
  datasetCharacteristics: Readonly<Record<string, unknown>>;
  answerSchemaDigest: string;
  evaluationMetric: string;
  allowedRegression: number;
  evidence: QualityEvidence;
  expiresAt?: string;
}
```

`planOptionsDigest` is the SHA-256 digest of `canonicalJsonText(plan.options)`.
`answerSchemaDigest` and `evidenceDigest` must be lowercase 64-hex strings. An expiry,
when supplied, must parse to a future instant at selection time. `allowedRegression`
must be finite and between zero and one inclusive.

## Complete example

```ts
import { createMorph } from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import {
  localO200kBaseProfile,
  localO200kBaseTokenizer,
} from "@morph/tokenizer-adapters";

const morph = createMorph({
  encoders: builtInEncoders,
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});

const result = await morph.compileJson(
  '[{"id":"c1","amount":1.2300},{"id":"c2","amount":2}]',
  {
    task: {
      instruction: "Return the complete record for c1.",
      accessPattern: "entity-lookup",
    },
    target: localO200kBaseProfile,
    constraints: {
      mode: "lossless",
      allowNetwork: false,
    },
    planner: {
      policy: "compatibility",
      objective: "prompt-tokens",
    },
    context: {
      prefix: "",
      suffix: "",
    },
  },
);

if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  const verification = morph.verify(result.artifact);
  if (!verification.valid) throw new Error("Verification failed");

  const context = morph.renderModelContext(result.artifact);
  const restored = morph.decodeJson(result.artifact);
  console.log(result.artifact.plan.encoding);
  console.log(context.rendered);
  console.log(restored);
}
```

No model call occurs in this example.

## Token measurement

Each measured candidate records:

```ts
interface TokenMeasurement {
  count: number;
  tokenizerId: string;
  tokenizerRevision: string;
  textDigest: string;
  scope: "rendered-text" | "provider-request";
  certainty: "exact-for-tokenizer" | "provider-reported" | "estimate";
  assumptions: readonly string[];
}
```

The bundled adapter always reports `scope: "rendered-text"` and
`certainty: "exact-for-tokenizer"`. It counts the complete visible `MORPH-PROMPT/1`
string in one operation. It explicitly excludes provider framing, hidden instructions,
tools, images, outputs, and billing behavior.

## Explain reports

Every candidate reports its stable plan ID, physical options, applicability, direct and
self-contained round trip, dependency completeness, token measurement, baseline delta,
quality status, eligibility, reason codes, and elapsed time where measured.

Common reason codes include:

```text
BASELINE_COMPATIBILITY
BASELINE_MINIMUM_SAVINGS
LOWEST_ELIGIBLE_TOKEN_COUNT
CALLER_FORCED_ENCODING
QUALITY_UNKNOWN
QUALITY_PROFILE_MISMATCH
BELOW_MINIMUM_SAVINGS
ENCODER_NOT_APPLICABLE
ROUNDTRIP_FAILED
SELF_CONTAINED_ROUNDTRIP_FAILED
OVER_TOKEN_BUDGET
ENCODING_NOT_ALLOWED
NOT_FORCED_ENCODING
CANDIDATE_LIMIT_PRUNED
MAX_RENDERED_BYTES_EXCEEDED
```

Savings use compact JSON as the baseline:

```text
savingsTokens = baselineTokens - candidateTokens
savingsFraction = savingsTokens / baselineTokens
```

Negative savings remain visible. A zero-token baseline produces zero fraction only when
the candidate is also zero tokens; otherwise the implementation records `-1` as the
defined finite sentinel for a larger candidate against a zero denominator.

## Model-evaluation and quality-analysis APIs

`@morph/evaluation` is a Node package. It exports a provider-neutral bounded runner and a
separate deterministic noninferiority-analysis helper. It does not contain a provider
client, credentials, or a bundled quality profile.

### Bounded model-evaluation runner

`prepareModelEvaluationCases` compiles each supported requested candidate beside compact
JSON on the same dataset and task. It returns paired complete rendered contexts plus
explicit preparation exclusions. `runModelEvaluation` then randomizes those trials from
a caller-supplied seed and invokes an optional `ModelEvaluator`:

```ts
interface ModelEvaluator {
  readonly id: string;
  evaluate(
    item: ModelEvaluationCase,
    context: {
      providerId: string;
      attempt: number;
      maxOutputTokens: number;
      timeoutMs: number;
      signal: AbortSignal;
    },
  ): Promise<ModelEvaluatorResponse>;
}
```

The runner requires positive bounds for requests, concurrency, output tokens, and timeout,
plus a nonnegative retry limit. It also requires exactly one paid-execution authorization:

- `approvedCallCap`; or
- `maxCost` together with a versioned `pricingProfile`.

`maxRequests` remains an outer cap in both modes and includes retries. Cost mode reserves
the complete rendered prompt token count, declared maximum provider input overhead,
maximum output tokens, and any fixed per-request amount before launching a request. It
reconciles that reservation with valid provider-reported usage when returned.

```ts
import {
  DEFAULT_BENCHMARK_IDENTITY,
  generateSyntheticCorpus,
  runModelEvaluation,
} from "@morph/evaluation";

const notRunManifest = await runModelEvaluation({
  corpus: generateSyntheticCorpus(),
  benchmark: DEFAULT_BENCHMARK_IDENTITY,
  controls: {
    providerId: "not-configured",
    randomSeed: 20260921,
    maxRequests: 10,
    approvedCallCap: 10,
    concurrency: 1,
    maxRetries: 0,
    maxOutputTokens: 128,
    requestTimeoutMs: 30_000,
  },
});
```

Because this example omits `evaluator`, all prepared trials are recorded as `not-run`
with `PROVIDER_NOT_CONFIGURED`, and no call occurs. With a caller-supplied evaluator, the
runner normalizes responses, supplies a timeout `AbortSignal`, retries only retryable
failures within the caps, and retains failures, refusals, truncations, and invalid outputs
in the accuracy denominator after a request is made. Raw outputs are omitted by default;
the manifest keeps an output digest when canonical JSON output is available. Set
`recordOutputs: true` only under an explicit retention policy.

The result is `morph-model-evaluation/1`. It records provenance, tokenizer identity,
randomized order, preparation exclusions, settings, provider model identities and usage
when reported, retry attempts, latency, complete denominators, optional cost accounting,
and aggregates by encoding, task family, and data family. Its quality label is only
`not-run` or `measured-unqualified`. `renderModelEvaluationReport` formats the manifest,
but neither function turns observations into a core `QualityProfile`.

### Paired noninferiority analysis

`evaluatePairedNoninferiority` analyzes caller-supplied binary-correctness records. It
does not run a model or install a quality profile:

```ts
const evidence = evaluatePairedNoninferiority(records, {
  allowedRegression: 0.05,
  confidenceLevel: 0.95,
  bootstrapSamples: 1000,
  seed: 20260921,
  minimumUniqueCases: 100,
  minimumIndependentDatasets: 10,
});
```

Each record has `caseId`, `datasetId`, `baselineCorrect`, and `candidateCorrect`. Case IDs
must be unique. The `paired-dataset-cluster-bootstrap-v1` method averages paired
correctness differences within each dataset, then performs a seeded bootstrap over the
dataset means. It returns `insufficient`, `qualified`, or `failed`, the point estimate,
percentile bounds, unique-case and independent-dataset counts, and a deterministic
evidence digest. Qualification requires the configured case and dataset minima and a
lower bound greater than `-allowedRegression`. The caller remains responsible for a valid
evaluation design, honest dataset IDs, preregistration, profile construction, and
retention policy. A manifest from the bounded runner still requires this separate
analysis and the core identity gates before it can support a quality profile.

## Lower-level exports

`@morph/core` also exports:

- `parseJsonStrict`, `parseJsonNode`, `fromJsValue`;
- `printJson`, `printJsonNode`, `semanticEqual`;
- `canonicalizeNode`, `semanticDigest`, SHA-256 helpers;
- JSON Pointer escape, unescape, append, and parse helpers;
- `profileIR`;
- schema sanitization and canonical JSON helpers;
- Draft 2020-12 instance validation and schema-validation result types;
- artifact creation, JSON import, and integrity verification;
- model-bundle framing, parsing, and prompt rendering;
- compact JSON source-map generation with UTF-16 span types;
- public interfaces and `MorphException`.

Lower-level functions throw `MorphException` for typed failures. `MorphError` has:

```ts
interface MorphError {
  code: string;
  message: string;
  path?: string;
  details?: Readonly<Record<string, unknown>>;
}
```

Error messages are intended to identify cause and location without echoing input values.
Applications should branch on `code`, not parse message prose.

## Compact JSON source-map API

```ts
import { parseJsonStrict, printCompactJsonWithSourceMap } from "@morph/core";

const ir = parseJsonStrict('{"🧭/name":"结构","amount":1.2300}');
const sourceMap = printCompactJsonWithSourceMap(ir);
```

`sourceMap.text` is compact JSON. Entries use RFC 6901 pointers and half-open
`[start, end)` spans. `offsetUnit` and every span unit are `utf16-code-units`, which match
JavaScript string indices. Object member pointers can carry both a `key` span and a
`value` span. The helper is currently compact-JSON-only and does not modify artifacts.

## Schema registry extension

The optional `@morph/schema-registry` package is not imported by core. Its in-memory
entry point exports:

- `createSchemaGuideBundle`;
- `serializeSchemaGuideBundle` and `parseSchemaGuideBundle`;
- `verifySchemaGuideBundle` and `assertValidSchemaGuideBundle`;
- `InMemorySchemaRegistry`;
- `createRegistryArtifactReference`;
- `hydrateArtifact`;
- bundle, limit, registry, reference, verification, and error types.

The Node-only filesystem store is a separate subpath:

```ts
import { FileSystemSchemaRegistry } from "@morph/schema-registry/node";
```

Both registry classes implement:

```ts
interface SchemaGuideRegistry {
  register(input: SchemaGuideBundleInput): Promise<SchemaGuideBundle>;
  put(bundle: SchemaGuideBundle): Promise<void>;
  resolve(bundleId: string): Promise<SchemaGuideBundle | undefined>;
  has(bundleId: string): Promise<boolean>;
  listIds(): Promise<readonly SchemaBundleId[]>;
  delete(bundleId: string): Promise<boolean>;
  stats(): Promise<SchemaRegistryStats>;
}
```

Default limits are 128 entries, 5 MiB per serialized entry, and 32 MiB total. Bundle IDs
are `sha256:<64 lowercase hex>`. The digest covers a versioned canonical object containing
the exact schema, optional dictionaries, and guide fields.

The registry bundle format can preserve an optional dictionaries array for a future
extension. Current `morph-artifact/1` framing does not have a dictionary section, so core
artifact import rejects dictionary dependencies. A dictionary-bearing bundle cannot be
hydrated into a current model-ready artifact.

A reference artifact deliberately removes `modelDependencies` and `dependencyMode` from
the machine envelope and binds the remaining artifact body to a bundle ID. It is not a
valid core artifact and must not be rendered. `hydrateArtifact` resolves and verifies the
bundle, checks its dependency digest against the artifact body, restores
`dependencyMode: "self-contained"`, parses the normal artifact, and verifies integrity.

```ts
import {
  InMemorySchemaRegistry,
  createRegistryArtifactReference,
  hydrateArtifact,
} from "@morph/schema-registry";

const registry = new InMemorySchemaRegistry();
const bundle = await registry.register(result.artifact.modelDependencies);
const reference = createRegistryArtifactReference(result.artifact, bundle);
const selfContained = await hydrateArtifact(reference, registry);
```

This extension can reduce application-side duplication. The hydrated model prompt still
contains and counts the complete dependencies.

The filesystem implementation reads through one opened handle with a configured byte
cap. It compares device and inode identity with the named path before and after reading,
rechecks file type and size, rejects symbolic links and changes during the read, and
closes the handle on every path. This is a local hardening boundary, not multi-tenant
authorization.

## Jev planner extension

The optional `@morph/jev-planner` package exports two classifiers:

```ts
import {
  DisabledJevAccessPatternClassifier,
  JevHttpAccessPatternClassifier,
} from "@morph/jev-planner";
```

`DisabledJevAccessPatternClassifier` always returns deterministic `unknown` with
`JEV_ADAPTER_DISABLED`.

`JevHttpAccessPatternClassifier` accepts optional construction fields for API key, model,
timeout, minimum confidence, probability tolerance, task byte limit, response byte limit,
fetch implementation, and clock. Defaults are:

```text
endpoint: https://api.typesafe.ai/v1/systemone
model request: jev-latest
timeout: 5,000 ms
minimum confidence: 0.75
probability tolerance: 0.000001
maximum task bytes: 64 KiB
maximum response bytes: 256 KiB
```

Each classification request must explicitly set both `allowNetwork` and
`allowRemoteTaskDisclosure`. It contains task text and optional validated coarse shape
statistics, not raw data values. Missing permission or credentials, invalid input,
timeout, cancellation, network error, service error, and malformed response all return a
typed deterministic fallback rather than throw an integration result into the planner.
The response stream is stopped when its configured byte cap is exceeded and is parsed
only after the bounded read completes.

Successful responses preserve all option probabilities, provider confidence, requested
and resolved model strings, rounded latency, and input/output token usage. Unknown or
below-threshold choices abstain to the local `unknown` access pattern.

The classifier is not wired into `createMorph`. Applications may use an accepted result
only as a task hint. It cannot bypass eligibility, select an unregistered plan, or create
quality evidence. `JEV_INTEGRATION_STATUS.liveContractTest` is `not-run`.

The clean-consumer smoke command is configured to pack `@morph/core`, encoders,
tokenizers, TOON, evaluation, schema registry, Jev planner, CLI, and composed SDK. It
exercises the optional packages through public exports without enabling a network call.
Its executed pass or failure status belongs in `RELEASE_REPORT.md`.
