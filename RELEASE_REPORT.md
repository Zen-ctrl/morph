# MORPH release report

Report status: **PENDING FINAL VERIFICATION AND PRIVATE REPOSITORY HANDOFF**
Specification version: `0.1.0`
Package version: `0.1.0`
Report date: 2026-09-22

This is the initial implementation report. Fields marked `PENDING` must be replaced only
after the named command or remote-state check actually runs. Source presence is not a
passing test result.

## Project identity

| Field | Value |
| --- | --- |
| Local path | `C:\Users\Owner\Documents\Codex\2026-09-21\morph-model-optimized-representation-for-prompt` |
| Canonical specification | `SPEC.md`, version 0.1.0 |
| Node.js requirement | `>=22.12.0 <25` |
| pnpm requirement | `10.15.0` |
| Inspected local Node.js | `24.19.0` |
| Inspected local pnpm | `10.15.0` |
| Git branch before final handoff | `main` |
| Final commit | `[PENDING FINAL GIT STEP]` |
| Final working-tree state | `[PENDING FINAL GIT STEP]` |

## Release conclusions

| Area | Status | Evidence or limitation |
| --- | --- | --- |
| Local implementation | **Code present, final verification pending** | SDK, core, codecs, tokenizer, planner, CLI, evaluation, workbench, schema registry, and optional Jev adapter are present. Required final commands are pending below. |
| Data preservation | **PENDING FINAL TEST RUN** | Native and TOON tests exist. No pass count is recorded here before execution. |
| Token measurement | **Implemented, final suite pending** | Complete `MORPH-PROMPT/1` text is counted with the named local tokenizer. Benchmark rows are pending. |
| Model comprehension | **Not evaluated** | A bounded provider-neutral runner is present, but no provider adapter, live model call, measured manifest, or quality profile is bundled. |
| Jev adapter | **Implemented optional adapter; live test not-run** | Synthetic/offline contract behavior only. No credentialed TypeSafe request is claimed. |
| Schema registry | **Implemented optional extension; final test result pending** | In-memory and handle-hardened local-filesystem registries, references, and hydration are present. |
| Private GitHub repository | **PENDING FINAL REPOSITORY STEP** | The requested private remote must be created, pushed, and queried before a URL is recorded. |
| Public release | **Not authorized** | No public visibility, npm publication, GitHub release, or hosted demo is authorized. |
| Deployment | **Not run** | No Vercel, Firebase, or other hosted resource is required or authorized. |

## Implemented local surface

### SDK and compiler

- `@morph/sdk` composed entry point with `createDefaultMorph()`.
- Strict JSON parser with duplicate-key detection, number-lexeme preservation, Unicode
  scalar checks, and byte, depth, and node limits.
- Descriptor-based JavaScript-value adapter that rejects unsupported and unsafe values.
- Tagged `morph-ir/1`, semantic equality, and SHA-256 `morph-c14n/1` digests.
- Exact structural shape profiler with missing and null counts kept separate, plus an
  explicit inexact flag and untracked count when the scalar-cardinality cap is reached.
- Draft 2020-12 schema validation through Ajv 8.20 without coercion or mutation.
- Explicit failure for remote schema references, unsupported dialects, and exact numeric
  validation that would cross a precision-sensitive JavaScript number boundary.
- Bounded deterministic candidate planning, compact JSON baseline, policy and quality
  gates, token budget, minimum-savings hysteresis, and explain reason codes.
- Fatal-by-default encoder failures with an explicit per-compiler quarantine mode that
  cannot bypass baseline or semantic checks.
- `morph-artifact/1`, collision-checked `MORPH-CONTEXT/1`, and complete
  `MORPH-PROMPT/1` rendering.
- Artifact integrity, direct decode, self-contained-bundle decode, and verification APIs.
- Compact JSON UTF-16 source-map helper.

### Codecs

| Codec | Version | Applicability |
| --- | --- | --- |
| Compact JSON | `json-compact@1` | Every accepted IR |
| JSON Lines | `json-lines@1` | Root arrays, including empty arrays |
| Typed delimited rows | `rows-delimited@1` | Nonempty uniform primitive record arrays; tab, comma, pipe, semicolon |
| Column JSON | `columns-json@1` | Nonempty uniform primitive record arrays |
| Typed path/value | `path-value@1` | Every accepted IR |
| Official TOON | `toon@4.1.1` | Only inputs proven to survive official encode/decode under MORPH equality |

### Tokenizer

```text
profile: local-o200k-base
tokenizer: o200k_base
implementation: js-tiktoken 1.0.21, third-party TypeScript port
revision: js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d
scope: complete visible rendered text
certainty: exact-for-tokenizer
runtime asset download: none
provider binding: none
model-quality binding: none
official Python oracle: tiktoken 0.14.0 encode_ordinary, 7/7 fixture cases, 0 mismatches
Python runtime dependency: none
```

### CLI

Implemented commands:

```text
inspect
compare
compile
render
decode
verify
bench --suite conformance|tokens|performance --offline
doctor
```

