# Command-line interface

The CLI package is private and runs from this workspace. Use:

```console
pnpm morph <command> [options]
```

The built binary name is `morph`, but no global install or published package is required.

## General behavior

- Input and artifact commands accept `--input -` for standard input.
- Machine-readable JSON is written to standard output, except `render`, which writes the
  rendered text, and `decode`, which writes restored JSON text.
- A caught failure is written as one JSON object to standard error.
- File output is local. The CLI does not upload inputs, artifacts, or reports.
- JSON, task, schema, manifest, and benchmark fixture reads are capped at 5 MiB. Artifact
  reads are capped at 20 MiB. Files must be regular files and all text must be valid
  UTF-8. Standard input is bounded by the corresponding command limit.
- Output paths are resolved against the current working directory. Both the lexical path
  and real path of the existing ancestor and final parent must remain inside that
  workspace.
- Existing output files are refused unless `--force` is explicit.
- Writes use a unique sibling temporary file. No-overwrite installation uses a hard link;
  forced replacement uses rename, with backup and restoration on Windows. A failed write
  removes its temporary file when possible.
- The only bundled target is `local-o200k-base`.
- Offline benchmark commands resolve their manifest and nine curated fixture files from
  the CLI package's bundled `benchmark-fixtures` directory, including after local pack
  and installation into a clean consumer.
- No command makes a provider or Jev call.

Run help or the offline diagnostic:

```console
pnpm morph --help
pnpm morph doctor
```

## Shared compile-request options

`inspect`, `compare`, and `compile` accept these options:

| Option | Default | Meaning |
| --- | --- | --- |
| `-i, --input <path>` | required | JSON input path, or `-` for standard input. |
| `--task <text>` | `Review the complete dataset.` | Inline task instruction. |
| `--task-file <path>` | unset | Read task text from a file. When both task forms are given, the file wins. |
| `--schema <path>` | unset | Include a local JSON Schema document. External `$ref` values are rejected. |
| `--target <profile>` | `local-o200k-base` | Exact registered target profile. No aliases are guessed. |
| `--policy <policy>` | `compatibility` | `compatibility`, `economy-experimental`, or `validated`. |
| `--access-pattern <pattern>` | `unknown` | One of the documented access-pattern hints. It does not execute a task. |
| `--max-prompt-tokens <count>` | unset | Maximum complete visible rendered-text tokens. |
| `--reserved-output-tokens <count>` | unset | Reserved output tokens for a target with a verified context-window accounting rule. The local target has no context-window binding. |
| `--encoding <id>` | unset | Force one encoding family without bypassing support, policy, quality, or budget gates. |
| `--allow-experimental` | false | Overrides policy to `economy-experimental`. |
| `--allow-network` | false | Records permission for an explicitly configured adapter. No network adapter is bundled, so this alone performs no call. |

Accepted access patterns are:

```text
unknown
entity-lookup
multi-entity-comparison
aggregation
filtering
nested-path-lookup
sequence-analysis
```

An `aggregation` hint does not calculate an aggregate.

## `inspect`

Parse and profile accepted input without reporting raw example values:

```console
pnpm morph inspect --input fixtures/examples/customers.json
```

The JSON output contains:

- IR version and input kind;
- semantic digest;
- exact root, node, depth, container, and scalar totals;
- capped scalar-cardinality and repeated-scalar counts, an untracked count, and an
  explicit flag showing when those cardinality statistics are not exact;
- candidate record-array paths, field sets, observed types, missing counts, and null counts;
- a reminder that access patterns do not execute queries.

The command parses optional schema and task inputs through the shared request builder,
but it does not run schema-instance validation, enumerate codecs, or tokenize candidate
representations. Use `compare` or `compile` to exercise the full request pipeline.

## `compare`

Measure and explain all bounded candidates:

```console
pnpm morph compare \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/comparison.task.txt \
  --schema fixtures/examples/customers.schema.json \
  --policy economy-experimental \
  --report reports/comparison.json
```

Additional options:

| Option | Meaning |
| --- | --- |
| `--report <path>` | Atomically save the same JSON report printed to stdout. |
| `--force` | Permit replacing the report path. |

The command reports compact JSON even if it cannot be selected by an explicit allowlist
or forced-family request, because JSON remains the comparison baseline. Ineligible
alternatives retain their real token counts and reason codes.

`compare` sets exit code 5 when `completedSearch` is false. A completed search with no
selected plan remains inspectable through the report; use `compile` when a selected
artifact is mandatory.

## `compile`

Select one eligible representation and save its machine artifact:

```console
pnpm morph compile \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --target local-o200k-base \
  --policy compatibility \
  --output artifacts/customers.morph.json \
  --report reports/customers-explain.json
```

Additional options:

| Option | Meaning |
| --- | --- |
| `-o, --output <path>` | Required artifact path. |
| `--report <path>` | Optional explain-report path. |
| `--force` | Permit replacing existing artifact and report paths. |

Success prints a compact JSON summary containing the absolute output path, stable
artifact ID, selected encoding, selected token measurement, and
`modelQuality: "unbound"`.

Compatibility mode normally selects compact JSON because the bundled registry has no
quality profiles. To force a nonbaseline representation for local experimentation, use
the experimental policy as well as the family:

```console
pnpm morph compile \
  --input fixtures/examples/customers.json \
  --task "Review every record." \
  --allow-experimental \
  --encoding rows-delimited \
  --output artifacts/customers-rows.morph.json
```

