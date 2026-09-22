# Dependencies and external references

## Runtime selection

The root manifest selects:

```text
Node.js: >=22.12.0 <25
package manager: pnpm 10.15.0
lockfile format: pnpm lockfileVersion 9.0
module format: ECMAScript modules
TypeScript target: ES2022
```

The implementation inspection environment reported Node.js `24.19.0` and pnpm
`10.15.0`. Final clean-install verification belongs in `RELEASE_REPORT.md`.

Install from the reviewed lockfile:

```console
pnpm install --frozen-lockfile
```

The root manifest and every manifest under `packages/` and `apps/` repeat the same
`>=22.12.0 <25` Node.js engine range. All workspace package manifests use exact external
versions rather than ranges.

## Production dependencies

| Package | Version | Used by | Purpose | Declared license |
| --- | ---: | --- | --- | --- |
| `@noble/hashes` | 2.4.0 | `@morph/core` | Browser-compatible SHA-256 and hex encoding | MIT |
| `ajv` | 8.20.0 | `@morph/core` | Strict local JSON Schema Draft 2020-12 compilation and instance validation | MIT |
| `js-tiktoken` | 1.0.21 | `@morph/tokenizer-adapters` | Browser-compatible third-party `o200k_base` implementation with bundled ranks | MIT |
| `@toon-format/toon` | 4.1.1 | `@morph/toon-adapter` | Official TOON encode and strict decode implementation | MIT |
| `commander` | 15.0.0 | `@morph/cli` | CLI command and option parsing | MIT |
| `react` | 19.3.0 | workbench | Local UI rendering | MIT |
| `react-dom` | 19.3.0 | workbench | Browser root and DOM rendering | MIT |

Workspace-only dependencies use `workspace:*` and resolve to the local `0.1.0` private
packages. The composed `@morph/sdk` has no new external runtime dependency. The schema
registry depends only on core and Node built-ins in its `./node` entry. The Jev adapter
uses the platform `fetch`, `AbortController`, and timer APIs and has no vendor SDK
dependency. The provider-neutral evaluation runner likewise has no provider SDK; an
application supplies a `ModelEvaluator` when it intentionally performs a live run.

License names above come from installed package metadata and are not a substitute for a
complete transitive legal review.

## Development dependencies

| Package | Version | Purpose | Declared license |
| --- | ---: | --- | --- |
| `@biomejs/biome` | 2.5.14 | Formatting and linting | MIT OR Apache-2.0 |
| `@types/node` | 24.13.6 | Node.js types | MIT |
| `@types/react` | 19.3.0 | React types | MIT |
| `@types/react-dom` | 19.3.0 | React DOM types | MIT |
| `@vitejs/plugin-react` | 6.1.1 | React integration for Vite | MIT |
| `@vitest/coverage-v8` | 5.0.1 | Optional V8 coverage output | MIT |
| `cross-env` | 10.1.0 | Portable extended-test environment setting | MIT |
| `fast-check` | 4.10.2 | Seeded property-based tests and shrinking | MIT |
| `happy-dom` | 20.14.5 | Browser-like unit-test environment dependency | MIT |
| `tiktoken` | 1.0.22 | Independent installed tokenizer cross-check in tests | MIT |
| `tsup` | 8.5.1 | ESM and declaration builds for packages | MIT |
| `tsx` | 4.23.15 | Local TypeScript CLI and benchmark execution | MIT |
| `typescript` | 5.9.3 | Strict static type checking | Apache-2.0 |
| `vite` | 8.3.0 | Workbench development and production build | MIT |
| `vitest` | 5.0.1 | Unit, integration, property, security, CLI, and workbench tests | MIT |

The root `pnpm.overrides` pins every transitive `esbuild` instance to `0.28.2`, and the
lockfile records that override. This is an audit-hardening resolution for
`GHSA-g7r4-m6w7-qqqr`. The pin itself is not a clean-audit claim. Final audit, build, and
package-smoke outcomes remain pending in `RELEASE_REPORT.md`.

The build permits install scripts only for `esbuild` and `tiktoken` through
`onlyBuiltDependencies`.

## Package contents and clean-consumer smoke

The package smoke script is configured to pack these nine private Node packages into
local tarballs:

```text
@morph/core
@morph/encoders
@morph/tokenizer-adapters
@morph/toon-adapter
@morph/evaluation
@morph/schema-registry
@morph/jev-planner
@morph/cli
@morph/sdk
```

It installs all nine into a temporary offline consumer, runs the installed CLI doctor
and conformance commands, compiles and decodes through `@morph/sdk`, exercises the
in-memory schema registry, and confirms the disabled Jev classifier does not make a
network call. The CLI package `files` list includes `dist` and `benchmark-fixtures`, so
the installed conformance command uses packaged fixtures rather than repository-relative
paths. This describes the smoke script's coverage. Its final executed outcome is a
pending release-report field.

