# Project website

The MORPH website is the public, narrative, and interactive surface for this repository.
It lives in `apps/workbench` and combines an approachable project guide, a long-form
online white paper, and the real browser compiler. The site is not a mock benchmark
dashboard or a second compiler.

## Hosted routes

- Main dossier and workbench: <https://morph-one-jade.vercel.app>
- HTML white paper: <https://morph-one-jade.vercel.app/white-paper>
- Reviewed PDF: <https://morph-one-jade.vercel.app/morph-white-paper-v0.1.pdf>

The deployment reuses the existing Vercel project named `morph`. Its framework is Vite,
its project root is `apps/workbench`, and its production branch is `main`.
`apps/workbench/vercel.json`
rewrites `/white-paper` to the static application entry so the route works when opened
directly. Internal hosting account and project identifiers are intentionally not
committed.

## Purpose

The first reading layer is designed for curious public readers, product builders, and
developers. It explains the idea in plain language before introducing technical terms.
Readers can understand:

- what MORPH compiles;
- which semantic guarantees it makes;
- how candidate formats become eligible or ineligible;
- what the named token measurement does and does not establish;
- which release evidence exists;
- which model-quality evidence does not yet exist; and
- how to run the real compiler in the browser without uploading their input.

The top-level narrative leads with the problem, the plain-English workflow, and the
working demo. The white-paper route explains the design in greater depth while keeping
specialist terms defined in context. The PDF remains a stable 23-page engineering paper
and is clearly labeled as technical. The public site does not link visitors into the
private source repository.

## Information architecture

The main route retains the existing MORPH experience:

1. Project thesis and current evidence state.
2. A concrete same-data, different-task use case.
3. The semantic preservation invariant.
4. The repeatable compiler workflow.
5. The five built-in layouts and carefully limited TOON option.
6. The working browser compiler and saved-result inspector.
7. The three-layer evidence model and curated v0.1 release figures.
8. Planner policy and trust boundaries.
9. CLI and SDK entry points.
10. Links to the approachable online white paper and technical PDF.

The existing graphs, pipeline visuals, candidate comparisons, and workbench controls
remain functional. The design update changes the visual system without replacing those
layouts.

## Visual system

The update uses an architecture-editorial visual language without copying another site's
implementation. The shared visual language includes:

- navy `#181B58`, coral `#F36161`, bright blue `#1863DC`, and green `#61CE70`;
- light surfaces `#FAFBFE`, `#F0F2F8`, and white cards;
- dark surfaces `#080A1F`, `#0D1030`, and `#121540`;
- thin low-contrast borders and soft navy-tinted elevation;
- rounded cards, full-pill buttons, and a glass-like sticky header;
- a moving multicolor treatment for the MORPH name;
- restrained hover lift and shimmer; and
- motion reduction when `prefers-reduced-motion` is active.

No remote font is loaded. The site uses a local system stack to keep the workbench
functional with networking disabled. The light and dark theme control initializes from
the operating-system preference and affects only the current page session. It does not
store input, task text, or a theme setting in browser storage.

## White paper

The source is `docs/white-paper.md`. The reviewed artifact is
`output/pdf/MORPH_White_Paper_v0.1.pdf`, and a byte-identical copy is served from
`apps/workbench/public/morph-white-paper-v0.1.pdf`. The PDF covers preservation
semantics, architecture, codecs, framing, tokenizer scope, policies, evaluation,
security, optional extensions, verified offline evidence, current limitations, and
reproduction commands.

Regenerate it in an authoring environment with Python and ReportLab installed:

```console
pnpm whitepaper:pdf
```

PDF generation is a documentation workflow, not a runtime dependency of MORPH.

## Claim discipline

All displayed measurements come from curated synthetic reports under
`reports/examples` or from `RELEASE_REPORT.md`. They are labeled as local,
tokenizer-specific evidence. The site and white paper explicitly report model task
quality as not run. Neither claims universal token savings, provider billing
equivalence, improved model accuracy, prompt-injection prevention, or a successful live
Jev integration.

## Assets and privacy

The MORPH brand images in `apps/workbench/public` are project assets. The favicon is a
small repository-native mark using the same palette. No third-party font, image CDN,
analytics script, account system, or telemetry service is loaded. The compiler worker
uses the same locally bundled tokenizer assets and registered codecs as the rest of the
workbench.

Normal use does not upload JSON, schemas, tasks, artifacts, or restored output. Downloads
are created only after the user requests them. Imported artifacts are parsed, verified,
rendered, and decoded locally.

## Local development

```console
pnpm workbench
```

The production output is written to `apps/workbench/dist`. A local build requires no
Vercel account and makes no provider call.

## Publication boundary

The owner authorized both the existing Vercel website and public source visibility for
the GitHub repository. Package publication, a GitHub release, a custom domain, paid model
evaluation, and broader hosted capability remain separate actions. The website decision
is recorded in [ADR 0002](decisions/0002-hosted-site-publication-boundary.md), and the
public source decision is recorded in
[ADR 0003](decisions/0003-public-source-publication.md).
