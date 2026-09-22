# Security and privacy

MORPH changes representation. It is not a prompt-injection filter, data-loss prevention
system, signature scheme, provider sandbox, or authorization layer.

## Trust boundaries

| Input | Trust treatment |
| --- | --- |
| JSON text | Untrusted data parsed by the bounded dedicated parser. Recommended entry point for hostile input. |
| JavaScript value | Caller-owned object graph within the documented subset. Arbitrary proxies are outside this trust boundary. |
| Schema | Untrusted data. Sanitized, locally validated, included in the bundle, and never promoted to a compiler instruction. |
| Dataset keys and values | Untrusted data even when they look like instructions, HTML, paths, shell text, or prototype names. |
| Task, prefix, and suffix | Caller-controlled prompt assembly. Core does not change provider roles or claim these strings are safe. |
| Interpretation guide | Compiler-owned versioned text selected by a registered encoder. Dataset values are not interpolated into the guide. |
| Imported artifact or registry bundle | Untrusted serialized data that must pass version, bounds, field, digest, and decoder checks. |
| Optional Jev response | Untrusted remote data validated for required bounded fields and an exact choice set. It cannot authorize a codec. |
| Caller-supplied model evaluator | Optional network-capable application code that receives complete rendered contexts. It is outside core and must enforce provider authorization, transport security, and disclosure policy. |
| Model-evaluator response | Untrusted provider data normalized before accounting. Reported usage and model identity are evidence fields, not authority to qualify an encoding. |

## Prompt injection

Encoding does not neutralize prompt injection. A value such as `"Ignore previous
instructions"` remains instruction-shaped text in JSON, a row cell, a column, TOON, or a
path/value record.

MORPH's framing separates compiler guide, metadata, schema, payload, and task for parsing
and reproducible counting. Marker collision checks prevent ambiguous emitted delimiters.
They do not make the enclosed text trustworthy. Provider integrations must still assign
roles carefully, apply least-privilege tools, and validate outputs independently.

Core never promotes dataset content, schema descriptions, or tool output into a
system/developer role. It also does not rewrite native provider tool or output schemas.

## Strict input handling

The JSON-text parser:

- enforces byte, depth, and node limits during parsing;
- detects duplicate keys before overwrite;
- preserves number lexemes rather than evaluating them;
- rejects lone surrogates and invalid JSON;
- never executes values or treats JSON Pointer segments as code or filesystem paths.

The JavaScript-value adapter reads own property descriptors. It rejects accessors,
non-enumerable object fields, cycles, sparse arrays, unsupported prototypes, custom array
properties, symbols, functions, undefined, `BigInt`, and nonfinite numbers. It does not
call `toJSON`. A malicious proxy can intercept reflection operations and is therefore
outside the supported untrusted boundary.

Safe reconstruction uses maps, null-prototype objects, or explicit property definition.
Keys named `__proto__`, `constructor`, `prototype`, empty strings, slashes, tildes, and
numeric-looking strings remain data and do not alter prototypes.

## Schema validation

Schemas are sanitized through the same JavaScript-value safety path. Only an object or
boolean schema is accepted. An explicit `$schema` value must be Draft 2020-12. Nonlocal
`$ref` values are rejected; core never resolves a URL.

Ajv 8.20 runs with strict compilation, all-errors reporting, no type coercion, no default
insertion, no property removal, and format validation disabled. Validation errors expose
paths, keywords, and messages, capped at 20 entries, rather than input values.

Ajv operates on JavaScript values. MORPH therefore applies a conservative global guard
before validation. A nonfinite host conversion is unsupported with any supplied schema.
Numeric comparison or equality-sensitive keywords, including `uniqueItems: true`, are
unsupported when the instance contains a number that is not a canonical safe integer
under host conversion. MORPH returns `SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` rather than
round a large or lexically distinct number and report exact validation.

## Codec and artifact validation

Every selected candidate must pass direct decoding and reconstruction from the parsed
self-contained bundle. Native decoders reject unknown metadata keys, invalid counts,
duplicate declarations, malformed scalars, unsafe allocations, and shape-specific
inconsistencies. TOON requires strict official decoding and canonical re-encoding.

