# ADR 0001: Local TypeScript compiler toolchain and release boundary

Status: Accepted for implementation candidate 0.1.0
Date: 2026-09-22

## Context

MORPH must preserve accepted JSON semantics, compare several reversible prompt layouts,
measure the complete rendered text with a real tokenizer, explain policy decisions, and
run offline after installation. Optional remote planning and publication must not become
requirements for the core compiler.

The specification recommends a strict TypeScript monorepo, pnpm, property testing, a
minimal browser workbench, an official TOON adapter, and an optional Jev boundary. It also
requires deliberate deviations to be recorded rather than hidden behind completion
claims.

## Decision

### Toolchain

- Use Node.js `>=22.12.0 <25`, TypeScript 5.9.3, ECMAScript modules, and ES2022 output.
- Lock the workspace to pnpm 10.15.0 and commit `pnpm-lock.yaml`.
- Use Biome 2.5.14 for formatting and linting, Vitest 5.0.1 for tests, fast-check 4.10.2
  for property generation, and tsup 8.5.1 for package builds.
- Use React 19.3 and Vite 8.3 for a static local workbench.
- Keep every workspace package private. Publication is not part of local implementation.

### Semantic core

- Implement a dedicated bounded JSON parser because conventional `JSON.parse` loses raw
  number spelling and overwrites duplicate keys before the compiler can reject them.
- Represent all values as a tagged IR and hash a versioned, length-delimited canonical
  serialization with `@noble/hashes` 2.4.0.
- Use descriptor inspection for JavaScript values so the adapter does not call getters or
  `toJSON`.
- Reject lone surrogates instead of normalizing or replacing them.
- Use Ajv 8.20's Draft 2020-12 implementation for nonmutating instance validation. Use
  a conservative whole-instance guard for nonfinite host conversion and for
  precision-sensitive number lexemes when numeric comparison, numeric equality, or
  `uniqueItems: true` is present.

### Physical representations

- Implement five native format families in a browser-compatible package: compact JSON,
  framed JSON Lines, typed delimited rows, columns JSON, and typed path/value.
- Keep compact JSON as the mandatory measured baseline.
- Use only fixed safe delimiter sets and reject unsupported shapes rather than transform
  them.
- Put official TOON 4.1.1 behind a separate adapter. Gate number lexemes before host-number
  conversion and require official encode/decode plus MORPH equality.

### Tokenizer and target profile

- Use `js-tiktoken` 1.0.21 with bundled `o200k_base` ranks for browser-compatible offline
  counting.
- Bind the profile to the exact implementation revision and asset digest.
- Do not add a provider or model name to `local-o200k-base`.
- Treat special-token-looking input as ordinary text.

### Product composition

- Keep `@morph/core` independent of filesystem, provider, Jev, and UI code.
- Provide `@morph/sdk` as the composed local entry point with native codecs, gated TOON,
  the local tokenizer, the offline target, and no quality profiles.
- Make unexpected applicable-encoder failures fatal by default. Permit an explicit
  per-compiler quarantine mode for production fallback diagnostics, without allowing it
  to bypass baseline verification or persist hidden state.
- Compose Node filesystem behavior only in the CLI, evaluation package, and schema
  registry's `./node` entry.
- Run the workbench compiler in a disposable worker and bind results to the exact request
  digest.

### Extensions

- Implement a bounded content-addressed schema and guide registry as an optional package.
  Registry references are not model-ready and must hydrate to the normal self-contained
  artifact contract before rendering.
- Implement Jev only as an optional access-pattern classifier. Require independent
  network and task-disclosure permission, validate required response fields and the exact
  option set, abstain below a policy threshold, and fall back to `unknown` on failure.
- Do not wire Jev into codec correctness, eligibility, budgets, or quality evidence.

### Evidence and publication

- Keep codec conformance, token measurement, and model quality in separate reports.
- Provide a seeded paired dataset-cluster bootstrap helper for caller-supplied binary
  correctness records. Do not treat the helper as a model run or proof that dataset
  provenance is truthful.
- Run no paid evaluation by default and bundle no quality profile.
- Use a new private GitHub repository only when the final handoff performs and verifies
  the authorized repository operation.
- Do not publish packages, a release, a public repository, or a hosted demo without
  additional owner authorization.

## Consequences

### Positive

- JSON numbers such as `9007199254740993`, `-0`, and `1.2300` can survive native codecs
  without JavaScript rounding.
- The same pure compiler modules run in Node and the browser.
- Token counts are reproducible for one named implementation and complete rendered text.
- A missing credential or network connection cannot stop local compilation.
- Optional registry references cannot silently weaken the default self-contained artifact
  contract.
- The workbench and CLI expose real compiler output rather than mock metrics.

### Costs and constraints

- The dedicated parser and strict decoders require more maintenance than delegating all
  behavior to permissive host parsers.
- The local tokenizer is a third-party port and its exactness claim is limited to that
  adapter revision.
- TOON is inapplicable to lexemes its JavaScript number boundary cannot preserve.
- Complete schema and guide inclusion adds prompt overhead.
- Content-addressed registry references save local storage or transport duplication only
  before hydration. They do not reduce self-contained model context.
- Browser bundles include tokenizer ranks and, when using the default registry, TOON.

## Deliberate limitations and deviations

These items are visible product limits, not completed features:

1. Explicit `encoderFailureMode: "quarantine"` records a failed candidate and continues,
   but it does not maintain a persistent encoder-health registry across requests. Default
   mode is `throw`. Cancellation through the optional constructor `AbortSignal` remains
   cooperative between candidate operations.
2. Quality-profile identity, task-family, expiry, case-count, dataset-count, and
   confidence-bound gates exist. Core does not reproduce the statistics, prove dataset
   independence, or authenticate provenance. No profile is bundled.
3. A provider-neutral bounded evaluation runner and caller-supplied pricing-profile
   contract are implemented, but there is no provider adapter, full provider request
   counter, bundled production pricing profile, or cache integration.
   `estimated-request-cost` remains rejected by the compiler without a supported core
   cost profile.
4. Tokenizer tests verify the official asset digest and cross-check two installed
   JavaScript implementations. Seven committed fixtures were separately verified with
   official Python `tiktoken` 0.14.0, but Python remains a development-only oracle rather
   than a runtime or ordinary CI dependency.
5. Source maps currently cover compact JSON only and are returned by a separate helper,
   not embedded in artifacts.
6. Dictionary columns, explicit missingness masks, hybrid layouts, retained provider
   context, packed binary formats, delta encoding, learned cost models, and query
   execution are not implemented.
7. The microbenchmark reports an approximate before/after heap delta, not peak memory.
8. The Jev adapter defaults to the movable `jev-latest` request alias. It records the
   resolved response model when a call succeeds, but no live call has been run.
9. A registry reference is a separately typed transport extension. Core accepts only
   normal self-contained artifacts after hydration.
10. Package publication, an owner-selected repository license, public visibility, and
    hosted deployment remain outside the authorized local build.

## Revisit conditions

Revisit this decision when any of the following occurs:

- a verified provider requires a different tokenizer or request-accounting assembly;
- a quality corpus is large enough to support prespecified noninferiority profiles;
- a schema keyword needs an exact arbitrary-precision validator;
- source maps are required for non-JSON formats;
- a registry or Jev integration is promoted from optional extension to a release
  requirement;
- packages are prepared for actual publication;
- the Node.js or browser support window changes.
