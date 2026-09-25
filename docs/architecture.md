# Architecture

## Purpose

MORPH is a representation compiler. It keeps one logical JSON-compatible value while
testing different physical text layouts for a specific request. The core selection path
does not call a model and does not need a network connection.

The central invariant is:

```text
semanticEqual(decode(encode(input)), input) == true
```

Compilation also verifies the stronger handoff path:

```text
accepted input
  -> IR
  -> encoded section
  -> artifact
  -> self-contained model bundle
  -> parsed encoded section
  -> decoded IR
  -> matching semantic digest
```

## Workspace responsibilities

| Component | Responsibility | Runtime boundary |
| --- | --- | --- |
| `packages/core` | Public types, strict parsing, JavaScript-value adaptation, canonical digests, Draft 2020-12 validation, profiling, request validation, planning, artifact integrity, model framing, source maps, and decode orchestration | Browser-compatible and free of filesystem, process, HTTP, provider, and UI imports |
| `packages/encoders` | Five native `MorphEncoder` implementations and shared bounded decoder validation | Browser-compatible |
| `packages/tokenizer-adapters` | Bundled local `o200k_base` tokenizer and the `local-o200k-base` target profile | Browser-compatible, no first-use download |
| `packages/toon-adapter` | Optional adapter over the pinned official `@toon-format/toon` package | Separate from native codecs; used by SDK, CLI, evaluation, and workbench |
| `packages/sdk` | Composed default registry and re-exports for the local SDK | Includes five native codecs, gated TOON, the tokenizer, and the offline target profile |
| `packages/cli` | Filesystem composition, standard input and output, atomic writes, exit-code mapping, bundled offline benchmark fixtures, and user-facing commands | Node.js only |
| `packages/evaluation` | Synthetic corpus helpers, offline fixture conformance, token measurements, timing summaries, a bounded provider-neutral model-evaluation runner, and paired dataset-cluster bootstrap analysis | Node.js only because provenance and fixture suites use Node APIs |
| `apps/workbench` | Local React comparison and artifact-import interface plus compiler worker | Browser only; registers five native codecs and gated TOON |
| `packages/schema-registry` | Bounded content-addressed schema and guide bundles, in-memory storage, hardened local-filesystem storage, reference creation, and self-contained hydration | Optional extension, not imported by core |
| `packages/jev-planner` | Disabled fallback classifier and optional TypeSafe Jev HTTP access-pattern classifier | Optional extension, not imported by core or wired into eligibility; live contract test not run |

The dependency direction is deliberate:

```text
encoders -----------+
tokenizer adapters -+--> core interfaces and orchestration
TOON adapter -------+

CLI -----------> core + encoders + tokenizer + TOON + evaluation
evaluation ----> core + encoders + tokenizer + TOON
workbench -----> core + encoders + tokenizer + TOON
SDK -----------> core + encoders + tokenizer + TOON
schema registry -> core

core -X-> CLI, evaluation, workbench, filesystem, HTTP, provider SDKs, Jev
```

Workspace packages are private. Their package boundaries support testing and clean
dependency direction; they are not evidence that npm names are available or published.
The root and every workspace package manifest require Node.js `>=22.12.0 <25`. The
package smoke workflow is configured to pack the nine Node packages, including the
optional schema-registry and Jev packages, into a clean local consumer. Its executed
result is recorded only in the release report.

## Compilation sequence

### 1. Validate the request

`validateRequest` checks discriminants, task and target identity, policies, numeric
constraints, allowed encoding lists, context strings, and the lossless-only mode. It
merges the documented defaults:

```text
maxInputBytes: 5 MiB
maxDepth: 64
maxNodes: 250,000
maxCandidates: 24
maxRenderedBytes: 16 MiB
maxPlanningMs: 5,000
allowNetwork: false
```