Artifacts carry SHA-256 digests for payload and model dependencies plus a deterministic
artifact identity that binds plan, section metadata, dependencies, target, and request
frame. Verification recomputes all three and checks plan, section, and guide bindings.
The decoded semantic digest must equal the input semantic digest. These hashes detect
mismatch but do not authenticate an origin. Anyone who can replace an artifact can
recompute unkeyed hashes.

Unknown artifact and context versions, unregistered encoders, non-self-contained default
artifacts, malformed markers, and digest mismatches fail closed. Model-context parsing has
a 16 MiB allocation cap.

Unexpected applicable-encoder failures are fatal by default. Explicit
`encoderFailureMode: "quarantine"` converts a failing candidate into an explained
rejection and continues, but it cannot excuse a failed baseline or bypass integrity,
budget, tokenizer, or quality gates. Quarantine state is not retained across compiler
instances.

The schema-registry extension can create a reference artifact that intentionally omits
model dependencies. Such a reference is not directly model-ready. `hydrateArtifact`
must resolve the exact content-addressed bundle, verify its digest against the artifact,
rebuild `dependencyMode: "self-contained"`, parse the result as a normal artifact, and
pass integrity verification before rendering.

## Resource limits

Core defaults are:

```text
input bytes: 5 MiB
depth: 64
nodes: 250,000
candidates: 24
rendered bytes per candidate: 16 MiB
planning abort limit: 5,000 ms
network permission: false
```

Codec decoders independently cap payload bytes, depth, nodes, row and column allocation,
array lengths, and path records. Candidate enumeration uses fixed bounded option sets.
Planning checks its deadline and optional constructor `AbortSignal` at cooperative
checkpoints between pipeline stages and candidate operations. These checks cannot
interrupt a single synchronous codec or tokenizer operation.

The browser provides a harder local cancellation boundary by terminating its worker.
Canceled work returns no partial successful artifact.

The optional model-evaluation runner separately requires bounded request count,
concurrency, retries, output tokens, and timeout. It also requires exactly one of an
approved call cap or a cost cap with a versioned pricing profile. These controls bound
the runner's scheduling. A caller-supplied evaluator must honor the abort signal to stop
its underlying transport promptly.

## Network policy

Core, native codecs, tokenizer, TOON adapter, CLI local commands, offline suites, and the
workbench compiler make no application-level network calls. The tokenizer ranks are
bundled and need no first-use download. There is no telemetry or automatic upload.

`allowNetwork: true` grants no capability by itself. Network-capable code lives in the
optional Jev package and is not imported or initialized by core.

The Jev HTTP classifier requires all of these before a call:

- classifier construction with a nonempty API key;
- `allowNetwork: true` on the classification request;
- `allowRemoteTaskDisclosure: true`;
- a valid bounded task and optional coarse shape object.

It sends the task text and permitted coarse shape statistics to
`https://api.typesafe.ai/v1/systemone`. It does not send raw dataset values by default.
Task text itself can be private, which is why disclosure permission is separate.

The adapter sets a timeout, supports external cancellation, disables redirects,
credentials, cache, and referrer, and validates exact option keys, finite probabilities,
probability sum, winning choice, confidence, model string, and token usage. The task body
defaults to a 64 KiB cap. The response stream defaults to a 256 KiB cap and is fully read
under that bound before JSON parsing. The adapter performs no automatic retry. Failures
return deterministic `unknown` fallback results.

Credentials must be supplied by an explicit server-side or local integration. Do not put
them in browser bundles, committed files, snapshots, URLs, command-line arguments, or
logs. The repository has not run a live Jev contract test.

Jev is a hint only. Its confidence is not model-task accuracy and cannot make an
ineligible plan eligible.

## Provider-neutral model evaluation

The evaluation runner makes no call unless an application supplies a `ModelEvaluator`.
The repository contains no provider adapter and the CLI and workbench expose no live
evaluation command. A supplied evaluator receives the complete rendered model context,
which can include the dataset, schema, task, prefix, and suffix. Supplying one is an
explicit remote-disclosure integration decision.

The runner validates its controls, randomizes matched trials from a fixed seed, claims
request or cost budget before each attempt, limits concurrency, and retries only a
response explicitly marked retryable. Cost mode conservatively reserves maximum declared
input overhead and output tokens before dispatch. Provider-reported usage is accepted
only when its token fields are nonnegative safe integers.

