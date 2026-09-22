# MORPH

MORPH, Model Optimized Representation for Prompt Handoffs, is a local compiler for
structured model context. It accepts JSON-compatible data, an optional schema, a task,
a tokenizer target, and constraints. It compares reversible physical layouts, measures
the complete rendered text with the selected tokenizer, applies policy and budget gates,
and returns a self-contained artifact with an explain report.

MORPH does not project fields, filter rows, calculate answers, summarize data, or claim
that a smaller representation is easier for a model to understand. Preservation,
token measurement, and model-task quality are separate outcomes.

## Status

This repository is an implementation candidate for specification version 0.1.0. The
source currently contains the local SDK, five native codecs, an optional official TOON
adapter, an offline tokenizer profile, a CLI, an offline evaluation harness, and a local
browser workbench. Final release verification is recorded in
[`RELEASE_REPORT.md`](RELEASE_REPORT.md). Do not infer a passing release, model-quality
result, or published package from source presence alone.

| Area | Status | Meaning |
| --- | --- | --- |
| Strict JSON and JavaScript-value IR | Implemented | Duplicate JSON keys and unsupported JavaScript values are rejected. JSON number lexemes are retained. |
| Five native codecs | Implemented | Compact JSON, MORPH-framed JSON Lines, typed delimited rows, columns JSON, and typed path/value are registered. |
| Official TOON adapter | Implemented, optional | Uses `@toon-format/toon` 4.1.1 and rejects inputs whose numeric spelling or value cannot meet MORPH equality. |
| `local-o200k-base` tokenizer profile | Implemented | Counts complete visible text with bundled `js-tiktoken` ranks. It has no provider or model binding. |
| Compatibility planner | Implemented | Compact JSON remains the default without applicable quality evidence. |
| Economy planner | Experimental | May select a smaller verified representation. This does not establish model comprehension. |
| Validated nonbaseline selection | Gate implemented, no bundled evidence | Declared identity, confidence-bound, case-count, dataset-count, task-family, and expiry checks exist. No quality profile or live model result ships with the repository. |
| Offline codec and token suites | Implemented | Final run results are pending in the release report. |
| Composed SDK package | Implemented | `@morph/sdk` re-exports the local modules and provides `createDefaultMorph()`. |
| Compact JSON source map | Implemented | Maps JSON Pointers to UTF-16 key and value spans in compact JSON output. |
| Project website and browser workbench | Implemented | A technical project dossier surrounds the real local compiler. It runs native codecs, gated TOON, and the tokenizer in a worker, and can strictly import, verify, render, and decode a saved artifact without uploading it. |
| Model evaluation | Bounded provider-neutral runner implemented | Builds matched compact-JSON and candidate trials, randomizes them by seed, and enforces request, concurrency, retry, timeout, output, and call-or-priced-cost limits. No provider adapter, quality profile, or Layer C run is bundled. |
| Schema registry | Implemented optional extension | Includes bounded in-memory and local-filesystem stores, content-addressed bundles, reference creation, and hydration back to self-contained artifacts. |
| Jev planner | Implemented optional adapter, live test not run | Provides bounded access-pattern classification and deterministic fallback. It is not wired into core selection and is not evidence of model quality. |
| Private project website | Deployed | The technical dossier and real browser compiler are available at the owner-only URL below. This is not a public demo. |
| Package and public release | Not published | Workspace packages and the GitHub repository remain private. Public release requires separate owner authorization. |

## Requirements

- Node.js `>=22.12.0 <25`
- pnpm `10.15.0`, locked by the root `packageManager` field
- No account, API key, hosted database, or network connection at runtime after the
  dependencies are installed

The root and every workspace package manifest declare the same Node.js range.

Install exactly from the lockfile:

```console
pnpm install --frozen-lockfile
```

## First local run

Inspect the bundled synthetic customer fixture:

```console
pnpm morph inspect --input fixtures/examples/customers.json
```

Compare complete candidate prompts with the experimental token objective:

```console
pnpm morph compare \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --schema fixtures/examples/customers.schema.json \
  --target local-o200k-base \
  --policy economy-experimental \
  --report reports/customers-comparison.json
```

Compile with the compatibility policy, then render, verify, and restore:

```console
pnpm morph compile \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --schema fixtures/examples/customers.schema.json \
  --target local-o200k-base \
  --policy compatibility \
  --output artifacts/customers.morph.json \
  --report reports/customers-explain.json

pnpm morph render \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.context.txt

pnpm morph verify --input artifacts/customers.morph.json

pnpm morph decode \
  --input artifacts/customers.morph.json \
  --output artifacts/customers.restored.json
```

Output files are not overwritten unless `--force` is supplied. Output paths are
restricted to the current workspace by lexical and resolved-parent checks. Use
`--input -` to read JSON or an artifact from standard input where the command documents
that option.

## Project website and browser workbench

Private hosted site: <https://morph-context-compiler.goeyy.chatgpt.site>

The hosted audience is owner-only. The compiler itself still performs no provider call,
upload, analytics, or browser persistence.

Start the local Vite server:

```console
pnpm workbench
```

