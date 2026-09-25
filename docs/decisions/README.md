# Decision records

Decision records capture cross-cutting choices and deliberate specification deviations.
They do not restate the complete product specification or replace normal pull-request
discussion.

## Index

| ID | Status | Decision |
| --- | --- | --- |
| [0001](0001-toolchain-and-scope.md) | Accepted, partially superseded | Local TypeScript compiler toolchain and initial release boundary |
| [0002](0002-hosted-site-publication-boundary.md) | Accepted, partially superseded | Existing Vercel site publication boundary |
| [0003](0003-public-source-publication.md) | Accepted | Public source publication and history sanitization |

## Process

1. Copy `0000-template.md` to the next four-digit number and a short kebab-case title.
2. Open the record as `Proposed` with the related issue or pull request.
3. Record context, alternatives, consequences, compatibility, evidence, and related specification sections.
4. A maintainer changes the status to `Accepted` or `Rejected` during review.
5. Never rewrite an accepted decision to hide history. Add a later record and mark the old decision `Superseded` or `Partially superseded`.

Allowed statuses are `Proposed`, `Accepted`, `Rejected`, `Superseded`, and
`Partially superseded`.
