const REPOSITORY_BASE = "https://github.com/Zen-ctrl/morph/blob/main";

const FORMATS = [
  {
    index: "01",
    name: "Compact JSON",
    status: "baseline",
    scope: "Every accepted IR",
    body: "Strict JSON with exact numeric lexemes and no unnecessary structural whitespace. It is the compatibility anchor for every comparison.",
  },
  {
    index: "02",
    name: "JSON Lines",
    status: "native",
    scope: "Root arrays",
    body: "One compact JSON value per physical line, wrapped with enough framing to preserve the root type and element count.",
  },
  {
    index: "03",
    name: "Typed rows",
    status: "native",
    scope: "Uniform primitive records",
    body: "A deterministic field declaration plus typed scalar cells. Tabs, commas, pipes, and semicolons are parsed only outside quoted JSON strings.",
  },
  {
    index: "04",
    name: "Column JSON",
    status: "native",
    scope: "Uniform primitive records",
    body: "One JSON array per field. Row alignment and source order are retained while the physical layout shifts toward comparisons across records.",
  },
  {
    index: "05",
    name: "Typed paths",
    status: "native",
    scope: "Every accepted IR",
    body: "JSON Pointer paths plus explicit node types. Empty containers, exact numbers, object keys, array positions, and nulls stay distinct.",
  },
  {
    index: "06",
    name: "Official TOON",
    status: "gated adapter",
    scope: "Only preservation-safe inputs",
    body: "The official implementation is used behind a strict applicability gate. If a number lexeme cannot survive, native formats remain available.",
  },
] as const;

const PIPELINE = [
  ["01", "Accept", "Strict JSON text or a documented JavaScript-value subset."],
  ["02", "Model", "Build a tagged IR and retain number lexemes before conversion."],
  ["03", "Profile", "Measure shape, uniformity, missingness, depth, and bounded statistics."],
  ["04", "Enumerate", "Generate a stable, capped set of legal physical plans."],
  ["05", "Verify", "Encode, decode, and reconstruct from the self-contained bundle."],
  ["06", "Measure", "Tokenize the complete rendered text, not isolated payload pieces."],
  ["07", "Gate", "Apply compatibility, evidence, resource, and prompt-budget rules."],
  ["08", "Explain", "Return the selected artifact and deterministic reason codes."],
] as const;

const DOCS = [
  [
    "Architecture",
    "Compiler ownership, dependency direction, and the offline execution path.",
    "docs/architecture.md",
  ],
  [
    "Semantic contract",
    "Accepted inputs, exact number handling, equality, Unicode, and rejection rules.",
    "docs/semantics.md",
  ],
  [
    "Artifact and formats",
    "Framing grammar, codec versions, validation, and compatibility rules.",
    "docs/format.md",
  ],
  [
    "TypeScript API",
    "Registry composition, compiler methods, request contracts, and error behavior.",
    "docs/api.md",
  ],
  [
    "Command line",
    "Implemented commands, exit codes, file safety, examples, and counting scope.",
    "docs/cli.md",
  ],
  [
    "Benchmarking",
    "Corpus design, token methodology, quality qualification, and reproduction.",
    "docs/benchmarking.md",
  ],
  [
    "Security",
    "Trust boundaries, resource limits, network policy, privacy, and hostile content.",
    "docs/security.md",
  ],
  [
    "Dependencies",
    "Pinned versions, licenses, tokenizer assets, and integration status.",
    "docs/dependencies.md",
  ],
  [
    "Release evidence",
    "Actual commands, pass counts, limitations, and publication state.",
    "RELEASE_REPORT.md",
  ],
  [
    "Project website",
    "Information architecture, claim sources, asset provenance, and deployment boundary.",
    "docs/website.md",
  ],
  ["Full specification", "The complete v0.1.0 product and engineering contract.", "SPEC.md"],
] as const;

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
}): React.JSX.Element {
  return (
    <header className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </header>
  );
}