Open the printed loopback URL. The site documents the use case, preservation contract,
compiler pipeline, representation families, policy model, release evidence, trust
boundaries, and canonical repository references. The embedded workbench includes
synthetic uniform, nested,
sparse, repeated-string, multilingual, and tiny examples. It compiles in a worker,
rejects stale worker results, supports cancellation, and can download the context,
artifact, explain report, and restored JSON. A user can import a local artifact of up to
20 MiB; the worker applies the strict artifact parser, verification, rendering, and
decoding paths before displaying it. The file remains local. The workbench does not use
analytics, browser storage, remote fonts, or model calls.

See [the website implementation notes](docs/website.md) for its information architecture,
claim sources, asset provenance, and deployment boundary.

## Offline verification commands

```console
pnpm lint
pnpm typecheck
pnpm test
pnpm test:extended
pnpm build
pnpm bench:conformance
pnpm bench:tokens
pnpm bench:performance
pnpm smoke:package
pnpm morph doctor
```

The token suite reports tokenizer-specific counts for the complete
`MORPH-PROMPT/1` text. It does not report provider billing tokens or model accuracy.
The conformance suite reports codec outcomes. The extended property command supplies a
5,000-round-trip test budget. The current test allocation derives 2,500 general JSON
inputs and 625 uniform-table inputs from that budget, then exercises every applicable
codec plan for each generated input.
The installed CLI package carries the versioned synthetic benchmark manifest and its
nine fixture files, so its offline `bench` commands do not depend on a source-workspace
fixture path. The package smoke command is configured to pack all nine Node packages,
including the optional schema-registry and Jev packages, before exercising a clean local
consumer. Its final result belongs in the release report.
See the final release report for commands actually run and their real outcomes.

## Supported representations

| Encoding | Applies to | Preservation notes |
| --- | --- | --- |
| `json-compact@1` | Every accepted IR | Strict compact JSON and the primary baseline. |
| `json-lines@1` | Root arrays | One complete JSON value per physical LF-delimited line, with an explicit element count. |
| `rows-delimited@1` | Nonempty uniform arrays of primitive-only objects | Field names are declared once. Every cell is one JSON scalar token. Tab, comma, pipe, and semicolon plans are bounded alternatives. |
| `columns-json@1` | Nonempty uniform arrays of primitive-only objects | One JSON array per field. Row index alignment and source row order are retained. |
| `path-value@1` | Every accepted IR | Typed JSON Lines records use RFC 6901 pointers and emit empty containers explicitly. |
| `toon@4.1.1` | Inputs proven safe for the official adapter | Three official delimiter plans with indent size 2. Noncanonical, negative-zero, and precision-unsafe number lexemes are inapplicable. |

All selected candidates are decoded twice: directly from their encoded section and
again after parsing the self-contained model bundle. Both results must match the input
semantic digest.

When a Draft 2020-12 schema is supplied, MORPH validates the accepted IR without
coercion, defaults, property removal, format fetching, or data mutation. Remote schema
references and other dialects are rejected. If exact numeric schema keywords meet a
precision-sensitive raw number lexeme, compilation fails with
`SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` rather than rounding.

## What a token count means

The bundled profile is:

```text
profile: local-o200k-base
tokenizer: o200k_base
revision: js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d
scope: complete visible MORPH-PROMPT/1 rendered text
certainty: exact-for-tokenizer
model binding: none
```

The measurement includes caller prefix and suffix, the compiler guide, layout
metadata, included schema, payload, task text, and prompt framing. It excludes provider
message framing, hidden instructions, tool schemas, images, outputs, and billing rules.

The seven committed tokenizer fixture cases were verified against official Python
`tiktoken` 0.14.0 `encode_ordinary` with zero mismatches. Python was used only as a
development oracle and is not a runtime dependency.

## Design boundaries

- Re-encoding is not projection. Every accepted row and field remains present.
- Task and access-pattern fields are hints. MORPH does not execute the requested task.
- A checksum detects mismatches. It is not authentication or proof that content is safe.
- Encoding does not neutralize prompt injection in data or schema descriptions.
- A tokenizer profile is not a model profile unless an explicit verified binding says so.
- No quality percentage is produced without recorded evaluation evidence.
- Provider caching, local plan caching, schema lookup, and prompt size are separate concerns.
- `estimated-request-cost` is not available without a versioned pricing and request-accounting profile.

## Documentation

- [Architecture](docs/architecture.md)
- [Artifact, framing, and codec formats](docs/format.md)
- [Semantic contract](docs/semantics.md)
- [SDK API](docs/api.md)
- [CLI](docs/cli.md)
- [Benchmarking and evidence](docs/benchmarking.md)
- [Security and privacy](docs/security.md)
- [Dependencies](docs/dependencies.md)
- [Release process](docs/release.md)
- [Project website](docs/website.md)
- [Current release report](RELEASE_REPORT.md)
- [Product specification](SPEC.md)
- [Primary references](REFERENCES.md)

## Publication state

Every workspace package is marked `private`. No npm publication, GitHub release, public
repository, or public website is authorized by this README. The private site does not
change those publication boundaries. Verified remote state belongs in
`RELEASE_REPORT.md`.
