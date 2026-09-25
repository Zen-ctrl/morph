# Release process

MORPH separates local implementation, offline verification, optional remote integration,
repository publication, package publication, and hosted deployment. Completing one does
not imply the others.

## Release classes

| Class | Required evidence |
| --- | --- |
| Local implementation | SDK, CLI, five native codecs, gated TOON, tokenizer, planner, artifact, offline harness, and workbench are present and buildable. |
| Local verified release | Frozen install plus lint, strict typecheck, automated tests, extended property suite, builds, package smoke, CLI smoke, workbench smoke, offline conformance, token suite, and security checks have recorded passing results. |
| Model-quality evidence | Authorized live model runs with exact model identity, matched cases, complete denominators, uncertainty, and a valid quality profile. Not required for local release. |
| Optional Jev verification | Authorized bounded contract call with resolved model, request/response validation, usage, and no secret exposure. Not required for local release. |
| Private repository handoff | Authenticated GitHub CLI creation or push to a verified new private repository, with owner, URL, default branch, and visibility recorded. |
| Public release | Explicit owner authorization for public visibility and an owner-selected license, plus separate package, release, or deployment authorization as applicable. |

## Status labels

Documentation uses these labels consistently:

- **Implemented**: working source exists, without implying the final release run passed.
- **Experimental**: implemented behind an explicit policy or extension boundary and not
  supported by downstream quality evidence.
- **Planned**: no complete supported implementation is claimed.
- **Blocked**: completion requires a specific missing authority or external capability.
- **Not evaluated** or **not-run**: the relevant execution did not occur.
- **Verified**: a named command or external state check ran successfully and is recorded.

## Clean install and toolchain

From the repository root:

```console
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm morph doctor
```

Required versions are Node.js `>=22.12.0 <25` and pnpm `10.15.0`. Doctor checks local
registrations and tokenizer availability without credentials or billable calls.

## Required local verification

The pull-request baseline is shared with CI:

```console
pnpm verify:pr
```

The complete automated test and benchmark sequence is:

```console
pnpm verify:release
```

Those scripts compose the following commands. Record the exact result, duration where
useful, and any failure:

```console
pnpm check:repo
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:package
pnpm verify:cli
pnpm bench:conformance
pnpm test:extended
pnpm bench:tokens
pnpm bench:performance
```

`pnpm verify:release` includes the real CLI smoke path. Also perform the browser checks
below, and use these individual CLI commands when diagnosing a failure:

```console
pnpm morph inspect --input fixtures/examples/customers.json

pnpm morph compare \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --target local-o200k-base \
  --policy economy-experimental

pnpm morph compile \
  --input fixtures/examples/customers.json \
  --task-file fixtures/examples/lookup.task.txt \
  --schema fixtures/examples/customers.schema.json \
  --target local-o200k-base \
  --policy compatibility \
  --output artifacts/release-smoke.morph.json

pnpm morph render \
  --input artifacts/release-smoke.morph.json \
  --output artifacts/release-smoke.context.txt

pnpm morph verify --input artifacts/release-smoke.morph.json

pnpm morph decode \
  --input artifacts/release-smoke.morph.json \
  --output artifacts/release-smoke.restored.json

pnpm --filter @morph/workbench build
```

Generated release-smoke files remain ignored. Do not commit local artifacts or reports
unless they are deliberately curated synthetic evidence.

`pnpm smoke:package` packs and installs all nine library and command packages: core,
encoders, tokenizer adapters, TOON adapter, evaluation, schema registry, Jev planner,
CLI, and composed SDK. It runs `morph doctor`, the installed offline conformance bench,
a compile/decode SDK example, an in-memory registry example, and the disabled Jev
fallback in a clean temporary consumer. Dependency installation may query the package
registry when pnpm metadata is not cached; the installed runtime checks keep MORPH
networking disabled.

## Offline CI workflow

`.github/workflows/ci.yml` runs on pushes, pull requests, and manual dispatch with
read-only repository-content permission. It selects Node.js 24.19.0 and pnpm 10.15.0,
installs from the frozen lockfile, then runs `pnpm verify:ci`. That command checks repository
metadata, runs the pull-request suite, exercises a clean package consumer, completes a CLI
compile/render/decode and verify path, and runs the small offline conformance suite.
`MORPH_ALLOW_NETWORK` is set to
`false`. Concurrent runs for the same ref are cancelled in favor of the newest commit. The
workflow contains no provider credentials, paid evaluator, deployment, package publication,
or report upload.

The extended property budget, token report, and performance microbenchmarks remain local
release commands rather than automatic pull-request jobs. Source presence does not prove
the workflow passed. Record the actual remote run state and URL in `RELEASE_REPORT.md`
after the repository is pushed.

## Acceptance review

