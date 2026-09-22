# ADR 0002: Existing Vercel site publication boundary

Status: Accepted
Date: 2026-09-22
Related authorization: Owner request to publish and show the MORPH website on the existing Vercel project

## Context

ADR 0001 kept hosted deployment outside the initially authorized local build. The owner
later explicitly requested that the MORPH technical dossier, real browser workbench, and
white paper be served through the existing Vercel project. The source repository and all
workspace packages remain private.

## Decision

- Reuse the existing Vercel project named `morph` rather than create another project.
- Serve the static Vite output from `apps/workbench` at
  <https://morph-one-jade.vercel.app>.
- Publish only project documentation, supplied MORPH artwork, curated synthetic examples,
  the local browser compiler, and the reviewed white-paper PDF.
- Keep browser compilation local. Do not add an account system, analytics, automatic input
  upload, provider call, remote tokenizer download, or hosted database.
- Treat website publication as separate from repository visibility, package publication,
  GitHub releases, model evaluation, and any new cloud resource.

## Alternatives considered

- Create a new Vercel project. Rejected because an appropriate project already existed and
  the owner explicitly requested reuse.
- Keep the site local only. Rejected after explicit website publication authorization.
- Make the GitHub repository public. Rejected because website authorization did not extend
  to source visibility.

## Consequences

The project has a public explanatory and experimental surface while source collaboration
remains private. Static assets are fetched from Vercel, but user-entered data stays within
the browser workbench. Hosting configuration and current deployment evidence are recorded
in `docs/website.md` and `RELEASE_REPORT.md`.

The published site must not imply model-quality evidence, provider billing accuracy, npm
availability, or a public source license.

## Compatibility and migration

No artifact, codec, SDK, CLI, or tokenizer contract changes. The site uses the same compiler
packages and synthetic examples as the local build.

## Specification impact

This decision exercises the separate deployment authorization boundary described in
`SPEC.md` sections 17, 22, and 25. It partially supersedes only ADR 0001 limitation 10 as it
applies to the existing MORPH Vercel project. Package publication, licensing, and public
repository visibility remain outside the authorized scope.

## Validation

- Existing project identity and aliases verified through the Vercel CLI.
- Homepage, `/white-paper`, and the PDF route returned HTTP 200.
- Desktop dark and light themes and a phone-sized viewport were checked.
- The real browser compiler completed a local comparison with no browser console warning.
- GitHub offline CI passed for the deployed source commit.

## Revisit conditions

Revisit this decision before adding a custom domain, server function, account, analytics,
database, remote compiler, provider integration, new deployment project, or user-data
collection.
