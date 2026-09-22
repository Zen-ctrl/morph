import { ThemeToggle } from "./ThemeToggle.js";

const REPOSITORY_URL = "https://github.com/Zen-ctrl/morph";

const CODECS = [
  [
    "Compact JSON",
    "Every accepted IR",
    "Baseline",
    "Exact numeric lexemes and minimal structural whitespace.",
  ],
  ["JSON Lines", "Root arrays", "Native", "One compact JSON value per framed physical line."],
  [
    "Typed rows",
    "Uniform primitive records",
    "Native",
    "Deterministic fields and typed JSON scalar cells.",
  ],
  [
    "Column JSON",
    "Uniform primitive records",
    "Native",
    "Aligned field arrays that retain source row order.",
  ],
  [
    "Typed paths",
    "Every accepted IR",
    "Native",
    "JSON Pointer paths with explicit node and container types.",
  ],
  [
    "Official TOON",
    "Preservation-safe inputs",
    "Gated",
    "Official adapter with an exactness gate for MORPH semantics.",
  ],
] as const;

const PIPELINE = [
  ["01", "Parse", "Accept strict JSON text or the documented JavaScript value subset."],
  ["02", "Model", "Build a tagged intermediate representation with exact number lexemes."],
  ["03", "Profile", "Measure shape, depth, uniformity, missingness, and bounded repetition."],
  ["04", "Plan", "Enumerate a stable, capped set of legal physical representations."],
  ["05", "Prove", "Encode, decode, and reconstruct from the self-contained model bundle."],
  ["06", "Measure", "Tokenize the complete final render under the selected local tokenizer."],
  ["07", "Gate", "Apply policy, evidence, resource, and token-budget requirements."],
  ["08", "Explain", "Return the selected artifact with candidate facts and reason codes."],
] as const;

function WhitePaperHeader(): React.JSX.Element {
  return (
    <header className="app-header white-paper-header">
      <a className="brand" href="/" aria-label="MORPH home">
        <img className="brand-mark" src="/morph-mark.jpg" alt="" aria-hidden="true" />
        <span>
          <strong>MORPH</strong>
          <small>white paper</small>
        </span>
      </a>
      <nav className="site-nav white-paper-nav" aria-label="White paper navigation">
        <a href="#abstract">Abstract</a>
        <a href="#architecture">Architecture</a>
        <a href="#evidence">Evidence</a>
        <a href="#current-state">Current state</a>
      </nav>
      <aside className="header-meta" aria-label="Document controls">
        <a className="header-document-link" href="/morph-white-paper-v0.1.pdf" download>
          PDF
        </a>
        <ThemeToggle />
      </aside>
    </header>
  );
}