The CLI supports bounded standard input and file reads, strict UTF-8, structured stdout
and stderr separation, no-overwrite defaults, explicit `--force`, lexical and resolved
workspace-parent checks, recoverable temporary-file replacement, token budget options,
forced encoding, experimental policy, and an inert-by-default network permission flag.
Its package includes a `synthetic-v2` manifest and nine fixture files so installed
offline benchmark commands do not depend on repository-relative fixture paths.

### Evaluation and workbench

- Versioned `synthetic-v2` fixture manifest and deterministic ground-truth corpus helpers
  with size strata, uniform-table variants, repeated-category variants, and seven task
  families.
- Offline conformance and complete-prompt token suites.
- Performance microbenchmarks for parse, profile, native encode/decode, render, warm
  tokenize, and full compare, with environment, warmup/sample counts, median, p95, cold
  tokenizer load, and approximate heap delta.
- Seeded paired dataset-cluster bootstrap analysis for caller-supplied binary correctness
  records. No measured correctness records or generated quality profile are bundled.
- Provider-neutral bounded model-evaluation runner that prepares matched compact-JSON and
  candidate trials, randomizes by seed, enforces request, concurrency, retry, timeout,
  output, and call-or-priced-cost limits, and preserves complete denominators. No provider
  adapter or live result is bundled.
- Local React/Vite workbench with native codecs, gated TOON, worker execution,
  cancellation, request-digest stale-result protection, synthetic examples, honest
  preservation/token/quality/policy states, user-initiated downloads, and local artifact
  import through strict parse, verify, render, and decode paths.

### Optional extensions

- Content-addressed schema and guide bundles.
- Bounded in-memory and local-filesystem registries. Filesystem reads use one handle,
  bounded chunks, before-and-after file identity checks, and change detection.
- Registry artifact references and verified hydration back to a self-contained artifact.
- Optional Jev HTTP access-pattern classifier with explicit network and task-disclosure
  gates, timeout and cancellation, a default 256 KiB response cap, bounded response
  validation with an exact choice set, abstention, and deterministic fallback.
- Every root and workspace package manifest requires Node.js `>=22.12.0 <25`. The root
  lock uses an `esbuild` 0.28.2 override as audit hardening.
- The package smoke script packs all nine Node packages, including the optional schema
  registry and Jev planner, and exercises their public entry points in a clean consumer.
  Dependency installation may query the package registry when pnpm metadata is absent;
  the installed runtime checks keep MORPH networking disabled. Its actual result remains
  pending below.

## Commands and actual outcomes

The final operator must replace every pending row with the actual exit code and concise
result. Do not mark a command passed from source review.