Failures, refusals, truncations, invalid outputs, and retries remain visible in complete
denominators. Outputs are not retained by default; a canonical digest is recorded when
possible. `recordOutputs: true` can retain raw provider output and therefore requires an
application retention and redaction policy. A runner manifest is measured evidence only
and cannot bypass the separate quality-profile gate.

## Browser privacy

The workbench:

- loads only locally bundled application and tokenizer assets;
- compiles in a worker;
- has no analytics, accounts, database, provider calls, or remote fonts;
- does not read or write local storage, session storage, IndexedDB, or cookies;
- clears displayed results when input changes;
- binds worker responses to a request ID and SHA-256 input digest;
- caps user-selected artifact files at 20 MiB and reads them locally;
- sends imported artifact text to the worker for strict parsing, integrity verification,
  rendering, and decoding before display;
- creates in-memory download blobs only after user action;
- renders data and errors through React text escaping or `<pre>` text, not raw HTML.

Opening the workbench requires loading its static files from the selected local or hosted
origin. The authorized Vercel site serves the same static browser build, supplied artwork,
synthetic examples, and white-paper PDF. It has no account system, analytics, hosted
compiler, automatic input upload, provider call, or remote tokenizer download. Any new
hosting project, server function, storage, analytics, or user-data collection requires a
separate security and authorization review.

## Filesystem handling

The CLI reads only paths explicitly supplied by the user or the committed benchmark
manifest. JSON, task, schema, manifest, and benchmark-fixture reads are capped at 5 MiB;
artifact reads are capped at 20 MiB. Input paths must be regular files, standard input is
bounded, and malformed UTF-8 is rejected.

Output writes:

- pass both a lexical workspace check and a `realpath` check on the nearest existing
  ancestor and final parent;
- refuse overwrite by default;
- use a unique sibling temporary file and exclusive hard-link installation when not
  overwriting;
- use rename for forced replacement, including backup and restoration on Windows;
- remove the temporary file after a failed operation where possible.

These are local filesystem safeguards, not a multi-tenant authorization system. Run the
CLI with an appropriately permissioned workspace and do not expose its file interface as
a shared service without a separate access-control design.

The optional filesystem schema registry writes only digest-derived filenames inside one
caller-selected absolute directory. It uses mode `0600` on the temporary file, a hard
link for no-overwrite installation, strict filename patterns, regular-file checks, and
symbolic-link rejection. Reads use one open file handle and a bounded chunk loop. The
implementation compares the handle's device and inode with the named path before and
after reading, rechecks the type and size, rejects a changed entry, and closes the handle
on every outcome. Entries are content-verified on every resolution. Defaults are:

```text
entries: 128
entry bytes: 5 MiB
total bytes: 32 MiB
```

The in-memory registry enforces the same limits. Registry deletion is explicit and does
not delete artifacts that referenced a bundle.

## Logs, errors, and reports

Core errors identify codes, paths, counts, and sanitized schema diagnostics without
printing offending dataset values. The CLI writes structured failures to stderr. Explain
reports expose paths and shape counts, not sample values.

Generated artifacts, reports, restored data, provider responses, local profiles,
credentials, datasets, and environment files are ignored by default. Only reviewed
synthetic fixtures should be committed. A future debug mode that exposes data would need
an explicit local opt-in and is not currently part of the CLI.

## Dependency and build security

Dependencies are pinned in `pnpm-lock.yaml`, workspace packages are private, and the
browser bundle has no server credential dependency. Install with `--frozen-lockfile` for
reproducibility. The TOON adapter uses the official pinned package rather than a copied
grammar. Root `pnpm.overrides` resolves transitive `esbuild` to 0.28.2 as an audit
hardening measure. That locked override is not evidence that the final audit or build
passed.

Final dependency audit, license review, clean package-consumer smoke test, and browser
bundle inspection outcomes must be recorded after execution in `RELEASE_REPORT.md`. A
dependency listed in a manifest is not evidence that an audit passed.

## Out of scope

MORPH does not:

- execute shell text, JavaScript, JSON values, or JSON Pointers;
- evaluate arbitrary plugins from artifacts;
- fetch schemas or referenced resources from URLs;
- decompress uploaded archives;
- authenticate artifact authors;
- hide data from a model that receives the rendered prompt;
- enforce provider permissions or tool safety;
- make multi-tenant digests private;
- turn an encoding into a prompt-injection defense.

Applications remain responsible for authorization, retention, provider configuration,
tool permissions, output validation, and incident response.