The final report should summarize the specification acceptance matrix rather than mark a
scenario passed from source inspection alone. At minimum, evidence must cover:

- all eligible codecs on a uniform table;
- large integer, `-0`, decimal trailing zeros, and exponent lexemes;
- invalid JS values and duplicate JSON keys;
- array order and duplicate multiplicity;
- missing versus null versus false versus empty string;
- empty arrays, empty objects, and primitive roots;
- delimiters, quotes, and escaped newlines;
- RFC 6901 escaping and hostile-looking keys;
- tampered row, column, array, path, dictionary when implemented, and artifact data;
- unknown tokenizer and target binding;
- no-fit token budget;
- tiny-input guide overhead;
- schema resolution, dialect, nonmutation, and precision-sensitive numeric validation;
- optional Jev disabled, malformed, low-confidence, and ineligible-hint behavior where
  tests exist;
- deterministic repeated artifact and model-context identity;
- UTF-16 source-map offsets on Unicode;
- offline workbench behavior and stale-result cancellation;
- byte, depth, node, rendered, candidate, and timeout limits;
- complete-text token count rather than summed component counts;
- hostile marker-shaped content;
- no rewriting of provider tool and output schemas.

The current implementation does not include dictionary transforms, so acceptance cases
specific to dictionary corruption apply only if that extension is later enabled.

## Benchmark handling

The conformance, token, and performance commands print machine-readable JSON. Save a
release copy only after review:

```console
pnpm morph bench --suite conformance --offline --report reports/conformance.json
pnpm morph bench --suite tokens --offline --report reports/tokens.json
pnpm morph bench --suite performance --offline --report reports/performance.json
```

Token rows establish only complete rendered-text counts for the named local tokenizer.
Performance rows establish only observations on the recorded machine. No result establishes
model comprehension.

If no paid model evaluation runs, write exactly `not-run`. Do not infer a quality profile
from codec tests or prompt-token savings.

## Optional extension review

### Schema registry

Verify content-addressed bundle creation, digest mismatch rejection, bounded in-memory and
filesystem behavior, symbolic-link rejection, exact reference-to-bundle binding, and
hydration to a normal self-contained artifact. Registry references must never be passed
to the model before hydration.

### Jev

Offline response and fallback tests may be synthetic. A live test requires explicit
credentials, network and task-disclosure permission, a request cap, and recorded resolved
model. Until that happens, report:

```text
adapter implementation: present
offline contract fixtures: synthetic
live contract test: not-run
core dependency: false
quality evidence: none
```

## Dependency and supply-chain review

Before marking the local release verified:

1. Confirm manifests and lockfile agree.
2. Install with `--frozen-lockfile`.
3. Record the actual package-manager audit result without hiding advisories.
4. Review direct and transitive licenses.
5. Confirm no server-only module or credential enters the browser bundle.
6. Run the packed or built SDK in a clean Node consumer.
7. Generate an SBOM if the selected tooling supports it, or record `not generated`.

No clean audit or license conclusion may be written before the relevant command and
review run.

## Git and repository handoff

The repository was initially created as private. Public source visibility was separately
authorized on 2026-09-25. Before remote creation, publication, or push:

1. Inspect `git status`, the current branch, and all existing remotes.
2. Verify the authenticated GitHub CLI account.
3. Confirm the target repository is new and unrelated to existing projects.
4. Use private visibility unless the owner has explicitly authorized public visibility.
5. Sanitize committed files and reachable history before public publication.
6. Push the intended default branch normally.
7. Query the resulting owner, repository URL, default branch, and visibility.
8. Record those verified facts in `RELEASE_REPORT.md`.

Recommended description:

> MORPH compiles structured data into model-facing context. It compares JSON, typed rows,
> columns, paths, and optional TOON, measures tokenizer-specific prompt size, preserves
> the source data, and explains its choices. Includes a local SDK, CLI, workbench, and
> evaluation tools.

Public source visibility is not npm package publication and does not select a license.
The existing MORPH Vercel website is authorized by ADR 0002, and public source visibility
is authorized by ADR 0003. Do not create an npm publication, GitHub release, Firebase
resource, additional deployment project, or materially broader hosted capability without
separate explicit authorization.

## Final report requirements

`RELEASE_REPORT.md` must include:

- repository-relative project root without a personal filesystem path;
- specification and package version;
- actual Node.js and pnpm versions;
- commit and working-tree state;
- commands actually executed;
- pass and fail counts;
- supported codec and tokenizer revisions;
- conformance, token, and performance result paths and summaries;
- model evaluation status;
- Jev implementation and live-test status;
- schema registry status;
- known limitations and unresolved audit findings;
- verified remote URL, owner, visibility, and default branch, or a precise blocker;
- package, release, demo, and public-visibility state.

Placeholders must be replaced only with observed facts. A remaining placeholder means the
release is not yet fully reported.