export function TruthStrip(): React.JSX.Element {
  return (
    <section className="truth-strip" aria-label="Current project evidence">
      <article>
        <span>01 / Preservation</span>
        <strong>Verified locally</strong>
        <p>Full semantic round trip from the self-contained model bundle.</p>
      </article>
      <article>
        <span>02 / Token count</span>
        <strong>Exact for o200k_base</strong>
        <p>Complete visible rendered text under the recorded tokenizer revision.</p>
      </article>
      <article className="truth-caution">
        <span>03 / Model quality</span>
        <strong>Not run</strong>
        <p>No accuracy claim, quality profile, or universal winner is bundled.</p>
      </article>
      <article>
        <span>04 / Runtime</span>
        <strong>Local and offline</strong>
        <p>No account, API key, upload, analytics, or hidden model call.</p>
      </article>
    </section>
  );
}

export function DossierBeforeWorkbench(): React.JSX.Element {
  return (
    <>
      <TruthStrip />

      <section
        className="dossier-section use-case-section"
        id="use-case"
        aria-labelledby="use-case-title"
      >
        <div className="section-number" aria-hidden="true">
          01
        </div>
        <div>
          <SectionHeading
            eyebrow="The practical problem"
            title="One dataset. Different questions. No missing pieces."
            body="A model handoff has both a logical meaning and a physical layout. MORPH is the compiler between them. It can change how complete data is arranged without pretending that projection, aggregation, or summarization is lossless encoding."
          />
          <div className="principle-grid">
            <article>
              <span className="principle-label">Re-encoding</span>
              <h3>Same information, different physical plan</h3>
              <p>Rows, columns, paths, and compact JSON may express the same accepted IR.</p>
            </article>
            <article className="principle-no">
              <span className="principle-label">Not projection</span>
              <h3>Task hints never authorize data removal</h3>
              <p>Every accepted field, row, duplicate, and array position remains recoverable.</p>
            </article>
          </div>
        </div>
        <section
          className="use-case-board"
          aria-label="Two tasks over one complete customer dataset"
        >
          <div className="dataset-window">
            <div className="window-bar">
              <span>customers.json</span>
              <span>complete dataset</span>
            </div>
            <pre>{`[
  {"id":"c1","country":"US","revenue":129},
  {"id":"c2","country":"CA","revenue":85},
  {"id":"c3","country":"US","revenue":220}
]`}</pre>
          </div>
          <div className="task-fork" aria-hidden="true">
            <span />
            <b>same data</b>
            <span />
          </div>
          <div className="task-card-row">
            <article>
              <span>Task A</span>
              <strong>Find customer c2.</strong>
              <p>Entity lookup hint</p>
            </article>
            <article>
              <span>Task B</span>
              <strong>Compare revenue by customer.</strong>
              <p>Multi-entity comparison hint</p>
            </article>
          </div>
          <p className="board-note">
            The selected layouts may differ. The source semantics do not.
          </p>
        </section>
      </section>

      <section className="invariant-section" aria-labelledby="invariant-title">
        <div>
          <p className="eyebrow">The central invariant</p>
          <h2 id="invariant-title">Preservation is a gate, not a score.</h2>
        </div>
        <code>semanticEqual(decode(encode(input)), input) == true</code>
        <p>
          MORPH also parses the model-facing bundle and reconstructs the IR without an undisclosed
          copy of the original. A failed round trip is a bug signal, never an optimization trade.
        </p>
      </section>

      <section
        className="dossier-section pipeline-section"
        id="compiler-contract"
        aria-labelledby="pipeline-title"
      >
        <div className="section-number" aria-hidden="true">
          02
        </div>
        <SectionHeading
          eyebrow="Compiler contract"
          title="Every candidate earns its place."
          body="Search is deterministic and bounded. Every finalist used for selection is encoded, decoded, framed, reconstructed, and measured before policy chooses among eligible plans."
        />
        <ol className="pipeline-list">
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
      </section>

      <section
        className="dossier-section format-section"
        id="formats"
        aria-labelledby="formats-title"
      >
        <div className="section-number" aria-hidden="true">
          03
        </div>
        <SectionHeading
          eyebrow="Representation atlas"
          title="Five native targets and one carefully gated adapter."
          body="Applicability is explicit. Familiar JSON is always measured as the baseline, and unfamiliar formats include the guide and metadata needed to interpret them."
        />
        <div className="format-grid">
          {FORMATS.map((format) => (
            <article key={format.index}>
              <div className="format-topline">
                <span>{format.index}</span>
                <b>{format.status}</b>
              </div>
              <h3>{format.name}</h3>
              <p>{format.body}</p>
              <footer>{format.scope}</footer>
            </article>
          ))}
        </div>
      </section>

      <section className="workbench-intro" aria-labelledby="workbench-title">
        <div>
          <p className="eyebrow">The instrument</p>
          <h2 id="workbench-title">Try the actual compiler.</h2>
        </div>
        <p>
          Edit a synthetic dataset, choose a policy, and run a real comparison in a browser worker.
          The table shows measured candidates, ineligibility reasons, reconstruction, and the exact
          context that would be handed to a model.
        </p>
      </section>
    </>
  );
}

