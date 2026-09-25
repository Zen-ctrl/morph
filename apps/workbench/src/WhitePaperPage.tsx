import { ThemeToggle } from "./ThemeToggle.js";

const CODECS = [
  [
    "Compact JSON",
    "Any supported JSON",
    "Standard choice",
    "Familiar JSON with extra spacing removed and exact number spelling preserved.",
  ],
  [
    "JSON Lines",
    "Top-level lists",
    "Built in",
    "One compact JSON value per line, plus the details needed to rebuild the list.",
  ],
  [
    "Typed rows",
    "Table-shaped simple records",
    "Built in",
    "Field names are stored once, followed by rows whose cells keep their original types.",
  ],
  [
    "Column JSON",
    "Table-shaped simple records",
    "Built in",
    "Values are grouped by field while their positions preserve the original rows.",
  ],
  [
    "Typed paths",
    "Any supported JSON",
    "Built in",
    "Every value is paired with its exact location and type in the data tree.",
  ],
  [
    "Official TOON",
    "Inputs it can preserve exactly",
    "Carefully limited",
    "The official TOON package is used only when MORPH can prove exact recovery.",
  ],
] as const;

const PIPELINE = [
  ["01", "Read", "Accept strict JSON and reject ambiguous or unsafe input."],
  ["02", "Preserve", "Record types, exact number spelling, order, and nested structure."],
  [
    "03",
    "Understand the shape",
    "Measure depth, repeated values, missing fields, and table-like patterns.",
  ],
  ["04", "Plan", "Build a small, repeatable set of layouts that legally fit the data."],
  ["05", "Prove", "Decode each serious option and confirm that the original data can be rebuilt."],
  [
    "06",
    "Measure",
    "Count the complete prompt with the selected tokenizer, including guides and labels.",
  ],
  [
    "07",
    "Check the rules",
    "Apply the chosen caution level, evidence requirements, limits, and token budget.",
  ],
  ["08", "Explain", "Return the selected result with facts and reasons for every option."],
] as const;

