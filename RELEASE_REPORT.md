# MORPH release report

Report status: **LOCAL RELEASE COMPLETE; PRIVATE REPOSITORY AND PRIVATE WEBSITE VERIFIED**
Specification version: `0.1.0`
Package version: `0.1.0`
Report date: 2026-09-22

This is the verified initial implementation report. The recorded commands were executed
against the implementation commit identified below. Source presence alone was not
treated as a passing result.

## Project identity

| Field | Value |
| --- | --- |
| Local path | `C:\Users\Owner\Documents\Codex\2026-09-21\morph-model-optimized-representation-for-prompt` |
| Canonical specification | `SPEC.md`, version 0.1.0 |
| Node.js requirement | `>=22.12.0 <25` |
| pnpm requirement | `10.15.0` |
| Inspected local Node.js | `24.19.0` |
| Inspected local pnpm | `10.15.0` |
| Git branch | `main` |
| Verified implementation commit | `87fb3d6b3dea887ef660e0c559f9c31fd2b8f55c` |
| Verified website code commit | `1a3f2996d53fc1af0487955f2558bb5e69f73463` |
| First private website version | `appgprj_6ab247d82f608191a012fb1456fdaec1~appgver_12a94cbaf20c8191b29609067c5f6cd0` |
| Release evidence commit | The descendant commit containing this report and curated reports. Its SHA is provided in the final handoff because a commit cannot contain its own identity. |
| Final working-tree state | Clean `main` tracking `origin/main`, verified after the release-evidence commit. |

## Release conclusions

| Area | Status | Evidence or limitation |
| --- | --- | --- |
| Local implementation | **Complete locally** | SDK, core, codecs, tokenizer, planner, CLI, evaluation, workbench, schema registry, and optional Jev adapter passed the recorded offline verification. |
| Data preservation | **Verified on required suites** | 128 ordinary tests, the extended seeded property suite, and 70 applicable offline conformance cases passed with zero failures. |
| Token measurement | **Verified for the named tokenizer** | 61 complete rendered candidate prompts were measured across nine synthetic fixtures. Counts are exact for the named local tokenizer only. |
| Model comprehension | **Not evaluated** | A bounded provider-neutral runner is present, but no provider adapter, live model call, measured manifest, or quality profile is bundled. |
| Jev adapter | **Implemented optional adapter; live test not-run** | Synthetic/offline contract behavior only. No credentialed TypeSafe request is claimed. |
| Schema registry | **Implemented and tested optional extension** | In-memory and handle-hardened local-filesystem registries, references, hydration, packed installation, and public entry points passed. |
| Private GitHub repository | **Created and verified private** | `https://github.com/Zen-ctrl/morph`, default branch `main`, visibility `PRIVATE`. |
| Private project website | **Deployed and verified** | Owner-only site at `https://morph-context-compiler.goeyy.chatgpt.site`. The first website deployment used source commit `1a3f2996d53fc1af0487955f2558bb5e69f73463`. |
| Public release | **Not authorized** | No public visibility, npm publication, GitHub release, or public demo is authorized. |
| Other deployment | **Not run** | No Vercel or Firebase resource was created or modified. |

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
- Local React/Vite project website and workbench with native codecs, gated TOON, worker execution,
  cancellation, request-digest stale-result protection, synthetic examples, honest
  preservation/token/quality/policy states, user-initiated downloads, and local artifact
  import through strict parse, verify, render, and decode paths. The surrounding dossier
  documents the use case, invariant, compiler pipeline, format families, evidence layers,
  policy modes, trust boundaries, developer entry points, and canonical references.

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
  the installed runtime checks keep MORPH networking disabled. The smoke passed locally
  and in GitHub Actions.

## Commands and actual outcomes

Every row below records an executed command or a directly verified remote state.

