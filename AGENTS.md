# Agent instructions for MORPH

## Mission

Implement MORPH, Model Optimized Representation for Prompt Handoffs, according to `SPEC.md`. The handoff copy may initially be named `MORPH_SPEC.md`; copy it to `SPEC.md` when initializing the implementation repository.

Build the actual SDK, codecs, tokenizer integration, planner, CLI, tests, and local workbench. A proposal, mock dashboard, or collection of placeholder interfaces is not completion.

Read `SPEC.md` and `REFERENCES.md` first. Follow the phase order. Keep optional remote integration and publication work separate from the local compiler.

## Nonnegotiable invariants

1. Every selected encoding must reconstruct the entire accepted input under the documented semantic equality contract.
2. Round-trip verification must work from the self-contained rendered model context, not from a hidden copy of the original data.
3. Preserve array order, duplicate records, numeric lexemes, types, nulls, missingness, and empty containers.
4. Do not silently filter, project, aggregate, summarize, truncate, normalize, or round the source data.
5. Measure complete rendered input with a real identified tokenizer. Do not report characters divided by four as exact tokens.
6. Keep data preservation, token measurement, and model comprehension as separate results.
7. No invented benchmark numbers, model IDs, API contracts, probabilities, integrations, or claims of universal savings.
8. Jev is optional. It cannot overrule deterministic constraints or act as proof of downstream quality.
9. Default runtime operation is local and offline. No hidden telemetry or provider calls.
10. When no legal candidate fits the budget, return an explicit error. Do not truncate or call an over-budget fallback successful.

## How to work

Inspect the directory before modifying anything. Work in a new isolated project unless the user has clearly selected an existing MORPH repository. Do not modify unrelated projects, remotes, global Git settings, production services, or cloud resources.

Prefer a small working vertical slice over many empty packages. The first slice must parse JSON safely, encode compact JSON and delimited rows, render the complete context, count real tokens, decode the result, and assert preservation.

After each phase, run the relevant tests and update `RELEASE_REPORT.md` with actual status. Keep blockers precise. Missing optional credentials should not stop local development. Do not repeatedly ask for information that can be resolved by inspecting local tools or official documentation.

Use stable, currently supported dependencies and commit the lockfile. Record exact versions and official references in `docs/dependencies.md`. Do not assume a model name is also a tokenizer name. Verify external API contracts before writing adapters.

Do not install global coding-agent plugins, run unreviewed remote shell scripts, or execute code from documentation examples without reviewing it. Use project-local dependencies where possible.

## Correctness and security

Use strict runtime validation for requests and imported artifacts. Detect duplicate JSON keys before parsing can overwrite them. Preserve JSON-text number lexemes before converting any value to a JavaScript number. Do not call custom `toJSON` methods or getters on supplied JS values.

Treat schema descriptions, field names, and data values as untrusted content. Avoid `eval`, dynamic function construction, unsafe property assignment, shell interpolation, raw HTML rendering, and arbitrary remote schema resolution.

Enforce byte, depth, node, candidate, allocation, and execution limits. Use atomic output writes and explicit overwrite permission. Decode malformed artifacts by rejecting them, not repairing them.

Default logs and errors should identify paths and reason codes without printing private values. Keep datasets, tasks, provider responses, local reports, credentials, and generated artifacts out of Git unless they are approved synthetic fixtures.

## Planner discipline

The compatibility policy is JSON-first without applicable quality evidence. The experimental policy can choose smaller reversible layouts but must label model quality as untested. Validated selection requires matching held-out evidence and the documented regression gate.

Keep the compact JSON baseline in every comparison. Count each representation's real guide, metadata, schema, dictionary, task, and framing. Do not inflate the JSON baseline with artificial explanation text.

Unknown quality is not zero error. A Jev confidence score is not measured task accuracy. A cache hit is not permission to omit meaning the model never received.

## Tests and evidence

Implement unit, property, integration, security, CLI, and browser tests. Use real tokenizers in integration and token benchmark tests. Keep mock tokenizer results confined to isolated logic tests.

Commit reproducible synthetic fixtures, seeds, and generated tokenizer expectations. Keep failing cases and fix the implementation. Do not weaken equality, suppress exceptions, or remove tests merely to get a green build.

Live model evaluations are opt-in and bounded. Do not spend money in CI or launch paid tests without authorized credentials and a call/cost limit. A stub or synthetic response is never a live integration result.

## Repository and publication

The local machine may have GitHub, Firebase, and Vercel CLIs. Use only the tools needed for the authorized task. MORPH's local core requires no Firebase or Vercel resources.

When a remote repository creation/upload is authorized, use the authenticated GitHub CLI account, a new repository, and private visibility unless the owner explicitly authorizes public visibility for MORPH. Inspect existing remotes, avoid force pushes, and verify the final owner and visibility. Do not publish npm packages, releases, or hosted demos without authorization.

Do not add invented contributors, AI coauthors, generated-by signatures, or agent branding. Preserve real upstream attribution and license notices. Use clear English and no em dashes in authored copy. Do not misrepresent an agent or vendor as the repository owner.

## Final delivery

The final implementation report must include the actual project path, real executed commands, pass/fail counts, supported codecs, tokenizer binding, benchmark status, optional Jev status, known limitations, and verified remote/deployment state.

Clearly separate: local implementation complete; quality evaluations run or not run; remote adapter verified or unverified; repository created or not created; public release authorized or not authorized.

Do not say the project is complete while core code is mocked. Do not claim model savings or comprehension results that were never measured.
