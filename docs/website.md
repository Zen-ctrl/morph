# Project website

The MORPH website is the narrative and interactive surface for this repository. It lives
in `apps/workbench` and combines a technical project dossier with the real browser
compiler. The site is not a separate mock, benchmark dashboard, or second compiler.

## Purpose

The site is designed for developers and technical evaluators who need to understand:

- what MORPH compiles;
- which semantic guarantees it makes;
- how candidate formats become eligible or ineligible;
- what the local tokenizer measurement does and does not establish;
- which release evidence exists;
- which model-quality evidence does not yet exist; and
- how to run the actual compiler without sending input to a service.

The top-level narrative is a guided reading of the contracts already defined in this
repository. The documentation index links to the canonical Markdown sources rather than
replacing them.

## Information architecture

The single-page static site contains:

1. Project thesis and current evidence state.
2. A concrete same-data, different-task use case.
3. The semantic preservation invariant.
4. The deterministic compiler pipeline.
5. The five native codecs and optional gated TOON adapter.
6. The working browser compiler and artifact inspector.
7. The three-layer evidence model and curated v0.1 release figures.
8. Planner policy and trust boundaries.
9. CLI and SDK entry points.
10. Links to the canonical repository documentation.

## Claim discipline

All displayed measurements come from the curated synthetic reports under
`reports/examples` or from `RELEASE_REPORT.md`. They are labeled as local,
tokenizer-specific evidence. The site explicitly reports model task quality as not run.
It does not claim universal token savings, provider billing equivalence, improved model
accuracy, or prompt-injection prevention.

## Assets and privacy

The two MORPH brand images in `apps/workbench/public` were supplied by the project owner
for this repository. The favicon is a small repository-native mark using the same palette.
No third-party font, image CDN, analytics script, account system, or telemetry service is
loaded. The compiler worker uses the same locally bundled tokenizer assets and registered
codecs as the rest of the workbench.

## Local development

```console
pnpm workbench
```

The printed loopback URL opens the website. Build the static output with:

```console
pnpm --filter @morph/workbench build
```

The production output is written to `apps/workbench/dist` for ordinary workspace builds.
The private Sites deployment builds the same app into the root ignored `dist` directory,
as declared by `.openai/hosting.json`.

## Deployment boundary

The source repository remains private. A private website deployment does not authorize a
public repository, npm publication, GitHub release, public demo, or custom domain. The
verified deployment URL and state are recorded in `RELEASE_REPORT.md` after publication.
