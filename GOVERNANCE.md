# MORPH governance

MORPH is currently maintained in a private repository. This document defines a lightweight
collaboration model that can grow without weakening the compiler's preservation and
evidence contracts.

## Sources of authority

When two project artifacts disagree, use this order:

1. `SPEC.md` for the product contract.
2. Accepted decision records in `docs/decisions/` for deliberate implementation choices or deviations.
3. Versioned public contracts and format documentation.
4. Tests and current implementation behavior.
5. Planning notes and proposals.

A test that contradicts the specification is not automatically authoritative. Resolve the
conflict explicitly and record the decision when product behavior changes.

## Roles

### Maintainers

Maintainers have merge and release authority. They triage issues, review product-contract
impact, protect security reports, approve decision records, and verify publication scope.
The current review owner is recorded in `.github/CODEOWNERS`.

### Contributors

Contributors may open issues, propose decisions, submit code and documentation, review
changes, and produce reproducible evidence. A merged contribution does not by itself grant
maintainer or publication authority.

### Reviewers

A maintainer may request subject-matter review for codecs, evaluation methods, security,
browser accessibility, or external integrations. Review responsibility can be scoped to a
change without creating a permanent role.

## Decision process

Small, reversible implementation decisions can be made in a pull request. Use an issue and
an architecture decision record when a change affects any of these areas:

- accepted input semantics or equality;
- artifact, context, codec, or canonicalization versions;
- dependency direction or package ownership;
- public SDK or CLI compatibility;
- network, privacy, credential, or provider behavior;
- quality qualification or benchmark methodology;
- release, licensing, visibility, or publication policy;
- a deliberate deviation from `SPEC.md`.

Decision records use the template in `docs/decisions/0000-template.md`. Record alternatives,
impact, compatibility, validation, and any specification deviation. Accepted decisions are
changed by a later decision record, not by silently rewriting their history.

## Review and merge

Pull requests should be focused, green in offline CI, and approved by a maintainer. Review
priorities are:

1. Semantic preservation and fail-closed behavior.
2. Security, privacy, and bounded resource use.
3. Honest measurement and evidence labels.
4. Deterministic behavior and compatibility.
5. Maintainability, documentation, accessibility, and performance.

The normal merge strategy is squash merge with a clear conventional subject. Maintainers
may preserve separate commits when their history adds review or release value.

CODEOWNERS provides review routing. Required status checks and CODEOWNER approval depend on
GitHub repository-plan support. They are advisory when the private repository cannot enforce
them. Do not change repository visibility merely to obtain enforcement.

Emergency security fixes may use a private advisory and a shortened review path. They still
require regression coverage and a post-merge record of the affected behavior.

## Releases and external actions

Local verification, repository merge, package publication, repository visibility, hosted
deployment, and paid evaluation are separate actions.

- Maintainers may merge verified source into the private repository.
- Public repository visibility requires explicit owner authorization.
- npm publication and GitHub releases require separate owner authorization.
- A deployment may update only an already authorized project and scope unless the owner
  authorizes a new resource.
- Paid or remote model evaluation requires credentials, disclosure permission, and bounded
  call or cost controls.
- A version is not declared quality-qualified without an applicable evidence profile.

## Adding maintainers

Add a maintainer through a reviewed pull request that updates CODEOWNERS and records the
scope of responsibility. Repository permissions are managed separately through GitHub.
Removing access or changing ownership is an administrative action and is not implied by a
documentation change.

## Conduct and conflicts

All participants follow `CODE_OF_CONDUCT.md`. Technical disagreement should be resolved
with the specification, reproducible evidence, and explicit tradeoffs. If consensus is not
available, the repository owner makes the final project decision and records a significant
product-contract choice in a decision record.
