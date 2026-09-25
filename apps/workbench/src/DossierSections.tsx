const FORMATS = [
  {
    index: "01",
    name: "Compact JSON",
    status: "standard choice",
    scope: "Works with any supported JSON",
    body: "The familiar starting point. It keeps normal JSON, removes extra spacing, and preserves number spelling exactly.",
  },
  {
    index: "02",
    name: "JSON Lines",
    status: "built in",
    scope: "Best suited to top-level lists",
    body: "Puts each list item on its own line and includes the information needed to rebuild the original list.",
  },
  {
    index: "03",
    name: "Typed rows",
    status: "built in",
    scope: "Table-shaped data with simple values",
    body: 'Stores field names once, then lays out records as rows. Each cell keeps its original type, so 123 stays different from "123".',
  },
  {
    index: "04",
    name: "Column JSON",
    status: "built in",
    scope: "Table-shaped data with simple values",
    body: "Groups values by field instead of by record. Their positions still line up, so every original row can be rebuilt.",
  },
  {
    index: "05",
    name: "Typed paths",
    status: "built in",
    scope: "Works with any supported JSON",
    body: "Writes each value beside its full location in the data tree. This can make deeply nested information easier to trace.",
  },
  {
    index: "06",
    name: "Official TOON",
    status: "carefully limited",
    scope: "Only inputs it can preserve exactly",
    body: "An optional compact format from the official TOON package. MORPH skips it whenever exact recovery is uncertain.",
  },
] as const;

const PIPELINE = [
  ["01", "Read the data", "Accept the JSON and check that it is valid and within safe limits."],
  [
    "02",
    "Keep its meaning",
    "Record types, exact numbers, order, empty values, and nested structure.",
  ],
  [
    "03",
    "Learn its shape",
    "Notice whether it looks like a table, a nested tree, or something sparse.",
  ],
  ["04", "Try useful layouts", "Create a small, predictable set of formats that fit this data."],
  [
    "05",
    "Rebuild the original",
    "Decode each serious option and check that every value comes back.",
  ],
  [
    "06",
    "Count the full prompt",
    "Measure everything the model would receive, including instructions and labels.",
  ],
  [
    "07",
    "Apply the rules",
    "Check the chosen safety policy, available evidence, and token budget.",
  ],
  [
    "08",
    "Show the decision",
    "Return the winner, the alternatives, and a clear reason for each result.",
  ],
] as const;

