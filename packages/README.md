# Workspace packages

MORPH uses a pnpm workspace. Every package is private in version 0.1.0.

| Package | Owns | Must not own |
| --- | --- | --- |
| `@morph/core` | Contracts, IR, validation, profiling, planning, artifacts, framing, verification | Filesystem, provider SDKs, browser UI, live evaluation |
| `@morph/encoders` | Native physical formats and strict decoders | Planner policy, tokenizer binding, provider calls |
| `@morph/tokenizer-adapters` | Explicit tokenizer identity, assets, and local counts | Model-quality claims or guessed aliases |
| `@morph/toon-adapter` | Official TOON integration and preservation gate | Invented TOON grammar or unsafe number conversion |
| `@morph/sdk` | Default local composition | New semantic behavior independent of core |
| `@morph/cli` | Commands, bounded file IO, and exit behavior | Compiler semantics or hosted upload |
| `@morph/evaluation` | Corpora, offline suites, bounded evaluator contracts, reports | Production compile-time model calls |
| `@morph/schema-registry` | Optional local bundle storage, references, and hydration | Reference-only model context |
| `@morph/jev-planner` | Optional remote access-pattern hints and fallback | Encoding, token counting, correctness, or quality authority |

Dependency direction is documented in `docs/architecture.md`. Add a new package only when
it has a distinct runtime or trust boundary. A new package must declare the repository Node
range, remain private, expose a narrow entry point, build under `pnpm build`, and participate
in package smoke coverage when intended for consumers.