A supplied schema is copied through the safe JavaScript-value adapter. External `$ref`
values and non-2020-12 dialect declarations are rejected. Ajv 8.20 validates the accepted
data instance without coercion, defaults, removal, or mutation. Format validation is
disabled. A conservative whole-instance guard returns
`SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` for nonfinite host conversions, and when a
numeric comparison, numeric equality, or `uniqueItems: true` check meets any number that
is not a canonical safe integer under JavaScript conversion.

### 2. Resolve target and tokenizer exactly

The requested target object must exactly match a registered profile with the same
`profileId`. The target's tokenizer ID and revision must match a registered adapter.
There is no guessed alias or model-to-tokenizer fallback.

The only bundled target is `local-o200k-base`. It has no `modelId`, `providerId`, or
context-window claim.

### 3. Build the IR

JSON text enters the dedicated parser before any native number conversion. JavaScript
values enter a descriptor-based adapter that rejects accessors, custom prototypes,
cycles, sparse arrays, nonfinite numbers, `BigInt`, functions, symbols, and undefined.
Both paths produce `morph-ir/1` plus a SHA-256 semantic digest.

### 4. Profile shape

`profileIR` records exact node and type counts, maximum depth, repeated scalar counts,
and record-array structure. Missing-key counts and explicit-null counts are separate.
Structural counts and record-array observations are exact for accepted bounded input.
The scalar-cardinality map is capped at 4,096 entries by default. When the cap prevents
tracking a new scalar, `scalarCardinalityCapped` becomes true, `untrackedScalarCount`
increments, and the profile's top-level `exact` field becomes false.

Task hints are passed to encoder enumeration. Current native encoders use shape and
their fixed bounded options; they do not delete data or execute a task based on a hint.

### 5. Enumerate bounded candidates

Encoders are evaluated in stable registration order, with `json-compact` forced to the
front. The built-in native order is compact JSON, JSON Lines, four typed-row delimiters,
columns JSON, and path/value. The CLI and evaluation harness then register three TOON
delimiter plans. The deterministic `maxCandidates` prefix is retained and the rest are
reported as `CANDIDATE_LIMIT_PRUNED`.

Metrics remain in the explain report for every evaluated candidate, but core keeps at
most eight materialized candidate artifacts at once. It preserves the baseline artifact
and then the best currently ranked alternatives, releasing other payload buffers.

MORPH does not claim a global optimum over unregistered or pruned formats.

### 6. Verify every retained finalist

For each applicable plan, the compiler:

1. Encodes the complete IR.
2. Enforces the payload byte limit.
3. Decodes the encoded section and checks semantic equality.
4. Creates a self-contained artifact with guide, metadata, schema, task, and payload.
5. Renders the complete prompt and enforces the rendered byte limit.
6. Parses the self-contained bundle without access to the source input.
7. Decodes that parsed section and checks equality and semantic digest again.
8. Tokenizes the complete final rendered prompt as one string.
9. Applies allowed-encoding, forced-format, quality, and token-budget gates.

Unexpected applicable-encoder failures are fatal by default. A caller can explicitly set
`encoderFailureMode: "quarantine"` to record the candidate as
`ENCODER_QUARANTINED` and continue. Quarantine does not make a failed compact JSON
baseline optional, so a broken baseline still prevents a successful selection.

### 7. Select deterministically

The default `compatibility` policy makes unqualified nonbaseline candidates ineligible.
With the bundled empty quality-profile registry, compact JSON is the only quality-
eligible family under compatibility and validated policies.

`economy-experimental` may rank reversible alternatives by measured rendered-text
tokens. The default hysteresis requires both at least 16 saved tokens and at least 2%
savings before an unforced nonbaseline candidate replaces JSON.

Tie-breaking is stable:

1. Lower complete rendered token count.
2. Compact JSON preference.
3. Fewer interpretation mechanisms.
4. Lexically stable plan ID.

A forced encoding bypasses cost ranking and hysteresis, but it does not bypass codec
support, round-trip verification, policy, tokenizer, resource, or budget gates.