## Tokenizer identity and status

The bundled adapter is intentionally explicit:

```text
profile ID: local-o200k-base
tokenizer ID: o200k_base
implementation: js-tiktoken 1.0.21, third-party TypeScript port
normalization: none
special tokens: treated as ordinary text
network required at runtime: false
model binding: none
```

The revision is:

```text
js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d
```

Recorded digests:

| Scope | SHA-256 |
| --- | --- |
| Expanded `o200k_base.tiktoken` vocabulary asset | `446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d` |
| MORPH canonical form of bundled ranks, pattern, and special-token map | `61b17bd0591944b89b499a90a28bae236cd8dbb33932fb92125b9c6de5510479` |

The source tests compare selected token IDs with the installed `tiktoken` 1.0.22 package
and verify both digests. `morph doctor` independently recomputes and displays the expanded
asset and bundled canonical-form digests before reporting the tokenizer healthy.

Official Python `tiktoken` 0.14.0 was installed only in the implementation environment as
a development oracle. Its `encode_ordinary` output matched all seven committed cases in
`fixtures/tokenizer/o200k-base-v1.json`, with zero mismatches. Python is not listed in the
pnpm lockfile and is not a runtime, browser, SDK, CLI, or ordinary CI dependency. Neither
cross-check is a provider-reported request count. The implementation therefore claims
only exact visible-text counts for its named local tokenizer revision.

The reproducibility helper is stdout-only:

```console
python scripts/generate-tokenizer-fixture.py
```

Run it in an isolated development environment containing exactly
`tiktoken==0.14.0`, capture the output to an ignored temporary file, and compare it with
the committed fixture. The script does not install Python packages or modify the fixture
in place.

## TOON identity and status

MORPH imports the official package:

```text
package: @toon-format/toon
package version: 4.1.1
adapter format version: 4.1.1
indent size: 2
candidate delimiters: comma, tab, pipe
strict decode: true
```

The adapter gates numeric lexemes before conversion to JavaScript values, performs an
official encode/decode round trip, checks MORPH semantic equality, and requires canonical
re-encoding on decode. It does not claim support for every value accepted by upstream
TOON.

## Schema validator status

Ajv 8.20 is configured through its Draft 2020-12 entry with:

```text
allErrors: true
strict: true
validateFormats: false
removeAdditional: false
useDefaults: false
coerceTypes: false
```

Remote `$ref` resolution is blocked before compilation and no schemas are added to Ajv's
registry. Explicit non-2020-12 dialects are rejected. A conservative guard returns
`SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` for nonfinite host conversions, and for
noncanonical or unsafe instance numbers when the schema contains numeric comparison,
numeric equality, or `uniqueItems: true` checks.

## Optional Jev integration status

The optional package implements the documented HTTP contract directly rather than adding
an SDK dependency:

```text
endpoint: POST https://api.typesafe.ai/v1/systemone
default requested model: jev-latest
default timeout: 5,000 ms
default abstention threshold: 0.75
default maximum task bytes: 64 KiB
default maximum response bytes: 256 KiB
offline fixtures: synthetic
live contract test: not-run
```

The movable default alias is not evidence of a resolved service version. A successful
future call must record the response model. No credential or live response was available
as implementation evidence, and Jev is not imported by core. The classifier reads the
response stream under the configured byte cap before JSON parsing.

## Primary standards and product references

`REFERENCES.md` records all access dates as 2026-09-21 and explains how each source
supports the specification. The primary links are:

1. JSON grammar and data model: [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html)
2. JSON Pointer: [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901.html)
3. TOON: [API reference](https://toonformat.dev/reference/api),
   [specification](https://github.com/toon-format/spec), and
   [official implementation](https://github.com/toon-format/toon)
4. Provider prompt-caching example:
   [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
5. Tokenizer reference: [openai/tiktoken](https://github.com/openai/tiktoken) and
   [token-counting scope](https://developers.openai.com/api/docs/guides/token-counting)
6. TypeSafe Jev primitives: [TypeSafe primitives](https://docs.typesafe.ai/primitives)
7. TypeSafe HTTP contract: [TypeSafe API](https://docs.typesafe.ai/api)
8. TypeSafe confidence semantics: [TypeSafe confidence](https://docs.typesafe.ai/confidence)
9. Schema dialect: [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
10. Property testing: [fast-check documentation](https://fast-check.dev/)

These sources support implementation choices. They do not establish MORPH token savings,
model accuracy, provider availability, a successful Jev call, or a released product.

## Publication and license status

All root and workspace package manifests have `private: true`. No package has been
published. The repository does not select an owner license merely by depending on
open-source packages. Public licensing, a complete transitive notice review, package
publication, and public repository visibility each require separate owner action.

Final audit, vulnerability, license, and software-bill-of-materials results are recorded
in `RELEASE_REPORT.md`. Do not infer a future clean result from this inventory alone.
