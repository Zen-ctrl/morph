# Test layout

| Directory | Purpose |
| --- | --- |
| `unit` | Focused contracts such as IR, framing, artifacts, evidence, and source maps |
| `property` | Seeded generated round trips across native codec plans |
| `integration` | Compiler, SDK, schema, tokenizer, and cross-package composition |
| `security` | Hostile keys, content, limits, tampering, and trust-boundary failures |
| `e2e` | CLI command, file, output, and exit behavior |
| `acceptance` | Specification acceptance coverage and explicit extension boundaries |

Use the ordinary suite during development:

```console
pnpm test
```

Use the extended property budget for parser, codec, artifact, and release work:

```console
pnpm test:extended
```

Keep reproducible seeds and minimized failing cases. Do not weaken equality, remove a
failure, or replace a real tokenizer with a mock to obtain a green performance result.
