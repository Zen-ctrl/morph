# Fixtures

Committed fixtures are synthetic and versioned. They are used for codec conformance,
tokenizer expectations, benchmark manifests, CLI examples, and adversarial security cases.

When adding a fixture:

- use synthetic or clearly licensed public data;
- preserve the exact property being tested, including number lexemes and Unicode spelling;
- keep secrets, credentials, personal data, and provider responses out of Git;
- state the expected applicable and inapplicable representations;
- update the versioned benchmark manifest when the benchmark corpus changes;
- regenerate tokenizer expectations only with the documented tokenizer and oracle process;
- record the seed for generated data rather than committing a large private sample.

Large performance-only fixtures must not automatically trigger provider calls or paid
evaluation. `fixtures/examples` is for readable local examples, `fixtures/conformance` for
semantic edge cases, and `fixtures/tokenizer` for authoritative token expectations.
