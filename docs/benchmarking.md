# Benchmarking and evidence

MORPH separates three test layers. Results from one layer do not imply results from
another.

| Layer | Question | Offline status |
| --- | --- | --- |
| A. Codec conformance | Can software reconstruct the accepted data exactly? | Implemented offline suite; final run result belongs in `RELEASE_REPORT.md`. |
| B. Prompt efficiency | How many tokens does the complete rendered prompt use under one identified tokenizer? | Implemented offline suite; final counts belong in generated reports, not prose claims. |
| C. Model task quality | Does a specific model answer matched tasks correctly from each representation? | A bounded provider-neutral runner and paired-analysis helper are implemented. No provider adapter, measured result, or quality profile is bundled. Status is `not-run`. |

No token or accuracy result in this repository should be treated as a universal property
of an encoding.

## Committed offline manifest

`fixtures/benchmark-manifests/offline-v1.json` records:

```text
manifestVersion: morph-benchmark-manifest/1
fixtureVersion: synthetic-v2
seed: 20260921
qualityEvaluation: not-run
modelEvaluation: not-run
```

It lists nine synthetic fixture files:

| Fixture | Primary coverage |
| --- | --- |
| `fixtures/examples/customers.json` | Uniform primitive customer table |
| `fixtures/conformance/numeric-edge.json` | Large integer, exponent, negative zero, and exact decimal lexemes |
| `fixtures/conformance/nested.json` | Nested objects and arrays plus empty containers |
| `fixtures/conformance/sparse.json` | Missing fields, null, false, and empty strings |
| `fixtures/conformance/repeated.json` | Repeated categories and readable labels |
| `fixtures/conformance/multilingual.json` | Emoji, Chinese text, accents, combining marks, delimiters, and newlines |
| `fixtures/conformance/tiny.json` | Guide overhead on very small input |
| `fixtures/conformance/adversarial.json` | Prompt-like values, marker-shaped text, and hostile-looking keys |
| `fixtures/conformance/sequence.json` | Array order and duplicate events |

The `synthetic-v2` manifest records the small, medium, and large generated-corpus strata,
four uniform-table shape and field-name variants, three repeated-category cardinality
variants, and all seven deterministic task families. It also records that any model run
requires an explicit request cap and either a call cap or a priced cost cap.

The evaluation package exports `generateSyntheticCorpus(seed)`. Its deterministic cases
cover the declared uniform and repeated-category variants plus nested, sparse,
identifier-heavy, numeric, Unicode, sequence-sensitive, tiny, and adversarial families.
Each case carries deterministic ground-truth tasks. The function does not launch
evaluations by itself.

Source evaluation scripts read `fixtures/benchmark-manifests/offline-v1.json`. The CLI
package also ships `benchmark-fixtures/manifest.json` and local copies of the same nine
curated fixture files. Its `files` list includes that directory, so an installed CLI can
run conformance, token, and performance suites without reaching back into a repository
workspace. Both manifests identify `synthetic-v2` and seed `20260921`.

## Layer A: offline conformance

Run:

```console
pnpm bench:conformance
```

or save both formats through the CLI:

```console
pnpm morph bench \
  --suite conformance \
  --offline \
  --report reports/conformance.json \
  --markdown reports/conformance.md
```

For each manifest fixture, `runOfflineConformance`:

1. Strictly parses the JSON text into an IR.
2. Enumerates every plan from the five native codecs and official TOON adapter.
3. Records unsupported plans as `inapplicable`, retaining the reason.
4. Encodes and independently decodes every supported plan.
5. Requires `semanticEqual(original, decoded)`.
6. Runs one full experimental compile, renders and verifies its selected artifact, decodes
   JSON, reparses it, and checks semantic equality.

The result manifest is `morph-offline-conformance/1` and includes generation time,
tokenizer identity, `modelQuality: "not-run"`, totals, and every individual outcome.
The bench process exits nonzero when a supported case fails. Inapplicability is not a
failure because a codec may legally declare a shape or numeric lexeme unsupported.

Unit, integration, security, CLI, workbench, and property tests add focused cases outside
this fixture loop. The extended command sets `MORPH_PROPERTY_RUNS=5000`. The current
allocation derives 2,500 general JSON inputs and 625 uniform-table inputs, then runs
every applicable codec plan for each generated input. The ordinary command uses a budget
of 500, which derives 250 general inputs and 63 table inputs. Both properties use fixed
seeds in source. This is a test-budget convention, not a claim that exactly 5,000
independent inputs were generated. Finite generated executions complement explicit edge
fixtures and are not mathematical proof.

## Layer B: token suite

Run:

```console
pnpm bench:tokens
```

or:

```console
pnpm morph bench \
  --suite tokens \
  --offline \
  --report reports/tokens.json \
  --markdown reports/tokens.md
```

