const capabilities = [
  {
    title: "Research Intelligence",
    description:
      "Explore literature, map evidence, and turn complex scientific questions into structured research directions.",
  },
  {
    title: "Innovation Studio",
    description:
      "Shape early ideas into testable projects, milestones, opportunity maps, and collaboration plans.",
  },
  {
    title: "EYRA AI Companion",
    description:
      "A transparent research and innovation copilot designed to support—not replace—expert judgment.",
  },
];

export default function Home() {
  return (
    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow">AI research & innovation platform</div>
        <h1 id="hero-title">Build research. Build startups. Build impact.</h1>
        <p className="hero-copy">
          EYLO connects scientific discovery, project design, collaboration,
          and responsible AI in one open platform for researchers and builders.
        </p>
        <div className="hero-actions">
          <a className="button" href="#platform">Explore the platform</a>
          <a className="button button-secondary" href="/dashboard">Open dashboard</a>
        </div>
        <div className="signal-grid" aria-label="Platform principles">
          <div><strong>Evidence-led</strong><span>Grounded workflows</span></div>
          <div><strong>Human-centered</strong><span>Expert control</span></div>
          <div><strong>Open by design</strong><span>Auditable foundations</span></div>
        </div>
      </section>

      <section className="section" id="platform" aria-labelledby="platform-title">
        <div className="section-heading">
          <div className="eyebrow">One operating system</div>
          <h2 id="platform-title">From a question to a credible plan</h2>
          <p>
            EYLO is being developed as a modular environment for scientific
            discovery, innovation management, and AI-assisted decision support.
          </p>
        </div>
        <div className="card-grid">
          {capabilities.map((capability, index) => (
            <article className="card" key={capability.title}>
              <span className="card-number">0{index + 1}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="research" aria-labelledby="research-title">
        <div>
          <div className="eyebrow">Responsible AI</div>
          <h2 id="research-title">Designed for traceable reasoning</h2>
        </div>
        <div className="prose">
          <p>
            The platform vision prioritizes source transparency, clear uncertainty,
            reproducible workflows, privacy-aware defaults, and explicit human review.
          </p>
          <p>
            AI-generated outputs should be treated as decision support and verified
            against primary evidence before scientific, clinical, legal, or commercial use.
          </p>
        </div>
      </section>

      <section className="section open-source" id="open-source" aria-labelledby="oss-title">
        <div>
          <div className="eyebrow">Open source</div>
          <h2 id="oss-title">Build EYLO in public</h2>
          <p>
            The repository is the foundation for an open, extensible platform with
            accessible interfaces, secure defaults, and clear documentation.
          </p>
        </div>
        <a className="button button-light" href="https://github.com/panagiotagrosdouli/eyloai">
          Explore the repository
        </a>
      </section>
    </main>
  );
}
