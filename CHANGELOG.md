# Changelog

This changelog records repository versions and material user-visible changes. It does not
imply npm publication, a GitHub release, or public source availability.

The format follows Keep a Changelog in spirit, and the project intends to use Semantic
Versioning once package publication is authorized.

## Unreleased

### Added

- Human contribution, governance, conduct, security-reporting, and support guides.
- Structured GitHub issue forms, a pull request checklist, and CODEOWNERS routing.
- Documentation, package, fixture, test, report, and decision-record navigation.
- Reproducible editor, line-ending, and documentation-tool version files.

### Changed

- Repository status and hosted-site documentation now point to the verified release state.
- Local and pull-request verification commands share named package scripts.
- Source repository visibility is public after tracked files and reachable history were
  sanitized for personal paths and internal hosting identifiers.

### Security

- Removed obsolete hosting configuration from version control and ignored `.openai/`
  state.
- Confirmed that committed fixtures and reports are synthetic and that no live credential
  pattern was present before public publication.

## 0.1.0 - 2026-09-22

### Added

- Strict JSON and JavaScript-value intake with a tagged, number-lexeme-preserving IR.
- Five native reversible codecs and a preservation-gated official TOON adapter.
- Deterministic artifacts, self-contained model context, decode, render, and verification.
- Real local `o200k_base` token counting over complete rendered prompts.
- Compatibility, experimental, and evidence-qualified planner policies.
- TypeScript SDK, CLI, offline evaluation harness, and browser workbench.
- Optional local schema registry and optional gated Jev classifier packages.
- Seeded conformance, token, performance, property, integration, security, and browser tests.
- Project dossier, light and dark themes, technical white paper, and authorized Vercel site.

### Evidence boundary

- Codec conformance and tokenizer-specific prompt measurement were run.
- Downstream model-task quality and the live Jev contract test remain not-run.
- No npm package or GitHub release was published.
