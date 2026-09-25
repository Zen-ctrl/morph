# MORPH offline evaluation report

Generated: 2026-09-22T06:31:43.606Z
Tokenizer: o200k_base (js-tiktoken@1.0.21:o200k_base:sha256:446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d)
Benchmark manifest: morph-benchmark-manifest/1
Fixture version: synthetic-v2
Fixture set digest: 08d8a02dd3a5bc6e0e652da33f8f97a34ff4762e66ba79db5815930d9687e70c
Git commit: unavailable after pre-publication source-history sanitization
Git dirty: unavailable after pre-publication source-history sanitization
Environment: Node 24.19.0 win32/x64
Model task quality: not run

Input bytes: 226
Stage denominator: 15
Timing sample denominator: 300
parse: median 0.034 ms, p95 0.048 ms
profile: median 0.044 ms, p95 0.070 ms
encode:json-compact: median 0.029 ms, p95 0.035 ms
decode:json-compact: median 0.056 ms, p95 0.086 ms
encode:json-lines: median 0.024 ms, p95 0.036 ms
decode:json-lines: median 0.054 ms, p95 0.066 ms
encode:rows-delimited: median 0.027 ms, p95 0.038 ms
decode:rows-delimited: median 0.072 ms, p95 0.107 ms
encode:columns-json: median 0.026 ms, p95 0.035 ms
decode:columns-json: median 0.039 ms, p95 0.054 ms
encode:path-value: median 0.035 ms, p95 0.054 ms
decode:path-value: median 0.163 ms, p95 0.212 ms
render: median 0.064 ms, p95 0.069 ms
tokenize:warm: median 0.847 ms, p95 0.929 ms
full-compare: median 16.220 ms, p95 17.155 ms

These results establish local codec behavior and tokenizer-specific prompt counts only.