| Command | Exit code | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | `0` | Lockfile current; all 11 workspace projects already up to date. |
| `pnpm morph doctor` | `0` | Node range valid; six encoders registered; both tokenizer asset digests matched; network disabled; model quality not-run. |
| `pnpm lint` | `0` | Biome checked 114 files with no fixes required. |
| `pnpm typecheck` | `0` | Root strict TypeScript project passed. |
| `pnpm test` | `0` | 23 files and 128 tests passed; zero failed or skipped. |
| `pnpm test:extended` | `0` | Five files and 28 test definitions passed with seed 20260921. The 5,000 property budget generated 2,500 general inputs and 625 uniform-table inputs, exercising at least 5,000 complete native bundle round trips. |
| `pnpm build` | `0` | All nine Node packages and the React/Vite workbench built successfully. |
| `pnpm smoke:package` | `0` | All nine packages packed and installed in a clean consumer; installed CLI conformance, SDK decode, registry, and Jev fallback passed. |
| CLI inspect smoke | `0` | Customer fixture accepted as a 19-node uniform record array without exposing raw values in profile output. |
| CLI compare smoke | `0` | 11 candidates fully evaluated; compact JSON selected at 896 visible-text tokens under the named tokenizer. |
| CLI compile/render/verify/decode smoke | `0` | Artifact `246f514b92b50b4c3c35d3b90ea2f5e24b4f4d4ee5bfe4b3cddd0ee3919892f3` compiled, rendered, checksum-verified, bundle-decoded, and restored. |
| Workbench production build | `0` | Vite transformed 19 modules and produced the local static build with the project dossier and supplied brand assets. |
| Workbench browser smoke | `0` | Two workbench test files and five tests passed with network-blocking globals; local preview returned HTTP 200 with the root mount. |
| Website full local verification | `0` | `pnpm run ci` checked 117 files, passed strict typecheck, passed 23 test files and 128 tests, and built all workspace packages plus the website. |
| Website extended property suite | `0` | Five files and 28 test definitions passed with the existing 5,000-round-trip budget and seed. |
| Website package smoke | `0` | All nine packages still packed and installed in a clean consumer after the website changes. |
| Website visual and runtime check | `0` | Desktop and 390 px mobile layouts rendered without browser console warnings; the real compiler completed in the website and selected compact JSON with a measured 862-token render for the default workbench example. |
| Private website deployment | `0` | Owner-only deployment `appgdep_6ab24e498a748191858bc650e94ee827` succeeded at `https://morph-context-compiler.goeyy.chatgpt.site`. |
| Website GitHub Actions `offline-ci` | `0` | Run `35712083116` passed for website commit `1a3f2996d53fc1af0487955f2558bb5e69f73463`. |
| CLI conformance bench | `0` | 73 cases: 70 passed, 0 failed, 3 correctly inapplicable across nine fixtures. |
| CLI token bench | `0` | 61 complete rendered candidate rows measured across nine fixtures; 58 were policy-eligible. |
| CLI performance bench | `0` | 15 stages, 3 warmups, and 20 measured samples per stage on Node 24.19.0, Windows x64. |
| Development-only Python tokenizer oracle | `0` | Official `tiktoken` 0.14.0 `encode_ordinary`: 7 fixture cases checked, 0 mismatches. |
| Dependency audit | `0` | `pnpm audit --json`: 0 info, low, moderate, high, or critical advisories across 222 dependencies. |
| License review | `0` | `pnpm licenses list --json` reviewed installed metadata: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MIT OR Apache-2.0, and MPL-2.0. No owner license was selected. |
| SBOM generation | n/a | Not generated because no SBOM tool was selected for this private local release. The exact lockfile and license inventory are retained. |
| GitHub Actions `offline-ci` | `0` | Run `35694875841` passed every job for commit `87fb3d6`; verified at `https://github.com/Zen-ctrl/morph/actions/runs/35694875841`. |

The first CI attempt, run `35694671741`, failed only because the clean-consumer install
used strict pnpm offline resolution without cached registry metadata. Commit `87fb3d6`
changed installation to prefer the cache while permitting dependency metadata retrieval,
then kept every installed MORPH runtime check offline. The corrected workflow passed.