For each fixture, `runOfflineTokenSuite` builds a complete comparison request using:

```text
target: local-o200k-base
policy: economy-experimental
objective: prompt-tokens
task: Inspect this complete synthetic dataset.
network: disabled
quality profiles: none
```

Every finalist is encoded, decoded, self-contained-bundle verified, fully rendered, and
then tokenized as one complete string. The authoritative count includes:

- `MORPH-PROMPT/1` framing;
- caller prefix and suffix, even when empty;
- compiler interpretation guide;
- representation metadata;
- schema when supplied;
- payload;
- task instruction.

The count excludes provider message framing, hidden instructions, tool and output
schemas, images, generated output, billing adjustments, and cache pricing. Component
counts are not added because tokenization can cross concatenation boundaries.

The result is `morph-offline-tokens/1`. Each row includes fixture, encoding, measured
tokens, signed token and fractional delta from compact JSON, eligibility, and quality
status. Negative savings remain visible. The manifest also reports median and p95 full
comparison wall-clock samples.

Those token-suite timings are informative local measurements. Use the dedicated
microbenchmark suite for stage-level measurements. Neither suite enforces regression
thresholds. Do not publish timings as cross-machine latency claims.

## Offline performance microbenchmarks

Run:

```console
pnpm bench:performance
```

or:

```console
pnpm morph bench \
  --suite performance \
  --offline \
  --report reports/performance.json \
  --markdown reports/performance.md
```

The command reads the first fixture in the offline manifest. `runMicrobenchmarks`
defaults to three warmup iterations and 20 measured iterations. It records median and
p95 milliseconds for:

- strict parse;
- shape profile;
- encode and decode for the first supported plan of each native codec;
- compact JSON model-context render;
- warm local tokenization;
- full comparison, including registered TOON candidates.

The `morph-microbench/1` result also records generation time, Node version, platform,
architecture, tokenizer identity and revision, canonical input bytes, warmup and sample
counts, one initial tokenizer-load timing, and an approximate nonnegative heap delta
between the beginning and end of the loop. The heap delta is not peak resident memory,
does not force garbage collection, and must not be presented as a peak-memory result.

Per-codec stage measurements cover `builtInEncoders`, which are the five native codecs.
The full-compare stage uses the evaluation compiler and therefore includes the gated TOON
adapter. Results remain local machine observations with `modelQuality: "not-run"`.

## Tokenizer evidence

The bundled adapter identifies itself as:

```text
o200k_base
js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d
```

The asset digest is the pinned digest documented for the expanded official vocabulary.
The implementation is a third-party TypeScript port with bundled ranks and no runtime
download. Tests compare selected whitespace, punctuation, Unicode, numeric, delimiter,
and special-token-looking strings against the installed `tiktoken` 1.0.22 JavaScript or
WebAssembly package and verify the asset digests. The checked token IDs and counts are
committed in `fixtures/tokenizer/o200k-base-v1.json`. All seven fixture cases were also
executed with official Python `tiktoken` 0.14.0 `encode_ordinary`; the committed IDs had
zero mismatches. Python was a development-only oracle and is not needed by the SDK, CLI,
browser, or ordinary test run.

These cross-checks are useful but are not a live provider request count. Counts are
labeled exact only for the named local adapter and revision. The profile has no model
binding.

To reproduce the official fixture in an isolated development environment with Python
`tiktoken==0.14.0` installed, run:

```console
python scripts/generate-tokenizer-fixture.py
```

The script emits JSON to standard output only. Capture it to a temporary ignored file,
review the package version and asset digest in the output, and compare it with
`fixtures/tokenizer/o200k-base-v1.json`. It is not invoked by the SDK, CLI, workbench,
ordinary tests, or CI.

## Layer C: model quality

The evaluation package implements a provider-neutral bounded runner around the
`ModelEvaluator` interface. It does not implement a provider client. No live request,
answer, accuracy, latency, cost, or model revision has been measured for this release.

`prepareModelEvaluationCases` compiles compact JSON and each requested nonbaseline
encoding on the same complete dataset and task. Inapplicable or failed preparations are
recorded as exclusions. `runModelEvaluation` then uses a seeded shuffle and enforces:

- an explicit nonempty provider ID, while credentials remain the adapter's responsibility;
- maximum requests, concurrency, retries, output tokens, and per-request timeout;
- exactly one of a separately approved call cap or a cost cap with a versioned price
  profile;
- matched complete information and tasks across representations;
- recorded provider model identity when the adapter reports it;
- output-digest recording by default, with raw output retention only when explicitly
  enabled.

Cost-capped runs reserve the measured complete prompt tokens plus the pricing profile's
maximum input-overhead allowance, the maximum output tokens, and any fixed request cost.
Provider-reported usage replaces the reservation when valid usage is returned. A timeout
aborts the supplied signal, but a provider adapter is still responsible for honoring that
signal and its own transport cancellation.

