# Historical: MORPH initial build handoff

> This file preserves the original implementation handoff. MORPH has already been
> initialized and built. Current contributors should start with `README.md`,
> `CONTRIBUTING.md`, and `docs/README.md`. The canonical specification is now `SPEC.md`.

## How to use this package

The original handoff expected a new local project and an attached file named
`MORPH_SPEC.md`. That content now lives at the repository root as `SPEC.md`. The
instructions below are historical and must not be treated as the current development or
publication procedure.

`AGENTS.md` defines execution rules. `REFERENCES.md` contains the primary documentation checked while preparing the specification. The included fixtures are synthetic test inputs, not measured benchmark results.

Copy the following instruction into Astra:

---

Build MORPH, Model Optimized Representation for Prompt Handoffs, from the attached specification.

Read `AGENTS.md`, `MORPH_SPEC.md`, and `REFERENCES.md` completely. Initialize a new isolated implementation workspace and copy `MORPH_SPEC.md` to the repository root as `SPEC.md`. Treat that specification as the canonical product contract.

Implement the product, not another plan. Build a local TypeScript representation compiler with strict input parsing, a typed JSON-compatible IR, reversible physical encoders, a real tokenizer adapter, a bounded deterministic planner, explain reports, a self-contained artifact format, a CLI, an offline test/benchmark harness, and a browser comparison workbench.

Start with a working vertical slice: compact JSON and typed delimited rows, complete-context token counting, and exact restoration from the rendered context. Then add JSON Lines, column-oriented JSON, typed path/value, and the optional official TOON adapter according to their conformance limits.

Keep the entire source dataset intact. Task hints may change physical layout but must not silently remove fields or rows, compute aggregates, summarize, deduplicate, reorder arrays, or round values. Preserve raw JSON number lexemes and all documented distinctions between missing, null, false, and empty values.

Separate three outcomes in code, tests, and UI: software data preservation; measured prompt-token count; downstream model-task quality. Never invent model accuracy or token savings. Default to JSON compatibility without applicable quality evidence. Provide explicit experimental and evidence-qualified selection modes.

The core must work locally without API keys, hosted databases, Firebase, or remote model calls after dependencies and tokenizer assets are installed. Jev is an optional later adapter for bounded task classification or planner hints, not a required compiler dependency and not an authority over correctness or budgets. Verify its official API before implementing it and report a live test as not run until actually executed.

Use the locally installed GitHub CLI for authorized repository operations. Create a new private repository by default when upload is authorized; do not make MORPH public, publish packages, deploy a demo, or touch unrelated cloud resources without explicit owner authorization. Firebase and Vercel CLI availability does not require their use.

Do not add invented AI coauthors or generated-by branding. Preserve legitimate upstream credits. Use no em dashes in authored documentation or copy.

Follow the implementation phases and acceptance matrix. Write and execute tests as you go. Keep `RELEASE_REPORT.md` updated with actual results and precise blockers. Do not stop at a mockup or use missing optional credentials as a reason not to finish the local compiler.

Finish with the real project path, implemented feature list, executed commands, actual test results, benchmark status, known limitations, and verified repository/deployment state. Do not fabricate integrations, model IDs, remote URLs, benchmark results, or completion claims.

---

## First milestone to review

A command can load the included synthetic customer data, produce compact JSON and a typed row representation, measure both full rendered contexts with a real local tokenizer, decode either representation back into the complete source data, and explain any selection. No model call is necessary for this milestone.

A smaller representation is an observed token result only when actually measured. Its effect on model answers remains untested until the evaluation harness runs a real quality experiment.