## Acceptance summary

| Acceptance area | Status |
| --- | --- |
| JSON input and IR edge cases | Passed |
| JavaScript-value rejection | Passed |
| Native codec round trips | Passed |
| TOON gates and conformance | Passed; three precision-sensitive plans were correctly inapplicable |
| Tamper and malformed decode rejection | Passed |
| Self-contained rendered-context reconstruction | Passed |
| Full-render tokenizer selection | Passed |
| Budget, candidate, and timeout behavior | Passed |
| Schema validation and numeric fail-closed path | Passed |
| Deterministic artifact identity | Passed |
| Unicode source-map offsets | Passed |
| CLI file and exit behavior | Passed |
| Workbench offline, artifact-import, stale-result, and accessibility behavior | Passed |
| Schema registry and hydration | Passed |
| Jev offline fallback and response validation | Passed; live call not-run |

## Benchmark results

### Codec conformance

Status: **passed**

```text
report path: reports/examples/conformance.json
source commit: 92f8b09c427e9a1d7da3e9aed354bff530d6a538
fixture set: synthetic-v2, nine fixtures
total: 73
passed: 70
failed: 0
inapplicable: 3
```

### Token measurements

Status: **measured for local tokenizer; model quality not-run**

```text
report path: reports/examples/tokens.json
source commit: 92f8b09c427e9a1d7da3e9aed354bff530d6a538
tokenizer revision: js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d
measured candidate rows: 61 across nine fixtures
eligible rows: 58
claims derived from results: tokenizer-specific fixture measurements only; no universal savings or quality claim
```

### Performance microbenchmarks

Status: **measured locally**

```text
report path: reports/examples/performance.json
source commit: 92f8b09c427e9a1d7da3e9aed354bff530d6a538
environment: Node 24.19.0, win32 x64, AMD Ryzen 7 5800XT, 16 logical CPUs
warmup runs: 3
sample runs: 20 per stage
stage summary: 15 stages and 300 timing samples; full compare median 16.220 ms, p95 17.155 ms; warm tokenizer median 0.847 ms, p95 0.929 ms
cold tokenizer load: 345.117 ms
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
13. No owner license, npm publication, GitHub release, public demo, or public visibility
    has been selected. The project website is owner-only.

## Repository and publication state

| Field | Value |
| --- | --- |
| GitHub authentication | Authenticated local GitHub CLI account `Zen-ctrl` |
| Remote owner | `Zen-ctrl` |
| Repository | `morph` |
| Verified URL | `https://github.com/Zen-ctrl/morph` |
| Visibility | `PRIVATE` |
| Default branch | `main` |
| Push result | Successful; local `main` tracks `origin/main` |
| Offline CI run | Core release passed: `https://github.com/Zen-ctrl/morph/actions/runs/35694875841`; website update passed: `https://github.com/Zen-ctrl/morph/actions/runs/35712083116` |
| npm packages | Not published |
| GitHub release | Not created |
| Public repository | Not authorized |
| Private project website | Deployed owner-only: `https://morph-context-compiler.goeyy.chatgpt.site` |
| Firebase resources | Not created or modified |
| Vercel resources | Not created or modified |

## Generated artifact paths

```text
compiled smoke artifact: artifacts/release-customers.morph.json
rendered context: artifacts/release-customers.context.txt
restored JSON: artifacts/release-customers.restored.json
explain report: reports/examples/release-explain.json
comparison report: reports/examples/customers-comparison.json
conformance report: reports/examples/conformance.json and reports/examples/conformance.md
token report: reports/examples/tokens.json and reports/examples/tokens.md
performance report: reports/examples/performance.json and reports/examples/performance.md
```

The three artifact files are intentionally ignored local outputs. The curated synthetic
reports are committed. No dataset, artifact, or report was uploaded outside the private
GitHub repository.
