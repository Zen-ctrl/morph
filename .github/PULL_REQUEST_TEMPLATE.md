## Summary

Describe what changed, why it is needed, and the user-visible result.

## Related issue

Use `Closes #123`, or explain why this focused change does not need an issue.

## Change class

- [ ] Core semantics or public API
- [ ] Codec, artifact, or framing
- [ ] Tokenizer or measurement
- [ ] CLI or filesystem behavior
- [ ] Workbench or website
- [ ] Evaluation or evidence
- [ ] Optional integration
- [ ] Documentation
- [ ] CI or maintenance

## Verification

Record actual outcomes. Use `Not run` with a reason instead of leaving ambiguity.

| Command or check | Result | Notes |
| --- | --- | --- |
| `pnpm lint` |  |  |
| `pnpm typecheck` |  |  |
| `pnpm test` |  |  |
| `pnpm build` |  |  |

Run when applicable:

- [ ] `pnpm test:extended` for parser, IR, codec, artifact, or security changes
- [ ] `pnpm bench:conformance` for codec or format changes
- [ ] `pnpm bench:tokens` for guide, renderer, framing, or tokenizer changes
- [ ] `pnpm smoke:package` for package exports or dependency boundaries
- [ ] Dark, light, phone-sized, and offline browser checks for visible workbench changes

## Preservation and evidence

- [ ] The complete accepted input remains reconstructable, or the affected encoder is explicitly inapplicable.
- [ ] Reconstruction from the self-contained rendered bundle is covered when relevant.
- [ ] Number lexemes, types, array order, duplicates, nulls, missingness, and empty containers remain correct.
- [ ] Token measurements use the complete concatenated render when relevant.
- [ ] Preservation, tokenizer measurement, and model quality remain separate results.
- [ ] Model quality remains `unknown` or `not-run` unless qualifying evidence is attached.

## Security and operations

- [ ] No secret, credential, private dataset, provider response, or sensitive artifact was committed.
- [ ] Untrusted values and schema text remain data, not executable or privileged instructions.
- [ ] Runtime networking remains disabled unless an explicitly authorized optional adapter changed.
- [ ] Any provider calls, transmitted fields, limits, and costs are listed above.
- [ ] This change does not imply repository visibility, package publication, release, or deployment authority.

## Documentation

- [ ] Public contracts and examples were updated with behavior.
- [ ] A decision record was added for a specification deviation or cross-cutting decision.
- [ ] `RELEASE_REPORT.md` was changed only for evidence that was actually executed.
- [ ] Authored documentation and product copy contain no em dash characters.

## UI evidence

Add before and after screenshots using synthetic data, or write `Not applicable`.

## Reviewer focus

Call out compatibility risks, unresolved questions, or areas that deserve close review.