function WhitePaperHeader(): React.JSX.Element {
  return (
    <header className="app-header white-paper-header">
      <div className="browser-bar" aria-hidden="true">
        <span className="browser-controls">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-address">MORPH : THE WHITE PAPER</span>
        <span className="browser-edition">V 0.1 / DOCUMENT</span>
      </div>
      <div className="masthead">
        <a className="brand" href="/" aria-label="MORPH home">
          <span className="brand-symbol" aria-hidden="true">
            M<span>↗</span>
          </span>
          <span>
            <strong>MORPH</strong>
            <small>white paper / volume 01</small>
          </span>
        </a>
        <nav className="site-nav white-paper-nav" aria-label="White paper navigation">
          <a href="#abstract">Overview</a>
          <a href="#architecture">How it works</a>
          <a href="#evidence">Evidence</a>
          <a href="#current-state">Today</a>
        </nav>
        <aside className="header-meta" aria-label="Document controls">
          <a className="header-document-link" href="/morph-white-paper-v0.1.pdf" download>
            Technical PDF
          </a>
          <ThemeToggle />
        </aside>
      </div>
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
            <p className="eyebrow">Public white paper · version 0.1</p>
            <p className="white-paper-wordmark" aria-hidden="true">
              MORPH
            </p>
            <h1>How MORPH reshapes data for model prompts without losing it.</h1>
            <p className="white-paper-deck">
              MORPH tries several ways to arrange structured data for an AI model. It proves the
              original data can be rebuilt, counts the full prompt with a named token counter, and
              explains why each layout could or could not be chosen.
            </p>
            <div className="hero-actions white-paper-actions">
              <a className="button primary" href="/morph-white-paper-v0.1.pdf" download>
                Technical paper (PDF) <span aria-hidden="true">↓</span>
              </a>
              <a className="button secondary" href="/#compiler">
                Open the workbench <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <aside className="white-paper-status" aria-label="White paper status">
            <div>
              <span>Document</span>
              <strong>Public white paper v0.1</strong>
            </div>
            <div>
              <span>Working software</span>
              <strong>Available in the browser workbench</strong>
            </div>
            <div>
              <span>Model understanding</span>
              <strong>Not tested yet</strong>
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
          <div className="paper-section-label">00 / Overview</div>
          <div className="paper-prose">
            <h2 id="paper-abstract-title">
              The shape of a prompt can change without changing the data inside it.
            </h2>
            <p className="paper-lead">
              Applications often send structured data to a language model in whatever format they
              already use. That layout can affect prompt length and where related facts appear. But
              changing it carelessly can also lose information or make values ambiguous. MORPH is a
              careful conversion step between application data and a model prompt.
            </p>
            <p>
              It accepts data, an optional schema that describes the data, a task, a token counter,
              and a few limits. It tries the layouts that fit, rebuilds the data from each serious
              option, renders everything the model would receive, and measures that full text. The
              result is a self-contained artifact, meaning a saved MORPH result, plus a report that
              explains the choice. A smaller layout is never treated as proof of equal model
              understanding.
            </p>
            <blockquote>
              <code>semanticEqual(decode(encode(input)), input) == true</code>
              <span>
                In plain English: change the layout, change it back, and get the same data meaning.
              </span>
            </blockquote>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="problem-title">
          <div className="paper-section-label">01 / Problem</div>
          <div className="paper-prose">
            <h2 id="problem-title">
              The job is not just to make text smaller. It is to make the choice trustworthy.
            </h2>
            <div className="paper-columns">
              <div>
                <h3>One dataset, several possible layouts</h3>
                <p>
                  A representation is simply the layout used to express the same data. Records,
                  columns, paths, and compact JSON may use different amounts of prompt space and
                  place related facts differently. MORPH tries a limited, predictable set and tells
                  you what it checked.
                </p>
              </div>
              <div>
                <h3>Rearranging is not editing</h3>
                <p>
                  A task hint may influence the layout, but it never authorizes dropping a row,
                  field, repeated value, null, empty container, or list position. Filtering,
                  summarizing, and calculating new results are useful jobs, but they are different
                  jobs with different promises.
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
            <h2 id="architecture-title">
              First prove the data comes back. Then compare the options.
            </h2>
            <p className="paper-lead">
              Every layout that could win must pass the same data-recovery, completeness,
              token-count, selection-rule, and budget checks before prompt size matters.
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
          <div className="paper-section-label">03 / Keeping the meaning</div>
          <div className="paper-prose">
            <h2 id="semantics-title">
              MORPH records what each JSON value is before trying new layouts.
            </h2>
            <p className="paper-lead">
              Internally, MORPH uses a tagged data tree called an intermediate representation, or
              IR. It records whether each item is an object, list, string, number, boolean, or null.
              Numbers keep their exact written form, and lists keep their order and repeated items.
            </p>
            <div className="paper-fact-grid">
              <article>
                <span>Numbers</span>
                <strong>9007199254740993, -0, and 1.2300 stay exact.</strong>
              </article>
              <article>
                <span>Objects</span>
                <strong>Repeated field names are rejected before one can overwrite another.</strong>
              </article>
              <article>
                <span>Arrays</span>
                <strong>
                  Order, length, repeated records, and missing positions remain distinct.
                </strong>
              </article>
              <article>
                <span>Strings</span>
                <strong>Whitespace and Unicode content are preserved without normalization.</strong>
              </article>
            </div>
            <p>
              Developers can also provide JavaScript values, but MORPH accepts only the predictable
              JSON-compatible subset. It rejects values that would be ambiguous or could run hidden
              behavior, including getters, cycles, sparse arrays, functions, BigInt, and nonfinite
              numbers.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="formats-paper-title">
          <div className="paper-section-label">04 / Formats</div>
          <div className="paper-prose paper-wide">
            <h2 id="formats-paper-title">Six layout families, each with clear limits.</h2>
            <div className="paper-table-wrap">
              <table className="paper-table">
                <caption>Layouts available in MORPH version 0.1</caption>
                <thead>
                  <tr>
                    <th scope="col">Layout</th>
                    <th scope="col">Works with</th>
                    <th scope="col">Status</th>
                    <th scope="col">What it does</th>
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
            <h2 id="artifact-title">A saved MORPH result carries what it needs.</h2>
            <p className="paper-lead">
              MORPH calls this saved result an artifact. It contains the chosen layout, the arranged
              data, the instructions needed to read it, and fingerprints used to detect changes.
            </p>
            <div className="artifact-anatomy">
              <div>
                <span>01</span>
                <strong>Layout choice</strong>
                <p>The selected format, its version, options, and selection mode.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Arranged data</strong>
                <p>The data block plus details that describe how it is laid out.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Reading instructions</strong>
                <p>The optional data description and complete layout guide.</p>
              </div>
              <div>
                <span>04</span>
                <strong>Prompt details</strong>
                <p>The task and the text placed before and after the data.</p>
              </div>
              <div>
                <span>05</span>
                <strong>Integrity checks</strong>
                <p>Digital fingerprints for the data and its required instructions.</p>
              </div>
            </div>
            <p>
              MORPH can read this bundle and rebuild its internal data tree without keeping a hidden
              copy of the original JSON. It reports file integrity, data recovery, and model-quality
              evidence separately because one does not prove the others.
            </p>
          </div>
        </section>

        <section className="paper-section paper-token-section" aria-labelledby="tokens-title">
          <div className="paper-section-label">06 / Measurement</div>
          <div className="paper-prose">
            <h2 id="tokens-title">Count everything the model would see.</h2>
            <p className="paper-lead">
              A tokenizer is the rule set that splits text into the tokens a model processes. MORPH
              assembles the instructions, data description, arranged data, task, and surrounding
              text first. Then it counts that complete result in one pass.
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
              the visible text under that recorded tokenizer version. It is not automatically an
              exact provider request count, a bill, or proof that a particular model uses the same
              rules. MORPH leaves unknown information labeled as unknown.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="policy-paper-title">
          <div className="paper-section-label">07 / Choosing</div>
          <div className="paper-prose">
            <h2 id="policy-paper-title">
              The selection mode decides how cautious MORPH should be.
            </h2>
            <div className="paper-policy-grid">
              <article>
                <span>Default</span>
                <h3>Compatibility</h3>
                <p>
                  Stay with familiar compact JSON unless matching model evidence supports another
                  layout.
                </p>
              </article>
              <article>
                <span>Opt in</span>
                <h3>Experimental savings</h3>
                <p>
                  The smallest fully recoverable prompt may win, with model understanding marked
                  untested.
                </p>
              </article>
              <article>
                <span>Evidence required</span>
                <h3>Validated</h3>
                <p>A non-JSON choice needs a matching set of qualified model-test results.</p>
              </article>
            </div>
            <p>
              MORPH ranks prompt size only after a layout fits the data, rebuilds it correctly,
              includes everything it needs, satisfies the chosen evidence rule, and fits the token
              budget. An explicitly requested format still has to pass those checks. If nothing
              fits, MORPH returns a clear error instead of cutting off data.
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
            <h2 id="paper-evidence-title">MORPH has measured data recovery and prompt size.</h2>
            <p className="paper-lead">
              Quality evidence means recorded tests of whether a particular model can answer the
              same tasks correctly from a particular layout. Those model tests have not been run, so
              MORPH does not claim better answers or equal accuracy.
            </p>
            <div className="paper-metrics">
              <article>
                <strong>130</strong>
                <span>automated tests passed</span>
                <small>24 files, 0 failed, 0 skipped</small>
              </article>
              <article>
                <strong>5,000+</strong>
                <span>successful data rebuild checks</span>
                <small>repeatable generated cases, seed 20260921</small>
              </article>
              <article>
                <strong>70 / 73</strong>
                <span>format cases passed</span>
                <small>3 correctly skipped because the layout did not fit, 0 failed</small>
              </article>
              <article>
                <strong>61</strong>
                <span>complete prompts measured</span>
                <small>9 fixtures, 58 eligible</small>
              </article>
              <article className="paper-metric-caution">
                <strong>Not tested</strong>
                <span>model answer quality</span>
                <small>No live model calls or qualified accuracy results</small>
              </article>
            </div>
            <div className="paper-case-study">
              <div>
                <p className="eyebrow">A useful non-win</p>
                <h3>JSON Lines was smaller, and compact JSON still won.</h3>
                <p>
                  On the customer comparison fixture, JSON Lines measured 884 tokens and compact
                  JSON measured 896. The 12-token saving was only 1.339 percent, below MORPH's
                  minimum improvement rules of 16 tokens and 2 percent. Compact JSON remained
                  selected because the saving was real but too small to justify switching.
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
              A separate made-up sequence dataset measured Column JSON at 704 tokens versus 736 for
              compact JSON, a 32-token reduction. This tells us about that prompt under this token
              counter. It does not tell us whether a model answers better, or promise the same
              saving on other data.
            </p>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="security-title">
          <div className="paper-section-label">09 / Security</div>
          <div className="paper-prose">
            <h2 id="security-title">The public workbench processes your input in the browser.</h2>
            <p className="paper-lead">
              When you use the workbench on this site, your JSON is processed inside your browser
              tab. It is not uploaded to a MORPH server, saved by the site, or sent to an AI model.
            </p>
            <ul className="paper-rule-list">
              <li>The compiler itself does not need a network connection or an account.</li>
              <li>Data values, descriptions, and field names are treated as untrusted content.</li>
              <li>
                Changing the layout does not remove prompt-injection risk or make content trusted.
              </li>
              <li>
                MORPH does not fetch remote data definitions or run code from an imported result.
              </li>
              <li>
                Size, nesting, item-count, layout-count, output-size, and time limits protect the
                browser.
              </li>
              <li>Your input, task, and theme choice are not stored by the site.</li>
            </ul>
            <p>
              Current safeguards include a 5 MiB input limit, nesting depth 64, 250,000 data nodes,
              24 possible layouts, a 16 MiB rendered-text limit per layout, and a five-second
              planning limit. Canceling does not create a partly finished result that looks valid.
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
            <h2 id="current-title">What MORPH can do today.</h2>
            <div className="current-state-grid">
              <article>
                <span>Working now</span>
                <h3>Complete comparison engine</h3>
                <p>
                  It accepts JSON, studies its shape, tries legal layouts, rebuilds the data, checks
                  integrity, measures full prompts, and makes a repeatable selection.
                </p>
              </article>
              <article>
                <span>Working now</span>
                <h3>Browser and developer tools</h3>
                <p>
                  This site runs the real compiler in your browser. The project also includes a
                  TypeScript toolkit, a command-line tool, and repeatable test and measurement
                  suites.
                </p>
              </article>
              <article>
                <span>Measured now</span>
                <h3>Prompt size for o200k_base</h3>
                <p>
                  It counts each complete rendered prompt, shows the difference from compact JSON,
                  applies a token budget, and provides a saved result that can be checked again.
                </p>
              </article>
              <article className="current-state-later">
                <span>Not tested yet</span>
                <h3>Model answer quality</h3>
                <p>
                  MORPH has not yet run a qualified study showing that models answer equally well
                  from the alternative layouts. It also does not claim provider billing totals.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="limits-title">
          <div className="paper-section-label">11 / Limits</div>
          <div className="paper-prose">
            <h2 id="limits-title">The promise is intentionally focused.</h2>
            <p className="paper-lead">
              MORPH does not promise one layout will always win, a fixed token saving, better model
              reasoning, safe prompt content, or a cheaper provider bill. It does not answer the
              task itself, train a model, or guess business meaning that was not supplied.
            </p>
            <p>
              More compact dictionaries, special handling for missing fields, shared definition
              storage, and optional planning services remain separate extensions. Before MORPH can
              call an alternative layout quality-qualified, it needs matched tests for the model,
              task, prompt guide, token counter, and exact layout being used.
            </p>
          </div>
        </section>

        <section className="white-paper-cta" aria-labelledby="paper-cta-title">
          <div>
            <p className="eyebrow">See it for yourself</p>
            <h2 id="paper-cta-title">Try the same process on a ready-made example.</h2>
            <p>
              Open the workbench to compare layouts in your browser, or download the 23-page
              technical paper for implementation, evaluation, and reproduction details.
            </p>
          </div>
          <div className="white-paper-cta-actions">
            <a className="button primary" href="/morph-white-paper-v0.1.pdf" download>
              Technical PDF, 23 pages
            </a>
            <a className="button secondary" href="/#compiler">
              Try the workbench <span aria-hidden="true">↗</span>
            </a>
            <a className="text-button" href="/">
              Return to MORPH
            </a>
          </div>
        </section>
      </main>

      <footer className="app-footer white-paper-footer">
        <p>
          MORPH keeps data recovery, prompt measurement, and model understanding separate. This
          paper documents what works today and what still needs evidence.
        </p>
        <span>v0.1 · runs in your browser · model quality not tested</span>
      </footer>
    </div>
  );
}