const PUBLIC_GUIDE = [
  [
    "Why MORPH exists",
    "See the everyday problem MORPH is designed to solve.",
    "#use-case",
    "On this page",
  ],
  [
    "Formats it can try",
    "Meet the built-in layouts and learn when each one fits.",
    "#formats",
    "Format guide",
  ],
  [
    "Interactive workbench",
    "Use ready-made examples or paste JSON to see a real comparison.",
    "#compiler",
    "Runs in your browser",
  ],
  [
    "What the results mean",
    "Separate data recovery, prompt size, and model understanding.",
    "#proof",
    "Evidence guide",
  ],
  [
    "How MORPH chooses",
    "Compare the cautious default with the experimental option.",
    "#policy",
    "Selection guide",
  ],
  [
    "What MORPH will not do",
    "Review the boundaries around data removal, model claims, and uploads.",
    "#boundaries",
    "Honest limits",
  ],
  [
    "Read the white paper",
    "Go deeper into the design, evidence, and current limitations.",
    "/white-paper",
    "Read online",
  ],
  [
    "Keep the PDF",
    "Download the full white paper for reading or sharing later.",
    "/morph-white-paper-v0.1.pdf",
    "PDF download",
  ],
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
    <section className="truth-strip" aria-label="What MORPH can prove today">
      <article>
        <span>01 / Your data</span>
        <strong>Rebuilt and checked</strong>
        <p>MORPH decodes its result and confirms that the original meaning comes back.</p>
      </article>
      <article>
        <span>02 / Prompt size</span>
        <strong>Counted with a named token counter</strong>
        <p>The details identify o200k_base and measure the full text, not just the data block.</p>
      </article>
      <article className="truth-caution">
        <span>03 / Model understanding</span>
        <strong>Not tested yet</strong>
        <p>A smaller prompt is useful evidence, but it does not prove equally good answers.</p>
      </article>
      <article>
        <span>04 / This demo</span>
        <strong>Runs in your browser</strong>
        <p>Your input is not uploaded, saved, sent to a model, or used for analytics.</p>
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
            title="The same data can be arranged in more than one useful way."
            body="Most apps send structured data to a model in whatever format they already have. MORPH tries a few different layouts, checks that none of the information changed, and measures how much prompt space each layout uses."
          />
          <div className="principle-grid">
            <article>
              <span className="principle-label">Rearranging</span>
              <h3>Same information, different shape</h3>
              <p>
                A representation is simply the layout used to express the data, such as JSON, rows,
                columns, or paths.
              </p>
            </article>
            <article className="principle-no">
              <span className="principle-label">Never trimming</span>
              <h3>A helpful hint never becomes permission to drop data</h3>
              <p>
                Every accepted field, row, repeated value, and list position must still be
                recoverable.
              </p>
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
            The question travels with the comparison, but it never gives MORPH permission to drop
            data.
          </p>
        </section>
      </section>

      <section className="invariant-section" aria-labelledby="invariant-title">
        <div>
          <p className="eyebrow">The core promise</p>
          <h2 id="invariant-title">Every accepted value has to come back.</h2>
        </div>
        <code>semanticEqual(decode(encode(input)), input) == true</code>
        <p>
          In plain English, MORPH converts the data into a new layout, converts it back, and checks
          the result against what you supplied. If that round trip fails, the layout cannot win.
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
          eyebrow="How it works"
          title="Every option has to pass the same checks."
          body="MORPH follows the same repeatable process each time. It only compares a manageable set of layouts, and it fully checks every option that could be selected."
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
          eyebrow="The layouts MORPH can try"
          title="Five built-in formats, plus one carefully limited option."
          body="Not every layout fits every dataset. MORPH always measures familiar compact JSON as the starting point and adds the instructions needed to understand less familiar formats."
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
          <p className="eyebrow">Try it yourself</p>
          <h2 id="workbench-title">See a real comparison in your browser.</h2>
        </div>
        <p>
          Start with a ready-made example or paste your own JSON. MORPH will compare the layouts,
          show which ones preserved the data, and reveal the complete text that a model would see.
          Your input stays in this browser tab.
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
          eyebrow="What we know so far"
          title="MORPH keeps three different questions separate."
          body="Can the data be recovered? How large is the prompt? Will a model answer just as well? The first two are measured today. The third still needs real model testing."
        />

        <div className="evidence-ladder">
          <article data-state="verified">
            <span>Check 1</span>
            <strong>Data recovery</strong>
            <b>Verified</b>
            <p>Can MORPH rebuild the same accepted data from the new layout?</p>
          </article>
          <article data-state="measured">
            <span>Check 2</span>
            <strong>Prompt size</strong>
            <b>Measured</b>
            <p>How many tokens are in everything the model would receive?</p>
          </article>
          <article data-state="unknown">
            <span>Check 3</span>
            <strong>Model understanding</strong>
            <b>Not tested</b>
            <p>Does a particular model answer the same questions equally well from each layout?</p>
          </article>
        </div>

        <div className="evidence-ledger">
          <section className="metrics-grid" aria-label="Version 0.1 test results">
            <article>
              <strong>70</strong>
              <span>format checks passed</span>
              <small>0 failed · 3 correctly skipped because the format did not fit</small>
            </article>
            <article>
              <strong>5,000+</strong>
              <span>successful rebuild checks</span>
              <small>repeatable generated test cases</small>
            </article>
            <article>
              <strong>61</strong>
              <span>complete prompts measured</span>
              <small>9 made-up datasets · 58 layouts could be used</small>
            </article>
            <article>
              <strong>7 / 7</strong>
              <span>token-counter checks matched</span>
              <small>compared with the official tiktoken implementation</small>
            </article>
          </section>

          <article className="decision-story">
            <div className="story-heading">
              <div>
                <p className="eyebrow">A useful non-win</p>
                <h3>A slightly smaller prompt did not automatically win.</h3>
              </div>
              <span>customers comparison fixture</span>
            </div>
            <table>
              <caption>Complete prompt measured with the o200k_base token counter</caption>
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
              Another made-up sequence dataset measured Column JSON at 704 tokens versus 736 for
              compact JSON. A token is a small piece of text used by a model's text counter. This
              result tells us about prompt size, not answer quality.
            </p>
          </article>
        </div>
        <p className="evidence-footnote">
          v0.1 snapshot · September 22, 2026 · made-up test data · exact for the recorded o200k_base
          text counter · not a provider bill or a model-quality result
        </p>
      </section>

      <section className="policy-section" id="policy" aria-labelledby="policy-title">
        <SectionHeading
          eyebrow="How MORPH chooses"
          title="You decide how cautious the selection should be."
          body="A layout can preserve the data and still be too experimental for automatic use. The selection mode tells MORPH when to stay with familiar JSON and when it may choose a smaller option."
        />
        <div className="policy-grid">
          <article>
            <span>Default</span>
            <h3>Compatibility</h3>
            <p>
              Stay with familiar compact JSON unless solid, matching model evidence supports another
              choice. You can still inspect every alternative.
            </p>
          </article>
          <article>
            <span>Opt in</span>
            <h3>Experimental savings</h3>
            <p>
              Let the smallest fully recoverable prompt win, while clearly marking model
              understanding as untested.
            </p>
          </article>
          <article>
            <span>Evidence required</span>
            <h3>Validated</h3>
            <p>
              Only choose a non-JSON layout when a matching set of model-quality test results has
              been supplied.
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
          eyebrow="Built for real workflows"
          title="Explore in the browser, then automate with code or the command line."
          body="The workbench is the easiest place to understand MORPH. The same compiler also powers a TypeScript toolkit for applications and a command-line tool for repeatable file-based work. In the example below, local-o200k-base is the name of MORPH's built-in o200k_base token-counter profile."
        />
        <div className="code-grid">
          <article>
            <header>
              <span>CLI</span>
              <small>repeatable file comparison</small>
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
              <small>application toolkit</small>
            </header>
            <pre>
              <code>{`import { createDefaultMorph } from "@morph/sdk";

const morph = createDefaultMorph();
const result = await morph.compare({
  data: { kind: "json-text", text },
  task: { instruction: "Find customer c2." },
  target: tokenCounterProfile,
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
          <p className="eyebrow">The honest limits</p>
          <h2 id="boundaries-title">What MORPH does not pretend to do.</h2>
          <p>
            Rearranging data does not make unsafe content safe. Matching checksums do not make the
            content trustworthy. And a precise text count from one tokenizer, which is the set of
            rules that splits text into tokens, is not automatically the number on a provider bill.
            MORPH keeps those differences visible.
          </p>
        </div>
        <ul>
          <li>
            <span>01</span>
            <strong>No quietly dropping, filtering, combining, or cutting off data.</strong>
          </li>
          <li>
            <span>02</span>
            <strong>No guessing which token counter belongs to an unknown model.</strong>
          </li>
          <li>
            <span>03</span>
            <strong>No invented claims about accuracy, confidence, price, or caching.</strong>
          </li>
          <li>
            <span>04</span>
            <strong>No automatic upload, tracking, remote lookup, or paid model call.</strong>
          </li>
          <li>
            <span>05</span>
            <strong>No claim that a new layout removes prompt-injection risk.</strong>
          </li>
        </ul>
      </section>

      <section
        className="white-paper-teaser"
        id="white-paper"
        aria-labelledby="white-paper-teaser-title"
      >
        <div className="white-paper-teaser-copy">
          <p className="eyebrow">Want to go deeper?</p>
          <h2 id="white-paper-teaser-title">
            Read the public guide or dig into the technical paper.
          </h2>
          <p>
            The online version explains the idea in approachable language. The 23-page PDF covers
            implementation, formats, evaluation methods, security, and reproduction commands in more
            technical detail.
          </p>
          <div className="white-paper-teaser-actions">
            <a className="button primary" href="/white-paper">
              Read online <span aria-hidden="true">↗</span>
            </a>
            <a className="button secondary" href="/morph-white-paper-v0.1.pdf" download>
              Technical paper (PDF, 23 pages) <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className="white-paper-teaser-facts">
          <article>
            <span>Preservation</span>
            <strong>Verified</strong>
          </article>
          <article>
            <span>Prompt size</span>
            <strong>Measured</strong>
          </article>
          <article>
            <span>Model quality</span>
            <strong>Not tested</strong>
          </article>
        </div>
      </section>

      <section className="dossier-section docs-section" id="docs" aria-labelledby="docs-title">
        <div className="section-number" aria-hidden="true">
          07
        </div>
        <SectionHeading
          eyebrow="Keep exploring"
          title="Start simple, then go as deep as you want."
          body="Use this public guide to jump between the big idea, the working demo, the evidence, the limits, and the full white paper."
        />
        <div className="docs-grid">
          {PUBLIC_GUIDE.map(([title, description, href, label], index) => (
            <a key={href} href={href}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
                <code>{label}</code>
              </div>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      </section>

      <section className="release-note" aria-label="What MORPH can do today">
        <div className="release-emblem" aria-hidden="true">
          <b>M</b>
          <span>MORPH / 01</span>
        </div>
        <div>
          <p className="eyebrow">Where MORPH stands today</p>
          <h2>Working, measurable, and honest about what comes next.</h2>
          <p>
            The compiler, developer toolkit, command-line tool, browser workbench, recovery tests,
            and token measurements are working. Real model-answer testing has not been run yet, so
            MORPH does not claim that a smaller layout produces equally good answers.
          </p>
        </div>
        <a className="button primary" href="#compiler">
          Run a comparison <span aria-hidden="true">↑</span>
        </a>
      </section>
    </>
  );
}