Forcing does not make an inapplicable format legal. For example, typed rows remain
inapplicable to sparse or nested records, and TOON remains inapplicable to number lexemes
it cannot preserve.

## `render`

Render the complete `MORPH-PROMPT/1` text stored by an artifact's request frame:

```console
pnpm morph render \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.context.txt
```

Options:

| Option | Meaning |
| --- | --- |
| `-i, --input <path>` | Artifact path, or `-` for standard input. |
| `-o, --output <path>` | Optional text output. Without it, text goes to stdout. |
| `--force` | Permit replacing the output path. |

The rendered text is the same scope counted during selection. Rendering checks artifact
payload and dependency digests before returning text.

## `decode`

Restore compact valid JSON from the selected codec:

```console
pnpm morph decode \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.restored.json
```

Options match `render`. The output retains numeric lexemes. It does not promise original
source whitespace, escape spelling, or object display order.

## `verify`

Check integrity, dependency completeness, and reconstruction from the self-contained
bundle:

```console
pnpm morph verify --input artifacts/customers.morph.json
```

Output shape:

```json
{
  "valid": true,
  "checksum": "passed",
  "dependencies": "complete",
  "semanticRoundTrip": "passed",
  "errors": []
}
```

This example shows the shape, not a recorded result for a particular artifact. A failed
verification sets exit code 4.

## `bench`

Run the bundled `synthetic-v2` offline fixture manifest:

```console
pnpm morph bench --suite conformance --offline
pnpm morph bench --suite tokens --offline
pnpm morph bench --suite performance --offline
```

Options:

| Option | Meaning |
| --- | --- |
| `--suite <suite>` | Required: `conformance`, `tokens`, or `performance`. |
| `--offline` | Documents the intended offline run. All three implemented suites are offline regardless, and no remote evaluator is registered. |
| `--report <path>` | Optional JSON result manifest. |
| `--markdown <path>` | Optional short human-readable report. |
| `--force` | Permit replacing output files. |

The conformance suite directly exercises every enumerated native and TOON plan on each
manifest fixture, records supported, failed, and inapplicable outcomes, then compiles and
verifies one selected artifact end to end. It sets exit code 1 when any supported case
fails.

The token suite runs complete comparison reports under the experimental policy and emits
one row per measured candidate. It reports complete rendered-text token counts, baseline
deltas, eligibility, quality status, and median and p95 wall-clock comparison samples.
Those timings do not yet distinguish cold and warm asset loading or report peak memory.

None of these suites calls a model. Every result manifest says
`modelQuality: "not-run"`.

The performance suite uses the first manifest fixture and reports Node, platform,
architecture, input bytes, three warmup runs, 20 measured runs, a cold tokenizer-load
sample, an approximate before/after heap delta, and median and p95 measurements for
parse, profile, each applicable native codec's encode and decode, compact render, warm
tokenization, and full comparison. The heap field is not a peak-memory measurement.
TOON is included through full comparison but not the per-codec native stage loop.

The equivalent package scripts are:

```console
pnpm bench:conformance
pnpm bench:tokens
pnpm bench:performance
```

They print JSON to standard output. Redirect or use the CLI output options when a saved
report is desired. The package scripts read the source-workspace manifest, while the
`morph bench` binary reads the fixture copy shipped with `@morph/cli`. Both manifests use
`morph-benchmark-manifest/1`, fixture version `synthetic-v2`, and seed `20260921`.

The provider-neutral model-evaluation runner is an SDK API in `@morph/evaluation`. There
is no CLI command that initiates provider evaluation, accepts credentials, or performs a
live model call.

## `doctor`

Inspect the local runtime and bundled registrations without reading credentials or making
billable calls:

```console
pnpm morph doctor
```

The report includes:

- actual Node.js version and required range;
- registered native and TOON codec versions;
- local tokenizer ID, revision, a synthetic smoke count, certainty, lack of model
  binding, and observed-versus-expected expanded and bundled asset digests;
- network default;
- Jev optional and live-contract status;
- model-quality status.

A missing optional Jev integration does not make the local compiler unhealthy. Doctor
sets exit code 3 when the Node range check, tokenizer smoke count, or tokenizer asset
digest verification fails.

## Exit codes

| Code | Meaning in the implemented CLI |
| ---: | --- |
| 0 | Command completed successfully. |
| 1 | Offline conformance completed with one or more failed supported cases. |
| 2 | Invalid input or request, unsupported command configuration not covered below, output refusal, no eligible plan, or general CLI failure. |
| 3 | Encoder, target, tokenizer, or unsupported-binding failure; also an unhealthy doctor result. |
| 4 | Artifact, digest, decode, or round-trip failure. |
| 5 | Token budget, resource limit, or timeout failure; also an incomplete comparison search. |
| 6 | Integration, provider, or Jev failure. No bundled command currently performs such a call. |

The mapping uses typed MORPH error-code substrings. Commander usage errors are handled by
Commander's normal nonzero usage behavior and may not use this table's application
mapping.

## Examples with standard input

```console
Get-Content -Raw fixtures/examples/customers.json |
  pnpm morph inspect --input -

Get-Content -Raw artifacts/customers.morph.json |
  pnpm morph verify --input -
```

On shells other than PowerShell, use the shell's ordinary pipe syntax. Standard input is
consumed as UTF-8 text.
