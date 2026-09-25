# ADR 0003: Public source publication and history sanitization

Status: Accepted
Date: 2026-09-25
Related authorization: Owner request to update the repository, remove private details,
and make `Zen-ctrl/morph` public

## Context

MORPH was initially developed and reviewed in a private GitHub repository. The project
owner later authorized public source visibility. Public publication makes every reachable
commit and branch part of the disclosure surface, so checking only the current working
tree would be insufficient.

The publication audit found no live credentials, private keys, provider tokens, customer
datasets, or raw provider exchanges. It did find repository-specific operational details
that should not be public: a personal filesystem path and internal hosting account,
project, and deployment identifiers. An obsolete tracked hosting configuration also
contained an internal project identifier.

## Decision

- Publish the GitHub repository at <https://github.com/Zen-ctrl/morph> with public
  visibility.
- Keep the existing public Vercel website unchanged.
- Remove personal filesystem paths and internal hosting identifiers from committed files.
- Remove the obsolete `.openai/hosting.json` file and ignore `.openai/` state.
- Rewrite reachable repository history so removed operational details are not exposed by
  earlier commits.
- Remove generated dependency-update branches that still point to the pre-sanitization
  history. Dependabot may recreate them from the clean public default branch.
- Keep workspace packages marked private. Do not publish npm packages or a GitHub release.
- Do not select a project license implicitly. Public visibility alone does not grant reuse
  rights.

## Consequences

The public repository provides source review and collaboration without publishing a
package. Commit identifiers from the former private history are no longer the canonical
public history. A private local bundle is retained outside the repository for recovery by
the owner and must not be uploaded or linked from public documentation.

GitHub retains read-only hidden refs for three closed pre-publication Dependabot pull
requests. Repository owners cannot update or delete those refs through Git or the public
API. The retained bot commits passed the credential-pattern audit, but can still contain
the operational identifiers that were removed from the public default branch. A strict
object purge would require GitHub Support or repository replacement. This limitation is
recorded instead of claiming a guaranteed purge.

Contributors can use the documented issue, pull request, conduct, security, governance,
and verification workflows. The repository continues to make no model-quality claim and
does not gain new network behavior from publication.

## Validation

Before visibility changes, the release process must verify:

1. The current tree and reachable history contain no recognized credential patterns.
2. Tracked images and PDFs contain no personal location or author metadata.
3. The obsolete hosting configuration and internal hosting identifiers are absent.
4. Repository checks, strict type checking, tests, builds, CLI smoke tests, and offline
   conformance pass.
5. The rewritten default branch is the only intended public source history.
6. GitHub reports `PUBLIC` visibility after the change.

Actual commands and outcomes are recorded in `RELEASE_REPORT.md` and the publication
handoff.