The result is a `morph-model-evaluation/1` manifest. It records benchmark, git, fixture
set, runtime and CPU provenance, trial order, exclusions, settings, attempts, provider
identity and usage when reported, latencies, cost basis when configured, complete
denominators, and aggregates by encoding, task family, and data family. Failures,
refusals, truncations, invalid outputs, and exhausted retries remain in the accuracy
denominator after a provider request is made. Trials stopped before any request are
`not-run` and stay outside that denominator. Omitting the evaluator produces a fully
recorded `PROVIDER_NOT_CONFIGURED` not-run manifest with zero provider requests.

An executed runner manifest is labeled `measured-unqualified`. It does not itself create
a quality profile. Its matched binary correctness records still need the prespecified
paired uncertainty analysis and exact core identity binding described below.

Any caller-supplied evaluator remains responsible for identical answer schema, tool
access, model settings, credential handling, disclosure authorization, and output
validation across representations.

Live model calls are not part of pull-request CI.

## Ground truth and fair comparisons

The synthetic corpus defines deterministic expected answers for:

- single-record lookup;
- cross-record comparison;
- multi-field filtering;
- nested-path lookup;
- missing-versus-null distinctions;
- order-sensitive questions;
- small exact aggregation.

A fair comparison must keep the complete accepted dataset and task constant. It must
include every representation's actual guide and schema. It must not precompute an answer
for only one encoding, change the output format between candidates, remove failures from
the denominator, or mix fresh-context and cache-reuse trials.

Trial order, seed, request settings, refusals, parse failures, timeouts, truncations, and
retries must be recorded. Results should be reported by data family, task family, model,
and aggregate so a poor family is not hidden by a global mean.

## Quality qualification method

The product specification requires candidate quality to be compared with compact JSON on
matched cases:

```text
delta = accuracy(candidate) - accuracy(compact JSON)
```

A noninferiority profile may qualify only when a prespecified lower confidence bound for
`delta` exceeds the negative allowed-regression margin. Dataset clusters, not repeated
calls on one dataset, are the independent units. Model, tokenizer, renderer, guide,
encoder, options, workload, and evidence digest must match.

`@morph/evaluation` implements `evaluatePairedNoninferiority` using
`paired-dataset-cluster-bootstrap-v1`. Each input record identifies one unique matched
case and one dataset, plus baseline and candidate binary correctness. The helper computes
case differences, averages within each dataset, gives each dataset cluster equal weight,
and uses a seeded bootstrap that resamples those cluster means with replacement. Its
percentile interval, case count, independent-dataset count, method ID, and deterministic
evidence digest are returned. The helper requires at least 100 bootstrap samples, a
confidence level strictly between zero and one, and a configured minimum of at least two
independent datasets. It returns `insufficient` when configured case or dataset minima are
not met, otherwise `qualified` only when the lower bound is greater than the negative
allowed-regression margin.

This helper analyzes caller-supplied paired correctness records. It does not run a model,
establish that dataset IDs are truthful, verify preregistration, or create a bundled
quality profile. Core separately validates a profile's declared binding to encoding,
options, task family, target, model, tokenizer, guide, and renderer. It requires a finite
ordered confidence interval, a lower bound above the declared margin, positive case
counts, at least two independent datasets, digest-shaped identity fields, nonempty
provenance and metric fields, dataset characteristics, and a future or absent expiry.
No profile is bundled. Therefore all current model-quality claims remain `unknown` or
`not-run`.

## Train and test separation

Future heuristic or learned planners must be tuned only on development data. A valid
held-out manifest should separate dataset generators or complete dataset instances, not
only ask new questions about a leaked table. It must be frozen before reporting qualified
results. Neither deterministic planning nor optional Jev classification may receive
held-out answers.

## Jev evaluation status

The optional Jev package can classify a task into a bounded access-pattern set and report
its probability distribution, confidence statistic, model identity, usage, and latency.
It is not connected to codec eligibility or quality evidence. Its documented integration
status is:

```text
offline contract fixtures: synthetic
live contract test: not-run
```

Jev confidence is distribution concentration, not a measured probability of downstream
answer correctness. A future comparison must include planner latency and cost as well as
downstream quality and prompt savings.

## Result handling and claims

Generated reports belong under ignored `reports/` paths unless a curated synthetic report
is deliberately reviewed for inclusion. Raw provider traffic must never be committed by
default.

Every published report should identify:

- commit and clean/dirty state;
- fixture and manifest versions;
- execution date and machine environment;
- tokenizer and actual model revisions;
- request template, schema, tools, and settings;
- complete denominators and failure policy;
- known limitations;
- commands needed to reproduce the result.

No chart or marketing statement may be added from placeholder data. Final local test and
benchmark outcomes are recorded only after execution in `RELEASE_REPORT.md`.
