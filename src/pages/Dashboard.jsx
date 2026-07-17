const modules = [
  { title: "EYRA Assistant", status: "Ready", description: "Ask questions, structure ideas, and plan your next research step." },
  { title: "Research Workspace", status: "Next", description: "Organize evidence, notes, sources, and research directions." },
  { title: "Innovation Studio", status: "Next", description: "Turn insights into hypotheses, experiments, and venture concepts." },
];

export default function Dashboard() {
  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a className="brand" href="/" aria-label="EYLO home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>EYLO AI</span>
        </a>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a className="active" href="/dashboard">Overview</a>
          <a href="#eyra">EYRA Assistant</a>
          <a href="#research">Research</a>
          <a href="#projects">Projects</a>
        </nav>
        <a className="dashboard-back" href="/">← Back to website</a>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <div className="eyebrow">Workspace overview</div>
            <h1>Welcome to EYLO.</h1>
            <p>One workspace for research, innovation, and responsible AI collaboration.</p>
          </div>
          <button className="button" type="button">New project</button>
        </header>

        <div className="dashboard-stats" aria-label="Workspace statistics">
          <article><span>Active projects</span><strong>0</strong></article>
          <article><span>Saved sources</span><strong>0</strong></article>
          <article><span>AI sessions</span><strong>0</strong></article>
        </div>

        <section aria-labelledby="modules-title">
          <div className="section-heading compact">
            <div className="eyebrow">Core modules</div>
            <h2 id="modules-title">Start building your workspace</h2>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.title}>
                <span className="module-status">{module.status}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <button type="button" className="text-button">Open module →</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