The semantic artifact identity excludes elapsed time. Explain reports include measured
durations, so reports themselves are not byte-stable performance records.

### 8. Return the result

`compile` returns either a selected artifact and explain report or a typed `MorphError`
and, where available, a report. `compare` returns candidate facts even when a candidate
is not eligible for automatic selection. Decode, render, and verify are explicit later
operations over a saved artifact.

## Why no model is required

Codec correctness, self-contained reconstruction, tokenization, policy gates, budget
checks, and deterministic selection are software operations. A model call is needed only
for Layer C evaluation: whether a particular model answers a particular task as well
from one representation as from compact JSON. The evaluation package can prepare paired
trials and run a caller-supplied provider-neutral evaluator under explicit bounds, but no
provider adapter or credentials are bundled and no live run is automatic.

No quality profile ships with the default registry. That means:

- preservation can be verified locally;
- prompt tokens can be counted locally;
- model comprehension remains `unknown` or `not-run`;
- compatibility selection stays with compact JSON;
- experimental selection is clearly labeled.

## Browser architecture

The workbench creates a module worker for each run. A compile request includes the data,
optional schema text, task, access-pattern hint, policy, and optional prompt budget. An
artifact-import request includes the complete local artifact text. A SHA-256 digest and
monotonically increasing request ID bind either response to that exact request. Editing
input, starting an import, or pressing cancel terminates current work and clears prior
results, so a stale response cannot be displayed for new input.

The worker registers the native codecs, gated official TOON adapter, local tokenizer,
and offline target profile. Compile mode returns a selected artifact, report, rendered
text, restored JSON, and verification report. Import mode first uses the strict artifact
parser, then verifies, renders, and decodes the artifact. The UI caps imported files at
20 MiB and uses browser-created download blobs only after a user action. It has no server
component, persistence layer, analytics, or provider integration.

## Node adapter boundaries

The CLI is the only normal product path that writes files. Writes use a sibling temporary
file, refuse an existing destination unless `--force` is present, and validate both the
lexical destination and resolved output parent against the current workspace. A
no-overwrite write installs the temporary file with a hard link. Forced replacement uses
rename, with a backup-and-restore path on Windows. The installed CLI resolves offline
benchmarks from the `benchmark-fixtures` directory shipped inside its own package. The
source evaluation scripts use the repository manifest. The filesystem registry opens an
entry once, compares the open handle with the path before and after a bounded read, and
rejects symbolic links, non-files, identity changes, size changes, and over-limit input.
Core compilation itself performs no file or network operation.

## Implemented limitations relevant to architecture

- `estimated-request-cost` is rejected because no pricing or full request-accounting
  profile is registered.
- Provider request framing and billing counts are not implemented.
- Quality-profile identity, task-family, expiry, case-count, dataset-count, and
  confidence-bound gates exist, but core cannot authenticate provenance or reproduce the
  asserted statistical calculation. The repository has a bounded provider-neutral
  evaluation runner but no provider adapter, live result, or bundled qualified evidence,
  so model quality remains not evaluated.
- Draft 2020-12 validation is implemented through Ajv 8.20. The conservative numeric
  guard fails closed for nonfinite host conversion and for precision-sensitive lexemes
  when numeric comparison, equality, or `uniqueItems: true` is present.
- Planning timeout and optional constructor `AbortSignal` checks occur at cooperative
  checkpoints between pipeline stages and candidate operations. Browser cancellation
  uses worker termination for a hard local stop.
- Compact JSON source maps are implemented as a separate UTF-16-offset helper. Source
  maps for other codecs are not implemented.
- Dictionary columns, missingness masks, hybrids, retained-context mode,
  prompt caching integrations, and query execution are outside the required native
  compilation path.

See [the decision record](decisions/0001-toolchain-and-scope.md) and
[the current release report](../RELEASE_REPORT.md) for exact extension and verification
status.
