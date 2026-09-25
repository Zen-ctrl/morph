# Security policy

This file defines the reporting path. The product threat model and implemented controls
are documented in [`docs/security.md`](docs/security.md).

## Supported versions

MORPH has not published a stable package release. Security fixes target the current `main`
branch and the active Vercel website. Historical commits and unmaintained local forks are
not supported release channels.

## Report a vulnerability

If GitHub shows a **Report a vulnerability** action for this repository, use its private
security-advisory flow. Otherwise contact a repository administrator through an existing
private collaboration channel. If neither route is available, open a normal issue titled
`Security contact requested` and include no vulnerability details.

Do not place exploit details, credentials, private datasets, provider responses, or other
sensitive material in a normal issue or pull request.

Include, when available:

- affected commit, package, command, route, or artifact version;
- impact and the trust boundary crossed;
- a minimal reproduction using synthetic data;
- relevant resource-limit or configuration values;
- whether the issue works with networking disabled;
- suggested mitigation, if known.

Maintainers will acknowledge and investigate reports as capacity permits. No fixed response
or remediation timeline is promised. Please allow time for validation before disclosure.

## Security scope

Relevant reports include:

- data loss or semantic mismatch accepted as a verified round trip;
- artifact or model-context tampering that bypasses integrity checks;
- prototype pollution, unsafe property reconstruction, code execution, or path traversal;
- resource-limit bypasses or dangerous allocation behavior;
- unexpected network access, telemetry, credential exposure, or browser persistence;
- schema resolution outside an authorized local resolver;
- provider or Jev adapter behavior that bypasses permission gates;
- cross-user data exposure in any future shared service.

Encoding instruction-shaped content does not neutralize prompt injection. A model following
malicious text found inside an otherwise valid dataset is a documented integration risk,
not by itself a MORPH codec vulnerability. Reports showing privilege promotion, unsafe tool
authority, or a violated documented boundary remain in scope.

## Safe testing

Use synthetic data, local targets, and the smallest effective reproduction. Do not access
another person's data, run unbounded provider calls, degrade the hosted site, or publish an
unfixed exploit. Security research does not authorize changes to repository permissions,
cloud resources, or third-party accounts.