export function DossierAfterWorkbench(): React.JSX.Element {
  return (
    <>
      <section
        className="dossier-section evidence-section"
        id="proof"
        aria-labelledby="evidence-title"
      >
        <div className="section-number" aria-hidden="true">
          04
        </div>
        <SectionHeading
          eyebrow="Evidence center"
          title="Three layers. Only two have been measured."
          body="Codec conformance, prompt efficiency, and downstream task quality answer different questions. MORPH keeps them separate even when a smaller number would make a better headline."
        />

        <div className="evidence-ladder">
          <article data-state="verified">
            <span>Layer A</span>
            <strong>Codec conformance</strong>
            <b>Verified</b>
            <p>Can the software recover the exact documented data semantics?</p>
          </article>
          <article data-state="measured">
            <span>Layer B</span>
            <strong>Prompt efficiency</strong>
            <b>Measured</b>
            <p>How many tokens are in the complete render under one named tokenizer?</p>
          </article>
          <article data-state="unknown">
            <span>Layer C</span>
            <strong>Model task quality</strong>
            <b>Not run</b>
            <p>Does a target model answer matched tasks correctly from each layout?</p>
          </article>
        </div>

        <div className="evidence-ledger">
          <section className="metrics-grid" aria-label="Version 0.1 local release evidence">
            <article>
              <strong>70</strong>
              <span>conformance cases passed</span>
              <small>0 failed · 3 correctly inapplicable</small>
            </article>
            <article>
              <strong>5,000+</strong>
              <span>native bundle round trips</span>
              <small>seeded extended property suite</small>
            </article>
            <article>
              <strong>61</strong>
              <span>complete prompts measured</span>
              <small>9 synthetic fixtures · 58 eligible</small>
            </article>
            <article>
              <strong>7 / 7</strong>
              <span>tokenizer oracle matches</span>
              <small>official Python tiktoken oracle</small>
            </article>
          </section>

          <article className="decision-story">
            <div className="story-heading">
              <div>
                <p className="eyebrow">A useful non-win</p>
                <h3>Smaller did not automatically win.</h3>
              </div>
              <span>customers comparison fixture</span>
            </div>
            <table>
              <caption>Complete rendered text under local-o200k-base</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Tokens</th>
                  <th scope="col">Delta</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Compact JSON</th>
                  <td>896</td>
                  <td>baseline</td>
                  <td>
                    <strong>Selected</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">JSON Lines</th>
                  <td>884</td>
                  <td>-12</td>
                  <td>Below 16-token and 2% threshold</td>
                </tr>
              </tbody>
            </table>
            <p>
              Another synthetic sequence fixture measured Column JSON at 704 tokens versus 736 for
              compact JSON. That is tokenizer evidence only. Model comprehension remains untested.
            </p>
          </article>
        </div>
        <p className="evidence-footnote">
          v0.1 local release snapshot · September 22, 2026 · synthetic fixtures · exact for the
          recorded o200k_base tokenizer and rendered-text scope · not provider billing evidence
        </p>
      </section>

      <section className="policy-section" id="policy" aria-labelledby="policy-title">
        <SectionHeading
          eyebrow="Selection policy"
          title="Optimization has an authority model."
          body="A reversible candidate can still be ineligible. Policy controls when missing model-quality evidence requires JSON, permits an experiment, or requires a matching qualification profile."
        />
        <div className="policy-grid">
          <article>
            <span>Default</span>
            <h3>Compatibility</h3>
            <p>
              Compact JSON stays selected when no applicable quality evidence exists. Alternatives
              remain visible for inspection.
            </p>
          </article>
          <article>
            <span>Opt in</span>
            <h3>Economy experimental</h3>
            <p>
              The smallest reversible eligible render may win, while model comprehension remains
              explicitly unverified.
            </p>
          </article>
          <article>
            <span>Evidence bound</span>
            <h3>Validated</h3>
            <p>
              A nonbaseline format needs a matching quality profile for the model, task family,
              guide, renderer, and options.
            </p>
          </article>
        </div>
      </section>

      <section
        className="dossier-section quickstart-section"
        id="quickstart"
        aria-labelledby="quickstart-title"
      >
        <div className="section-number" aria-hidden="true">
          05
        </div>
        <SectionHeading
          eyebrow="Developer entry points"
          title="Use the SDK, the CLI, or the browser."
          body="The compiler runs locally after dependencies and tokenizer assets are installed. Packages remain private in this v0.1 repository, so examples run from the workspace rather than a public npm package."
        />
        <div className="code-grid">
          <article>
            <header>
              <span>CLI</span>
              <small>complete comparison</small>
            </header>
            <pre>
              <code>{`pnpm morph compare \\
  --input fixtures/examples/customers.json \\
  --task-file fixtures/examples/lookup.task.txt \\
  --target local-o200k-base \\
  --policy compatibility`}</code>
            </pre>
          </article>
          <article>
            <header>
              <span>TypeScript</span>
              <small>composed local SDK</small>
            </header>
            <pre>
              <code>{`import { createDefaultMorph } from "@morph/sdk";

const morph = createDefaultMorph();
const result = await morph.compare({
  data: { kind: "json-text", text },
  task: { instruction: "Find customer c2." },
  target: localTarget,
  constraints: { mode: "lossless" },
  planner: {
    policy: "compatibility",
    objective: "prompt-tokens"
  }
});`}</code>
            </pre>
          </article>
        </div>
      </section>

      <section className="boundary-section" id="boundaries" aria-labelledby="boundaries-title">
        <div className="boundary-copy">
          <p className="eyebrow">Trust boundary</p>
          <h2 id="boundaries-title">What MORPH refuses to blur.</h2>
          <p>
            A compact representation can still contain hostile instructions. A checksum can match
            while the content remains untrusted. A local token count can be exact for a vocabulary
            without being a provider billing count. Those distinctions stay visible in the API,
            reports, and workbench.
          </p>
        </div>
        <ul>
          <li>
            <span>01</span>
            <strong>No silent projection, filtering, aggregation, or truncation.</strong>
          </li>
          <li>
            <span>02</span>
            <strong>No tokenizer alias guessing or fake model binding.</strong>
          </li>
          <li>
            <span>03</span>
            <strong>No invented accuracy, confidence, pricing, or cache claims.</strong>
          </li>
          <li>
            <span>04</span>
            <strong>No automatic upload, telemetry, remote schema fetch, or paid call.</strong>
          </li>
          <li>
            <span>05</span>
            <strong>No claim that encoding neutralizes prompt injection.</strong>
          </li>
        </ul>
      </section>

      <section className="dossier-section docs-section" id="docs" aria-labelledby="docs-title">
        <div className="section-number" aria-hidden="true">
          06
        </div>
        <SectionHeading
          eyebrow="Documentation map"
          title="Follow the contract all the way down."
          body="The website is the guided tour. The repository documents remain the canonical engineering record, with grammar details, runtime contracts, reproduction commands, and explicit limitations."
        />
        <div className="docs-grid">
          {DOCS.map(([title, description, path], index) => (
            <a key={path} href={`${REPOSITORY_BASE}/${path}`} target="_blank" rel="noreferrer">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
                <code>{path}</code>
              </div>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      </section>

      <section className="release-note" aria-label="Current release position">
        <img src="/morph-wordmark.jpg" alt="" aria-hidden="true" />
        <div>
          <p className="eyebrow">Current position</p>
          <h2>Ready for controlled experimentation.</h2>
          <p>
            The local compiler, SDK, CLI, browser workbench, conformance suite, and token benchmark
            are real. Live model-quality evaluation, provider request accounting, and the Jev
            contract test are not run. That is the next evidence frontier, not a footnote.
          </p>
        </div>
        <a className="button primary" href="#compiler">
          Run a comparison <span aria-hidden="true">↑</span>
        </a>
      </section>
    </>
  );
}
