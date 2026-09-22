# Contributing to MORPH

Thank you for helping improve MORPH. This repository welcomes focused contributions that
preserve the product contract: accepted input must remain fully reconstructable, measured
token counts must describe the complete rendered text, and model-quality claims must be
backed by applicable evidence.

Read these documents before beginning substantial work:

1. [`SPEC.md`](SPEC.md) for the product contract.
2. [`docs/README.md`](docs/README.md) for the documentation map.
3. [`docs/architecture.md`](docs/architecture.md) for package ownership and dependency direction.
4. [`docs/semantics.md`](docs/semantics.md) and [`docs/format.md`](docs/format.md) for preservation rules.
5. [`GOVERNANCE.md`](GOVERNANCE.md) for decisions, review, and merge authority.
6. [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and [`SECURITY.md`](SECURITY.md).

## Product principles

Every change must respect these boundaries:

- Re-encoding is not projection. Do not silently filter, summarize, aggregate, normalize,
  truncate, reorder arrays, or remove fields.
- A codec round trip proves recoverability, not model comprehension.
- Token measurements must cover the complete rendered prompt under an identified tokenizer.
- Unknown model quality, pricing, provider framing, or cache behavior must stay unknown.
- Core compilation and the default workbench remain local and offline.
- Untrusted data and schema text remain data. Encoding does not neutralize prompt injection.
- Optional network integrations cannot bypass deterministic correctness or policy gates.

## Find or propose work

Use the structured GitHub issue forms for bugs, features, codec proposals, and questions.
Search existing issues first. For a small documentation typo or an obvious test correction,
a focused pull request may be sufficient.

Before implementing a large feature, new representation family, public API change, new
network capability, or product-contract change, open an issue first. A deliberate
specification deviation also requires a decision record under [`docs/decisions/`](docs/decisions/).

Do not place private datasets, credentials, provider responses, or exploit details in an
issue. Follow [`SECURITY.md`](SECURITY.md) for vulnerabilities.

Issue labels use three independent dimensions:

- type: the existing `bug`, `enhancement`, `documentation`, or `question` labels;
- area: `area:core`, `area:codecs`, `area:tokenizer`, `area:cli`, `area:workbench`,
  `area:evaluation`, `area:docs`, `area:security`, or `area:integrations`;
- review signal: `needs-reproduction`, `evidence-required`, `breaking-change`, or `blocked`.

Use `good first issue` only when the acceptance criteria and test path are already clear.

## Development setup

Requirements:

- Node.js `>=22.12.0 <25`
- pnpm `10.15.0`
- Git

Install from the locked dependency graph:

```console
corepack enable
pnpm install --frozen-lockfile
pnpm morph doctor
```

Run the ordinary pull-request verification loop:

```console
pnpm verify:pr
```

Useful focused commands:

```console
pnpm --filter @morph/core build
pnpm exec vitest run apps/workbench
pnpm --filter @morph/workbench build
pnpm test:extended
pnpm bench:conformance
pnpm bench:tokens
pnpm smoke:package
```

`pnpm test:extended`, token benchmarks, performance benchmarks, and package smoke tests are
slower release checks. Run the checks relevant to your change before opening a pull request.
`pnpm verify:ci` reproduces the complete GitHub Actions command locally, including repository
metadata, package installation smoke, CLI smoke, and the small conformance suite.

White-paper regeneration is optional for ordinary code changes. When its source or layout
changes, install the pinned documentation tools and build both committed copies:

```console
python -m pip install -r requirements-docs.txt
pnpm whitepaper:pdf
```

## Workspace map

| Location | Responsibility |
| --- | --- |
| `packages/core` | Public contracts, strict input handling, IR, profiling, planning, artifacts, framing, and verification |
| `packages/encoders` | Five native lossless representation families |
| `packages/tokenizer-adapters` | Explicit local tokenizer profiles and asset verification |
| `packages/toon-adapter` | Preservation-gated adapter around the official TOON implementation |
| `packages/sdk` | Composed TypeScript entry point |
| `packages/cli` | Local command-line interface and filesystem safety |
| `packages/evaluation` | Offline corpora, conformance, token measurements, performance, and model-evaluation contracts |
| `packages/schema-registry` | Optional local schema and guide registry extension |
| `packages/jev-planner` | Optional gated remote access-pattern classifier |
| `apps/workbench` | Static project site and real browser compiler workbench |
| `fixtures` | Curated synthetic inputs and tokenizer expectations |
| `tests` | Cross-package acceptance, integration, property, security, and CLI coverage |

Core owns interfaces and orchestration. Evaluation, the CLI, provider adapters, and the
browser compose core; core must not import those layers.

## Change-specific expectations

### Core semantics or public API

- Add runtime validation as well as static types.
- Preserve versioned compatibility or document the intentional break.
- Cover success, malformed input, limits, and tampering.
- Update `docs/api.md`, `docs/semantics.md`, or `docs/format.md` as applicable.

### Codec changes

- State exact applicability and rejection reasons.
- Specify the grammar, metadata, guide, decoder invariants, and allocation limits.
- Test the codec independently from the planner.
- Exercise direct encode/decode and reconstruction from the self-contained model bundle.
- Preserve number lexemes, types, arrays, duplicates, missingness, nulls, and empty containers.
- Include guide and metadata overhead in complete-render token measurements.
- Add explicit edge cases plus reproducible property tests.

### Planner or evidence changes

- Keep compact JSON as the measured baseline.
- Apply correctness and policy gates before cost ranking.
- Do not invent accuracy penalties or expected quality fields.
- Make tie breaking deterministic.
- Treat timeout and cancellation as incomplete work, not a completed optimization.

### Workbench changes

- Use the real compiler and bundled local assets.
- Preserve keyboard access, form labels, visible error states, and responsive layouts.
- Keep untrusted values in React text nodes. Do not use raw HTML rendering.
- Keep input, tasks, and theme choices out of browser storage by default.
- Verify dark and light themes and at least one phone-sized viewport.

### Remote or provider integration

- Keep it in an optional adapter package.
- Require explicit network and disclosure permission.
- Never place credentials in browser bundles, arguments, URLs, fixtures, logs, or snapshots.
- Bound request count, concurrency, retries, timeouts, response size, and spend where applicable.
- Record an unrun live check as `not-run`, never as passed.

## Fixtures, benchmarks, and claims

Commit only curated synthetic fixtures or public test data with clear provenance. Generated
artifacts, provider responses, private datasets, and local reports are ignored by default.

Benchmark changes must record tokenizer identity, renderer version, fixture version, seed,
environment where relevant, and complete denominators. A tokenizer measurement is not a
model-quality result. Do not add universal savings, accuracy, cost, user, or customer claims
without reproducible evidence for the stated scope.

## Documentation style

- Use clear English and no em dash characters.
- Distinguish implemented, experimental, planned, blocked, and not evaluated.
- Keep examples executable and aligned with the current CLI or SDK.
- Record deliberate specification deviations in `docs/decisions/` and explain their impact.
- Preserve legitimate upstream attribution and dependency notices.
- Do not add a model, agent, or vendor as an invented author or coauthor.

## Commits and pull requests

Use a short branch name such as `fix/path-decoder` or `feat/quality-profile-loader`. Keep
commits reviewable and use a concise imperative subject. The repository commonly uses
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`, and `chore:` prefixes.

A pull request should:

- solve one coherent problem;
- explain user-visible behavior and product-contract impact;
- identify risk and compatibility concerns;
- list the exact commands run and their outcomes;
- update tests and documentation together with behavior;
- include screenshots for visible workbench changes;
- contain no secrets, private data, generated local artifacts, or unrelated formatting churn.

Pull requests are squash-merge friendly. Maintainers may ask for a decision record, smaller
scope, additional evidence, or a rebase before merge.

## Review and release boundaries

At least one maintainer approval is expected before merge. CODEOWNERS identifies the
current review owner, but branch protection is a repository setting and must not be assumed
from the file alone.

Merging source does not authorize package publication, a GitHub release, repository
visibility changes, paid model calls, or a new deployment. Those actions require the
separate authority described in [`GOVERNANCE.md`](GOVERNANCE.md) and
[`docs/release.md`](docs/release.md).
