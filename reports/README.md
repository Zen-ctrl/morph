# Reports

Only reviewed synthetic examples belong in `reports/examples/`. Other generated reports
are ignored by default.

A curated report must identify its source commit, fixture and manifest version, tokenizer
or model identity where applicable, settings, denominators, limitations, and whether each
layer was measured or not-run. Do not commit private datasets, raw provider exchanges,
credentials, or unredacted application output.

The current release evidence ledger is `RELEASE_REPORT.md`. Curated reports support that
ledger but do not replace it.