export function WhitePaperPage(): React.JSX.Element {
  return (
    <div className="app-shell white-paper-shell">
      <a className="skip-link" href="#white-paper-main">
        Skip to white paper
      </a>
      <WhitePaperHeader />

      <main id="white-paper-main" className="white-paper-main">
        <header className="white-paper-hero">
          <div>
            <p className="eyebrow">Engineering white paper · specification version 0.1.0</p>
            <p className="white-paper-wordmark" aria-hidden="true">
              MORPH
            </p>
            <h1>A lossless representation compiler for model context.</h1>
            <p className="white-paper-deck">
              MORPH compiles structured data into reversible model-facing layouts, measures the
              complete text with a named tokenizer, and explains why a candidate is selected or
              rejected. It treats preservation, token efficiency, and model comprehension as three
              separate questions.
            </p>
            <div className="hero-actions white-paper-actions">
              <a className="button primary" href="/morph-white-paper-v0.1.pdf" download>
                Download the PDF <span aria-hidden="true">↓</span>
              </a>
              <a className="button secondary" href="/#compiler">
                Open the workbench <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <aside className="white-paper-status" aria-label="White paper status">
            <div>
              <span>Document</span>
              <strong>Engineering white paper v0.1</strong>
            </div>
            <div>
              <span>Local release</span>
              <strong>Implemented and exercised</strong>
            </div>
            <div>
              <span>Model quality</span>
              <strong>Not run</strong>
            </div>
            <div>
              <span>Prepared</span>
              <strong>September 22, 2026</strong>
            </div>
          </aside>
        </header>

        <section
          className="paper-section paper-abstract"
          id="abstract"
          aria-labelledby="paper-abstract-title"
        >
          <div className="paper-section-label">00 / Abstract</div>
          <div className="paper-prose">
            <h2 id="paper-abstract-title">
              Physical layout should be measurable without changing meaning.
            </h2>
            <p className="paper-lead">
              Structured context is usually handed to a language model in whichever serialization
              the application already has. That choice affects prompt length and how information is
              arranged, but changing it can introduce ambiguity or data loss. MORPH places a
              deterministic compiler between application data and model context.
            </p>
            <p>
              The compiler accepts structured data, an optional schema, a task description, a
              tokenizer profile, and constraints. It generates legal representations, reconstructs
              each finalist, renders the complete model-facing text, measures that exact text, and
              applies explicit policy gates. The output is a self-contained artifact plus an explain
              report. A smaller representation is never treated as proof that a model will
              understand it equally well.
            </p>
            <blockquote>
              <code>semanticEqual(decode(encode(input)), input) == true</code>
              <span>
                The preservation invariant for every supported encoding and accepted input.
              </span>
            </blockquote>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="problem-title">
          <div className="paper-section-label">01 / Problem</div>
          <div className="paper-prose">
            <h2 id="problem-title">The request is not the product. The compiler is.</h2>
            <div className="paper-columns">
              <div>
                <h3>The optimization problem</h3>
                <p>
                  One complete dataset can be represented as records, aligned columns, typed paths,
                  or compact JSON. Those layouts may tokenize differently and may serve different
                  access patterns. MORPH searches only a bounded set and reports the candidates it
                  did not search or could not use.
                </p>
              </div>
              <div>
                <h3>The safety boundary</h3>
                <p>
                  Re-encoding is not projection. Task hints can influence physical layout, but they
                  never authorize dropping a row, field, duplicate, null, empty container, or array
                  position. Filtering, aggregation, summarization, and query execution belong in a
                  separate transform contract.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="paper-section paper-dark"
          id="architecture"
          aria-labelledby="architecture-title"
        >
          <div className="paper-section-label">02 / Architecture</div>
          <div className="paper-prose">
            <h2 id="architecture-title">A deterministic pipeline with proof before preference.</h2>
            <p className="paper-lead">
              Every finalist crosses the same semantic, dependency, tokenizer, policy, and budget
              gates before it can enter cost ranking.
            </p>
            <ol className="paper-pipeline">
              {PIPELINE.map(([number, title, body]) => (
                <li key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="semantics-title">
          <div className="paper-section-label">03 / Semantics</div>
          <div className="paper-prose">
            <h2 id="semantics-title">
              Exact JSON meaning enters a tagged intermediate representation.
            </h2>
            <p className="paper-lead">
              JSON text is parsed before native number conversion can erase spelling or precision.
              Objects retain entries, arrays retain order and multiplicity, and numbers retain their
              grammar-validated lexemes.
            </p>
            <div className="paper-fact-grid">
              <article>
                <span>Numbers</span>
                <strong>9007199254740993, -0, and 1.2300 stay exact.</strong>
              </article>
              <article>
                <span>Objects</span>
                <strong>Duplicate keys are rejected before overwrite.</strong>
              </article>
              <article>
                <span>Arrays</span>
                <strong>Order, length, duplicate records, and holes remain distinct.</strong>
              </article>
              <article>
                <span>Strings</span>
                <strong>Whitespace and Unicode content are preserved without normalization.</strong>
              </article>
            </div>
            <p>
              The JavaScript value entry point accepts only the documented JSON-compatible subset.
              It rejects cycles, accessors, sparse arrays, BigInt, nonfinite numbers, unsupported
              prototypes, functions, symbols, and undefined. Hostile or untrusted input should use
              the strict JSON-text path.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="formats-paper-title">
          <div className="paper-section-label">04 / Formats</div>
          <div className="paper-prose paper-wide">
            <h2 id="formats-paper-title">Six physical targets with explicit applicability.</h2>
            <div className="paper-table-wrap">
              <table className="paper-table">
                <caption>Implemented representation families in the v0.1 local release</caption>
                <thead>
                  <tr>
                    <th scope="col">Representation</th>
                    <th scope="col">Input scope</th>
                    <th scope="col">Status</th>
                    <th scope="col">Physical strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {CODECS.map(([name, scope, status, description]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{scope}</td>
                      <td>
                        <span className="paper-status-pill">{status}</span>
                      </td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="artifact-title">
          <div className="paper-section-label">05 / Artifact</div>
          <div className="paper-prose">
            <h2 id="artifact-title">The handoff contains what reconstruction needs.</h2>
            <div className="artifact-anatomy">
              <div>
                <span>01</span>
                <strong>Physical plan</strong>
                <p>Encoding, version, options, and planner policy.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Encoded section</strong>
                <p>Payload, layout metadata, and guide identity.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Model dependencies</strong>
                <p>Schema meaning and the complete interpretation guide.</p>
              </div>
              <div>
                <span>04</span>
                <strong>Request frame</strong>
                <p>Task, prefix, suffix, and template version.</p>
              </div>
              <div>
                <span>05</span>
                <strong>Integrity</strong>
                <p>Versioned digests for payload and dependencies.</p>
              </div>
            </div>
            <p>
              The model bundle has a frozen framing grammar and carries its own interpretation
              metadata. MORPH parses that bundle and reconstructs the intermediate representation
              without a hidden original JSON copy. Hash verification is reported separately from
              semantic validity and from model-quality evidence.
            </p>
          </div>
        </section>

        <section className="paper-section paper-token-section" aria-labelledby="tokens-title">
          <div className="paper-section-label">06 / Measurement</div>
          <div className="paper-prose">
            <h2 id="tokens-title">Count the final text, not a convenient fragment.</h2>
            <p className="paper-lead">
              MORPH assembles caller prefix, compiler guide, self-contained data block, task, and
              caller suffix. It tokenizes that concatenated render because token boundaries can
              cross component boundaries.
            </p>
            <div className="render-equation">
              <span>prefix</span>
              <b>+</b>
              <span>guide</span>
              <b>+</b>
              <span>schema and data</span>
              <b>+</b>
              <span>task</span>
              <b>+</b>
              <span>suffix</span>
            </div>
            <p>
              The bundled profile uses js-tiktoken 1.0.21 with o200k_base. Its result is exact for
              the visible rendered text under that tokenizer revision. It is not automatically an
              exact provider request count, a billing count, or a model identity. Unknown bindings
              remain unknown.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="policy-paper-title">
          <div className="paper-section-label">07 / Selection</div>
          <div className="paper-prose">
            <h2 id="policy-paper-title">Policy defines how much authority evidence has.</h2>
            <div className="paper-policy-grid">
              <article>
                <span>Default</span>
                <h3>Compatibility</h3>
                <p>Compact JSON remains selected when applicable quality evidence is absent.</p>
              </article>
              <article>
                <span>Opt in</span>
                <h3>Economy experimental</h3>
                <p>The smallest reversible eligible render may win with quality marked untested.</p>
              </article>
              <article>
                <span>Evidence bound</span>
                <h3>Validated</h3>
                <p>A nonbaseline choice requires a matching qualified quality profile.</p>
              </article>
            </div>
            <p>
              Cost ranking happens only after applicability, round-trip, dependency, binding,
              experimental-feature, quality, and prompt-budget gates. A forced encoding bypasses
              ranking, not correctness or policy. If no legal candidate fits, MORPH returns a typed
              error rather than truncating input or calling an over-budget result successful.
            </p>
          </div>
        </section>

        <section
          className="paper-section paper-evidence"
          id="evidence"
          aria-labelledby="paper-evidence-title"
        >
          <div className="paper-section-label">08 / Evidence</div>
          <div className="paper-prose paper-wide">
            <h2 id="paper-evidence-title">
              The local release measures preservation and prompt size.
            </h2>
            <div className="paper-metrics">
              <article>
                <strong>130</strong>
                <span>ordinary tests passed</span>
                <small>24 files, 0 failed, 0 skipped</small>
              </article>
              <article>
                <strong>5,000+</strong>
                <span>complete native bundle round trips</span>
                <small>seed 20260921</small>
              </article>
              <article>
                <strong>70 / 73</strong>
                <span>conformance cases passed</span>
                <small>3 correctly inapplicable, 0 failed</small>
              </article>
              <article>
                <strong>61</strong>
                <span>complete prompts measured</span>
                <small>9 fixtures, 58 eligible</small>
              </article>
              <article className="paper-metric-caution">
                <strong>Not run</strong>
                <span>model task quality</span>
                <small>No provider calls or qualified accuracy profile</small>
              </article>
            </div>
            <div className="paper-case-study">
              <div>
                <p className="eyebrow">A useful non-win</p>
                <h3>JSON Lines was smaller, and compact JSON still won.</h3>
                <p>
                  On the customer comparison fixture, JSON Lines measured 884 tokens and compact
                  JSON measured 896. The 12-token saving was only 1.339 percent, below both the
                  16-token and 2 percent hysteresis thresholds. Compact JSON remained selected.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Compact JSON</dt>
                  <dd>896 tokens</dd>
                </div>
                <div>
                  <dt>JSON Lines</dt>
                  <dd>884 tokens</dd>
                </div>
                <div>
                  <dt>Column JSON</dt>
                  <dd>891 tokens</dd>
                </div>
              </dl>
            </div>
            <p className="paper-note">
              A separate synthetic sequence fixture measured Column JSON at 704 tokens versus 736
              for compact JSON, a 32-token reduction. This is token evidence only. It is not a model
              accuracy result or a universal savings claim.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="security-title">
          <div className="paper-section-label">09 / Security</div>
          <div className="paper-prose">
            <h2 id="security-title">Local-first operation with explicit trust boundaries.</h2>
            <ul className="paper-rule-list">
              <li>Core compilation and offline tests make zero network calls.</li>
              <li>
                Dataset values, schema descriptions, and property names remain untrusted data.
              </li>
              <li>
                Encoding does not neutralize prompt injection or grant content higher privilege.
              </li>
              <li>
                Remote schema fetching and arbitrary executable artifact plugins are disabled.
              </li>
              <li>
                Byte, depth, node, candidate, render, and planning limits bound local resources.
              </li>
              <li>Browser input, tasks, and visual preferences are not persisted.</li>
            </ul>
            <p>
              Defaults include a 5 MiB input limit, depth 64, 250,000 nodes, 24 candidates, a 16 MiB
              rendered-candidate limit, and a 5,000 ms abort limit. Cancellation does not produce a
              partial successful artifact.
            </p>
          </div>
        </section>

        <section
          className="paper-section paper-current"
          id="current-state"
          aria-labelledby="current-title"
        >
          <div className="paper-section-label">10 / Current state</div>
          <div className="paper-prose paper-wide">
            <h2 id="current-title">What MORPH is doing right now.</h2>
            <div className="current-state-grid">
              <article>
                <span>Working now</span>
                <h3>Local compiler</h3>
                <p>
                  Strict intake, profiling, bounded candidate generation, native codecs, gated TOON,
                  artifact framing, decode, integrity verification, and deterministic selection.
                </p>
              </article>
              <article>
                <span>Working now</span>
                <h3>Developer surfaces</h3>
                <p>
                  A TypeScript SDK, complete CLI, offline conformance and token suites, and this
                  browser workbench using the real compiler in a worker.
                </p>
              </article>
              <article>
                <span>Measured now</span>
                <h3>Tokenizer-specific prompt size</h3>
                <p>
                  Exact complete-render counts for o200k_base, plus deterministic candidate deltas,
                  budgets, reasons, and locally reproducible artifacts.
                </p>
              </article>
              <article className="current-state-later">
                <span>Not run</span>
                <h3>Downstream model quality</h3>
                <p>
                  There is no live provider evaluator result, accuracy claim, noninferiority
                  certification, provider billing count, or verified Jev contract test.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="limits-title">
          <div className="paper-section-label">11 / Limits</div>
          <div className="paper-prose">
            <h2 id="limits-title">MORPH makes a narrow promise and keeps it observable.</h2>
            <p className="paper-lead">
              The compiler does not promise a universal winning representation, fixed token savings,
              improved reasoning, safe prompt content, or cheaper provider billing. It does not
              replace native tool schemas, execute queries, train models, or infer business meaning
              from samples.
            </p>
            <p>
              Optional dictionary, missingness, registry, and Jev integrations remain separate
              extensions. Their absence does not block the local compiler. Quality qualification
              requires matched model and workload evidence, paired evaluation, uncertainty, and
              invalidation when the renderer, guide, model, tokenizer, or encoding changes.
            </p>
          </div>
        </section>

        <section className="white-paper-cta" aria-labelledby="paper-cta-title">
          <div>
            <p className="eyebrow">Read, run, verify</p>
            <h2 id="paper-cta-title">The artifact is the claim.</h2>
            <p>
              Download the full paper, inspect the source, or run the compiler against the bundled
              synthetic fixtures. Model quality remains explicitly unmeasured until real evaluations
              are authorized and completed.
            </p>
          </div>
          <div className="white-paper-cta-actions">
            <a className="button primary" href="/morph-white-paper-v0.1.pdf" download>
              Download PDF
            </a>
            <a className="button secondary" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              View private repository <span aria-hidden="true">↗</span>
            </a>
            <a className="text-button" href="/">
              Return to MORPH
            </a>
          </div>
        </section>
      </main>

      <footer className="app-footer white-paper-footer">
        <p>
          MORPH separates preservation, tokenizer measurement, and model comprehension. The white
          paper documents the implemented local release and its present evidence boundary.
        </p>
        <span>v0.1.0 · local first · model quality not run</span>
      </footer>
    </div>
  );
}