| Command | Exit code | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm morph doctor` | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm lint` | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm typecheck` | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm test` | `[PENDING]` | `[PENDING: passed, failed, skipped counts]` |
| `pnpm test:extended` | `[PENDING]` | `[PENDING: generated case count, seed, passed/failed]` |
| `pnpm build` | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm smoke:package` | `[PENDING]` | `[PENDING FINAL RUN]` |
| CLI inspect smoke | `[PENDING]` | `[PENDING FINAL RUN]` |
| CLI compare smoke | `[PENDING]` | `[PENDING FINAL RUN]` |
| CLI compile/render/verify/decode smoke | `[PENDING]` | `[PENDING FINAL RUN AND ARTIFACT PATHS]` |
| Workbench production build | `[PENDING]` | `[PENDING FINAL RUN]` |
| Workbench browser smoke | `[PENDING]` | `[PENDING FINAL RUN]` |
| `pnpm bench:conformance` | `[PENDING]` | `[PENDING: total, passed, failed, inapplicable]` |
| `pnpm bench:tokens` | `[PENDING]` | `[PENDING: measured rows and report path]` |
| `pnpm bench:performance` | `[PENDING]` | `[PENDING: environment, stages, report path]` |
| Development-only Python tokenizer oracle | `0` | Official `tiktoken` 0.14.0 `encode_ordinary`: 7 fixture cases checked, 0 mismatches. |
| Dependency audit | `[PENDING]` | `[PENDING: command and actual findings]` |
| License review | n/a | `[PENDING REVIEW]` |
| SBOM generation | n/a | `[PENDING: generated path or not generated]` |
| GitHub Actions `offline-ci` | `[PENDING]` | `[PENDING: run state and verified URL after push]` |

## Acceptance summary

| Acceptance area | Status |
| --- | --- |
| JSON input and IR edge cases | `[PENDING FINAL TEST RUN]` |
| JavaScript-value rejection | `[PENDING FINAL TEST RUN]` |
| Native codec round trips | `[PENDING FINAL TEST RUN]` |
| TOON gates and conformance | `[PENDING FINAL TEST RUN]` |
| Tamper and malformed decode rejection | `[PENDING FINAL TEST RUN]` |
| Self-contained rendered-context reconstruction | `[PENDING FINAL TEST RUN]` |
| Full-render tokenizer selection | `[PENDING FINAL TEST RUN]` |
| Budget, candidate, and timeout behavior | `[PENDING FINAL TEST RUN]` |
| Schema validation and numeric fail-closed path | `[PENDING FINAL TEST RUN]` |
| Deterministic artifact identity | `[PENDING FINAL TEST RUN]` |
| Unicode source-map offsets | `[PENDING FINAL TEST RUN]` |
| CLI file and exit behavior | `[PENDING FINAL TEST RUN]` |
| Workbench offline, artifact-import, stale-result, and accessibility behavior | `[PENDING FINAL TEST RUN]` |
| Schema registry and hydration | `[PENDING FINAL TEST RUN]` |
| Jev offline fallback and response validation | `[PENDING FINAL TEST RUN]` |

## Benchmark results

### Codec conformance

Status: **PENDING FINAL RUN**

```text
report path: [PENDING]
total: [PENDING]
passed: [PENDING]
failed: [PENDING]
inapplicable: [PENDING]
```

### Token measurements

Status: **PENDING FINAL RUN**

```text
report path: [PENDING]
tokenizer revision: [PENDING CONFIRMATION]
measured candidate rows: [PENDING]
claims derived from results: none until reviewed
```

### Performance microbenchmarks

Status: **PENDING FINAL RUN**

```text
report path: [PENDING]
environment: [PENDING]
warmup runs: [PENDING]
sample runs: [PENDING]
stage summary: [PENDING]
```

Microbenchmark output is local machine evidence. Approximate heap delta is not peak
memory.

### Model task quality

Status: **not-run**

No paid or free provider model evaluation was run for this local implementation report.
The provider-neutral runner was not supplied with a live provider adapter. No accuracy,
noninferiority, cost, latency, or quality-profile claim is made.

## Optional integration status

### Jev

```text
adapter source: implemented
offline contract fixtures: synthetic
default response byte cap: 256 KiB
live credentials checked: no
live contract test: not-run
resolved model version: unavailable because no call ran
core compiler dependency: false
quality-evidence authority: none
```

### Provider token and request accounting

```text
local visible-text tokenizer: implemented
full provider request counter: not implemented
provider-neutral bounded evaluation runner: implemented
provider adapter: not implemented
provider-reported usage: not-run
evaluation pricing-profile contract: implemented, no profile bundled
production request pricing profile: not implemented
prompt-cache experiment: not-run
```

## Known limitations

1. Model quality is unbound. Smaller prompts may be harder for a model to understand.
2. The local tokenizer is a third-party port and counts visible rendered text only.
3. No provider request framing, billing count, context-overhead adapter, provider client,
   or production pricing profile is bundled. The evaluation runner accepts caller-supplied
   pricing metadata only for bounded experimental execution.
4. Quality-profile binding, expiry, sample-count, dataset-count, and confidence-bound
   gates exist, but core does not reproduce the statistics, prove dataset independence,
   or authenticate provenance. No profile is bundled.
5. Ajv cannot establish exact arbitrary-precision numeric keyword validation. MORPH
   rejects the affected combination rather than round.
6. TOON cannot preserve all accepted MORPH number lexemes and is gated per input.
7. Compact JSON is the only source-mapped codec, and its map is a separate diagnostic
   result rather than an artifact field.
8. Planning timeout and core cancellation use cooperative checkpoints and cannot
   interrupt one synchronous codec or tokenizer operation.
9. Dictionary transforms, missingness masks, hybrid layouts, retained provider context,
   prompt-cache integration, binary formats, delta encoding, query execution, and learned
   cost models are not implemented.
10. Filesystem checks constrain output to the selected workspace, but the CLI remains a
    local tool rather than a multi-tenant authorization boundary.
11. Registry references are not model-ready and require verified local hydration.
12. Jev defaults to a movable request alias and has not passed a live contract test.
13. No owner license, npm publication, release, hosted demo, or public visibility has
    been selected.

## Repository and publication state

| Field | Value |
| --- | --- |
| GitHub authentication | `[PENDING FINAL REPOSITORY STEP]` |
| Remote owner | `[PENDING FINAL REPOSITORY STEP]` |
| Repository | `[PENDING FINAL REPOSITORY STEP]` |
| Verified URL | `[PENDING FINAL REPOSITORY STEP]` |
| Visibility | `[PENDING, must be private]` |
| Default branch | `[PENDING FINAL REPOSITORY STEP]` |
| Push result | `[PENDING FINAL REPOSITORY STEP]` |
| Offline CI run | `[PENDING FINAL REPOSITORY STEP]` |
| npm packages | Not published |
| GitHub release | Not created |
| Public repository | Not authorized |
| Hosted workbench | Not deployed |
| Firebase resources | Not created or modified |
| Vercel resources | Not created or modified |

## Generated artifact paths

```text
compiled smoke artifact: [PENDING]
rendered context: [PENDING]
restored JSON: [PENDING]
explain report: [PENDING]
conformance report: [PENDING]
token report: [PENDING]
performance report: [PENDING]
```

The final handoff must replace these placeholders with verified paths or explicitly state
that an artifact was not retained.
