# MORPH primary references

This file maps references R1 through R10 used by `SPEC.md` to primary sources. All sources were accessed on 2026-09-21. Versioned implementation dependencies must still be pinned in the lockfile and recorded separately in `docs/dependencies.md` once selected.

These references support standards and implementation decisions. They do not establish MORPH benchmark results, downstream model quality, provider availability, or a successful live integration.

## R1. JSON data model, grammar, interoperability, and limits

- Primary source: [RFC 8259, The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259.html)
- Status source: [RFC Editor record for RFC 8259](https://www.rfc-editor.org/info/rfc8259)
- Accessed: 2026-09-21

RFC 8259 defines the JSON value types, object and array syntax, number grammar, string escaping, and UTF-8 interoperability requirements. It states that arrays are ordered and describes objects as unordered collections. Object member names should be unique. When names are duplicated, receiving implementations differ: some keep the last pair, some reject the object, and some expose all pairs. This supports MORPH rejecting duplicate names before a conventional map can overwrite one.

The RFC permits implementations to limit numeric range and precision, and identifies the binary64 exact-integer interoperability range. JSON itself permits lexically distinct number tokens such as `-0`, `1.2300`, and exponent forms. MORPH therefore preserves a grammar-validated numeric lexeme for JSON-text input instead of routing it through a JavaScript `number`.

The RFC also permits parsers to impose size, depth, numeric, and string limits. That supports explicit bounded failures in MORPH. RFC 8259 allows some escaped bit sequences that do not encode Unicode scalar values and warns that their handling is unpredictable. MORPH deliberately adopts the narrower policy described in `SPEC.md`: reject lone surrogates rather than silently rewrite them.

## R2. JSON Pointer

- Primary source: [RFC 6901, JavaScript Object Notation (JSON) Pointer](https://www.rfc-editor.org/rfc/rfc6901.html)
- Status source: [RFC Editor record for RFC 6901](https://www.rfc-editor.org/info/rfc6901)
- Accessed: 2026-09-21

RFC 6901 defines JSON Pointer's empty string as a pointer to the whole document. Non-root pointers contain slash-prefixed reference tokens. Within a token, `~` is encoded as `~0` and `/` as `~1`. Decoding must replace `~1` before `~0`, which avoids mis-decoding a token such as `~01`.

The RFC distinguishes object member lookup from array-index lookup based on the referenced container. This supports MORPH's parent-container records for distinguishing an object key named `"0"` from array index zero. MORPH does not use the special `-` array token in its path/value payload because every emitted record must identify an existing, reconstructable node.

RFC 6901 also warns against evaluating pointer text as code. MORPH treats pointer tokens only as data and never maps them to filesystem traversal or JavaScript prototype traversal.

## R3. Official TOON specification and TypeScript implementation

- Primary source: [TOON TypeScript and JavaScript API reference](https://toonformat.dev/reference/api)
- Normative format source: [TOON specification repository](https://github.com/toon-format/spec)
- Official conformance fixtures: [toon-format/spec tests](https://github.com/toon-format/spec/tree/main/tests)
- Reference implementation: [toon-format/toon](https://github.com/toon-format/toon)
- Pinned package manifest: [`@toon-format/toon` 4.1.1](https://github.com/toon-format/toon/blob/v4.1.1/packages/toon/package.json)
- Registry record: [`@toon-format/toon` on npm](https://www.npmjs.com/package/@toon-format/toon)
- Accessed: 2026-09-21
- Version observed: package `4.1.1`; TOON specification Working Draft `4.1`, dated 2026-07-26

The official package exports `encode(input, options?)` and `decode(input, options?)`, plus line and streaming variants. The documented encoder options include `indentSize`, a comma, tab, or pipe `delimiter`, and a `replacer`. The documented decoder options include `indentSize` and strict validation, enabled by default. MORPH must pin the package and format versions and run its own conformance fixtures instead of relying on the package name alone.

The official implementation's host-value normalization is broader than MORPH's accepted JavaScript-value subset. It may call `toJSON`, normalize `undefined` and nonfinite numbers, transform `Map`, `Set`, `Date`, and `BigInt`, and allow a replacer to omit or transform data. MORPH must not expose those behaviors through its lossless adapter.

There is also a direct numeric incompatibility with MORPH's JSON-text equality rule. The documented encoder canonicalizes numeric spelling, including `-0` to `0`, and the decoder returns JavaScript numbers with IEEE 754 precision behavior. The TOON specification compares numbers after numeric normalization, while MORPH requires identical number lexemes for JSON-text inputs. The adapter must therefore report `ENCODER_NOT_APPLICABLE` unless the exact input can be proven to survive the official implementation under MORPH equality. It must never claim universal TOON support by silently weakening equality.

## R4. Provider prompt caching

- Primary source: [OpenAI API prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching)
- Accessed: 2026-09-21

This is a provider-specific example, not a universal cache contract. The guide explains that cache reuse applies to matching rendered prompt prefixes and that the complete rendered context can include provider instructions, developer messages, tool definitions, schemas, and conversation content. A session or shared application cache key alone does not guarantee a hit.

The provider reports cached usage as part of input-token usage. Pricing, retention, minimum cacheable length, supported models, breakpoints, and data-retention behavior are provider and model dependent. MORPH should record reported usage and the actual request configuration, keep fresh-request and reuse experiments separate, and never treat a cache discount as permission to omit data that the model has not retained through a verified runtime contract.

This reference does not establish that another provider behaves the same way. Provider integrations must consult and record that provider's current documentation.

## R5. OpenAI tiktoken

- Primary source: [openai/tiktoken](https://github.com/openai/tiktoken)
- Release source: [openai/tiktoken releases](https://github.com/openai/tiktoken/releases)
- Package source: [tiktoken on PyPI](https://pypi.org/project/tiktoken/)
- Pinned vocabulary definitions: [tiktoken 0.14.0 `openai_public.py`](https://github.com/openai/tiktoken/blob/0.14.0/tiktoken_ext/openai_public.py)
- Pinned tokenizer API: [tiktoken 0.14.0 `core.py`](https://github.com/openai/tiktoken/blob/0.14.0/tiktoken/core.py)
- Port status: [OpenAI statement about third-party language ports](https://github.com/openai/tiktoken/issues/97)
- Request-counting scope: [OpenAI API token-counting guide](https://developers.openai.com/api/docs/guides/token-counting)
- Accessed: 2026-09-21
- Version observed: official tiktoken release `0.14.0`

The official project documents `get_encoding(...)`, including `o200k_base`, and `encoding_for_model(...)` for verified model mappings. It describes byte-pair encoding as reversible over text and includes authoritative vocabulary construction and tests suitable for generating cross-language fixtures. In the pinned 0.14.0 definitions, the expected SHA-256 digest for the official `o200k_base.tiktoken` asset is `446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d`.

The official OpenAI project is a Python package with a Rust core. It is not an official TypeScript or browser runtime package. OpenAI identifies the listed language ports as third-party implementations and warns that behavioral mismatches can occur. Any JavaScript or WebAssembly implementation used by MORPH must be labeled as a third-party port and checked against fixtures produced by the pinned official implementation. A convenient model alias must not replace an explicit tokenizer identifier and revision.

The pinned API distinguishes ordinary text encoding from special-token handling. MORPH should treat special-token-looking user content as ordinary text, pin that policy in its tokenizer profile, and include it in conformance fixtures. The vocabulary asset must be bundled or otherwise installed locally before offline use. A first-use network download is not an offline runtime.

The tiktoken README mentions an average relationship between tokens and bytes only as an explanatory approximation. MORPH must not use that average, or a characters-divided-by-four estimate, as an exact tokenizer result.

## R6. TypeSafe Jev primitives

- Primary source: [TypeSafe AI primitives documentation](https://docs.typesafe.ai/primitives)
- Supporting source: [TypeSafe AI introduction](https://docs.typesafe.ai/introduction)
- Accessed: 2026-09-21
- Documentation availability: verified reachable on the access date

TypeSafe documents a request as typed questions evaluated against shared `state`. The three documented question types are Choice, Score, and Noul. Choice selects from a caller-supplied set and returns `choice`, per-option `probabilities`, and `confidence`. Score returns a position over an ordered rubric, a legend, probabilities, and confidence. Noul returns a value from zero to one for a yes-or-no judgment and has no separate confidence field.

The documentation recommends small, focused judgments and composition in application code. This supports MORPH limiting an optional Jev adapter to access-pattern classification or bounded planning hints, rather than delegating codec correctness, token measurement, eligibility, or quality certification.

## R7. TypeSafe Jev HTTP contract

- Primary source: [TypeSafe AI HTTP API reference](https://docs.typesafe.ai/api)
- Quick-start source: [TypeSafe AI quick start](https://docs.typesafe.ai/introduction/quickstart)
- SDK index: [TypeSafe AI client SDKs](https://docs.typesafe.ai/sdk)
- Model list: [TypeSafe AI models](https://docs.typesafe.ai/models)
- JavaScript SDK: [TypeSafe AI JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- Pinned JavaScript SDK source: [`@typesafe-ai/sdk` 0.6.0](https://github.com/typesafe-ai/typesafe-sdk-js/tree/v0.6.0)
- Accessed: 2026-09-21
- Documentation availability: verified reachable on the access date
- Versions observed: `@typesafe-ai/sdk` `0.6.0`; Jev resolved version `jev-1.13.0`

The documented endpoint is `POST https://api.typesafe.ai/v1/systemone` with bearer authentication and a JSON body containing `state`, `model`, and a map of `questions`. Responses contain the resolved `model`, typed answers keyed by the caller's question IDs, and input and output token usage. The API reference documents validation and service error classes including HTTP 401, 422, 429, and 529. The observed aliases `jev-latest` and `jev-preview` are movable. Reproducible evidence must record the response model and should use a pinned version when the service permits it.

This source is enough to design a separately packaged adapter and offline contract fixtures. It does not prove that credentials are available, a given model alias is currently authorized, or MORPH has successfully called the service. Until an authorized bounded contract test is actually run, repository status must say the Jev live test is `not-run`, not `passed`.

The official quick start also links optional agent tooling. MORPH's specification explicitly does not authorize installing global plugins or running remote installation scripts merely because documentation suggests them.

## R8. TypeSafe confidence semantics

- Primary source: [TypeSafe AI confidence documentation](https://docs.typesafe.ai/confidence)
- Supporting source: [TypeSafe AI Choice documentation](https://docs.typesafe.ai/primitives/choice)
- Accessed: 2026-09-21
- Documentation availability: verified reachable on the access date

TypeSafe states that Choice and Score confidence is a statistic computed from the returned probability distribution. A concentrated distribution produces higher confidence and a flatter distribution produces lower confidence. The full probabilities are returned so applications can use a different uncertainty measure when appropriate. Noul does not carry the separate confidence field.

The documentation says action thresholds depend on domain risk and should be tested with the application's own data. For MORPH, Jev confidence is therefore planner-hint uncertainty only. It is not a measured probability that a representation preserves downstream task accuracy, and it must never be copied into `QualityEvidence` as accuracy.

## R9. JSON Schema Draft 2020-12

- Primary index: [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- Core specification: [JSON Schema Core, Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core)
- Validation specification: [JSON Schema Validation, Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation)
- Canonical meta-schema URI: [Draft 2020-12 meta-schema](https://json-schema.org/draft/2020-12/schema)
- Accessed: 2026-09-21

Draft 2020-12 defines the schema dialect, vocabularies, references, bundling, validation assertions, and annotations MORPH uses for caller-supplied schema. Schemas identify this dialect with `$schema: "https://json-schema.org/draft/2020-12/schema"`. Its instance model treats objects as unordered property sets, arrays as ordered lists, and numbers as arbitrary-precision base-10 values. Numeric lexical spelling is outside JSON Schema's data model.

That distinction matters for implementation. A validator operating only on JavaScript numbers cannot automatically perform exact bounds or `multipleOf` validation over every MORPH number lexeme. MORPH must either use an exact numeric path for relevant keywords or return the specified unsupported-validation result. It must not round first and call the result exact.

The core specification describes referenced-schema loading and compound documents, but it does not require MORPH to fetch arbitrary network locations. MORPH's secure default remains bundled schemas and explicitly registered local resolvers, with network resolution disabled.

## R10. Property-based testing with fast-check

- Primary source: [fast-check documentation](https://fast-check.dev/)
- Concepts: [What is Property-Based Testing?](https://fast-check.dev/docs/introduction/what-is-property-based-testing/)
- API structure: [fast-check core blocks](https://fast-check.dev/docs/core-blocks/)
- Runner API: [fast-check runners](https://fast-check.dev/docs/core-blocks/runners/)
- Execution parameters: [fast-check `Parameters`](https://fast-check.dev/docs/api/interfaces/Parameters/)
- Project source: [dubzzz/fast-check](https://github.com/dubzzz/fast-check)
- Registry record: [`fast-check` on npm](https://www.npmjs.com/package/fast-check)
- Accessed: 2026-09-21
- Version observed: package `4.10.2`

fast-check combines arbitraries, properties, and runners. Arbitraries pair generation with shrinking, properties state invariants, and runners control execution details such as run count and seed. The central APIs are `fc.property(...)` or `fc.asyncProperty(...)`, executed with `fc.assert(...)`; `fc.check(...)` returns structured run details instead of throwing. Failure reports include reproducible seed and path data and a shrunk counterexample.

This supports seeded codec round-trip tests and retention of minimized failing cases. The documented default is 100 runs, so MORPH's extended 5,000-case target must set `numRuns` explicitly and record the seed. Generic JSON-value generators are not enough for duplicate-key text, malformed syntax, raw numeric lexemes, or lone-surrogate cases. Those require dedicated generators and explicit fixtures. Property tests complement explicit conformance and adversarial fixtures. A finite number of generated cases is evidence from sampled executions, not a mathematical proof of correctness.

## Verification status

All ten primary reference groups above were reachable and checked on 2026-09-21. In particular, the official TypeSafe pages for primitives, the HTTP API, and confidence were available and verifiable. No authenticated TypeSafe request was made while preparing this file, so Jev service access and the live adapter contract remain unexercised.

If any external documentation becomes unavailable, implementation must rely on a pinned, reviewed snapshot or pause that optional integration. It must not reconstruct an API from third-party summaries or guesses.
