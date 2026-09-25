# MORPH documentation map

`SPEC.md` is the normative product contract. The files under `docs/` explain the implemented
system, its operation, and its evidence without replacing that contract.

## Choose a reading path

### New contributor

1. [`../README.md`](../README.md)
2. [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
3. [`architecture.md`](architecture.md)
4. [`semantics.md`](semantics.md)
5. The package or surface document relevant to the change

### Codec author or reviewer

1. [`../SPEC.md`](../SPEC.md), especially sections 5, 8, 9, 10, 12, 13, and 20
2. [`semantics.md`](semantics.md)
3. [`format.md`](format.md)
4. [`architecture.md`](architecture.md)
5. [`benchmarking.md`](benchmarking.md)
6. [`../CONTRIBUTING.md`](../CONTRIBUTING.md), codec expectations

### SDK or CLI integrator

1. [`api.md`](api.md)
2. [`cli.md`](cli.md)
3. [`format.md`](format.md)
4. [`security.md`](security.md)

### Benchmark or evidence reviewer

1. [`benchmarking.md`](benchmarking.md)
2. [`../RELEASE_REPORT.md`](../RELEASE_REPORT.md)
3. [`../reports/README.md`](../reports/README.md)
4. [`../REFERENCES.md`](../REFERENCES.md)

### Release maintainer

1. [`release.md`](release.md)
2. [`dependencies.md`](dependencies.md)
3. [`../RELEASE_REPORT.md`](../RELEASE_REPORT.md)
4. [`../GOVERNANCE.md`](../GOVERNANCE.md)

### Security reviewer

1. [`../SECURITY.md`](../SECURITY.md) for private reporting
2. [`security.md`](security.md) for the product threat model
3. [`architecture.md`](architecture.md) and [`format.md`](format.md) for trust boundaries

## Source of truth by topic

| Topic | Source of truth |
| --- | --- |
| Product requirements and acceptance | [`../SPEC.md`](../SPEC.md) |
| Current observed release evidence | [`../RELEASE_REPORT.md`](../RELEASE_REPORT.md) |
| Release process and status vocabulary | [`release.md`](release.md) |
| Reviewed external sources | [`../REFERENCES.md`](../REFERENCES.md) |
| Semantic equality and accepted values | [`semantics.md`](semantics.md) |
| Artifact, framing, and codec grammars | [`format.md`](format.md) |
| Components and dependency direction | [`architecture.md`](architecture.md) |
| Public TypeScript interface | [`api.md`](api.md) |
| CLI commands and exit behavior | [`cli.md`](cli.md) |
| Benchmark and quality methodology | [`benchmarking.md`](benchmarking.md) |
| Product security and privacy model | [`security.md`](security.md) |
| Dependency identities and licenses | [`dependencies.md`](dependencies.md) |
| Website content and deployment boundary | [`website.md`](website.md) |
| Long-form explanatory narrative | [`white-paper.md`](white-paper.md) |
| Cross-cutting implementation decisions | [`decisions/README.md`](decisions/README.md) |

## Change-to-document matrix

| Change | Update |
| --- | --- |
| Product contract | `SPEC.md`, affected contract docs, tests, and a decision record when needed |
| Input or equality behavior | `semantics.md`, `api.md`, fixtures, and tests |
| Codec, artifact, or framing behavior | `format.md`, `architecture.md`, conformance fixtures, and tests |
| SDK or CLI behavior | `api.md` or `cli.md`, examples, and tests |
| Benchmark method | `benchmarking.md`, manifest version, and evaluation tests |
| Observed test or benchmark result | `RELEASE_REPORT.md` and reviewed synthetic reports only |
| Dependency upgrade | `dependencies.md`, lockfile, audit result, and relevant fixture evidence |
| Website or hosting behavior | `website.md`, security review, and release report |
| Deliberate specification deviation | A numbered record under `decisions/` with product impact |

## Status language

Use the vocabulary defined in [`release.md`](release.md): Implemented, Experimental,
Planned, Blocked, Not evaluated or not-run, and Verified. Zero is a measurement and must
not stand in for missing evidence.

## Generated and historical material

- Curated synthetic reports live under `reports/examples/`.
- Local artifacts, datasets, provider responses, and unreviewed reports remain ignored.
- `RELEASE_REPORT.md` is updated only after commands or external checks actually run.
- `ASTRA_START_HERE.md` is retained as a historical build handoff and is not contributor onboarding.
