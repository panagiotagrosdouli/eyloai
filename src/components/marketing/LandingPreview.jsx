import { useRef, useState } from "react";
import {
  BookOpen,
  Bookmark,
  BriefcaseBusiness,
  Check,
  FileText,
  FolderOpen,
  Layers3,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";

const tabs = [
  { id: "discover", label: "Discover", icon: Search },
  { id: "workspace", label: "Workspace", icon: FolderOpen },
  { id: "eyra", label: "EYRA", icon: Sparkles },
];
const discoveries = [
  {
    title: "Scholarly publications",
    description: "Follow the evidence to its source",
    icon: FileText,
  },
  {
    title: "Researchers & institutions",
    description: "Explore the people behind the work",
    icon: UsersRound,
  },
  {
    title: "Research opportunities",
    description: "Find a direction worth exploring",
    icon: BriefcaseBusiness,
  },
];

export default function LandingPreview() {
  const [active, setActive] = useState("discover");
  const buttons = useRef([]);
  function navigateTabs(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  }
  return (
    <figure className="relative min-w-0 py-5 lg:py-12">
      <div
        className="pointer-events-none absolute -right-[8%] top-0 h-[60%] w-[72%] rounded-[70px] bg-[var(--company-tint)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-2 -left-[6%] h-[45%] w-[65%] rounded-[70px] bg-[var(--company-soft)]"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--company-border)] bg-[var(--company-surface)] shadow-[0_24px_75px_-25px_rgba(23,42,64,.25)]">
        <div className="flex h-10 items-center justify-between border-b border-[var(--company-border)] bg-[var(--company-soft)] px-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-2 w-2 rounded-full bg-[var(--company-soft)]"
              />
            ))}
          </div>
          <span className="text-[10px] font-medium tracking-wide text-[var(--company-muted)]">
            ONE CONNECTED WORKSPACE
          </span>
        </div>
        <div className="grid sm:grid-cols-[126px_minmax(0,1fr)]">
          <aside
            className="hidden border-r border-[var(--company-border)] bg-[var(--company-soft)] px-3 py-6 sm:block"
            aria-hidden="true"
          >
            <img
              src={import.meta.env.BASE_URL + "brand/eylo-light.svg"}
              alt=""
              width="103"
              height="31"
              className="company-brand mb-7 h-8 w-full object-contain object-left"
            />
            {tabs.map(({ id, label, icon: Icon }) => (
              <div
                key={id}
                className={`mb-2 flex items-center gap-2 rounded-lg px-2 py-2.5 text-[11px] ${active === id ? "bg-[var(--company-tint)] font-semibold text-[var(--company-muted)]" : "text-[var(--company-muted)]"}`}
              >
                <Icon size={14} />
                {label}
              </div>
            ))}
            <div className="mt-7 border-t border-[var(--company-border)] pt-4 text-[10px] text-[var(--company-muted)]">
              <span className="flex items-center gap-2">
                <Bookmark size={13} /> Your library
              </span>
            </div>
          </aside>
          <div className="min-w-0 px-4 pb-6 pt-4 sm:px-6">
            <div
              role="tablist"
              aria-label="Explore the EYLO preview"
              className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-[var(--company-soft)] p-1"
            >
              {tabs.map(({ id, label }, index) => (
                <button
                  key={id}
                  ref={(element) => {
                    buttons.current[index] = element;
                  }}
                  id={`preview-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={active === id}
                  aria-controls={`preview-panel-${id}`}
                  tabIndex={active === id ? 0 : -1}
                  onClick={() => setActive(id)}
                  onKeyDown={(event) => navigateTabs(event, index)}
                  className={`min-h-9 rounded-md px-2 text-[11px] font-semibold transition sm:text-xs ${active === id ? "bg-[var(--company-surface)] text-[var(--company-muted)] shadow-sm" : "text-[var(--company-muted)] hover:text-[var(--company-ink)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tabs.map(({ id }) => (
              <div
                key={id}
                id={`preview-panel-${id}`}
                role="tabpanel"
                aria-labelledby={`preview-tab-${id}`}
                hidden={active !== id}
                tabIndex={0}
                className="min-h-[340px] outline-offset-4"
              >
                {id === "discover" && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--company-muted)]">
                      Find your starting point
                    </p>
                    <h2 className="mt-2 text-[25px] font-bold leading-tight tracking-[-.05em]">
                      Discover research
                    </h2>
                    <div className="my-5 flex items-center gap-2 rounded-lg border border-[var(--company-border)] px-3 py-3 text-[11px] text-[var(--company-muted)]">
                      <Search size={15} aria-hidden="true" /> Start with a
                      question or a topic
                    </div>
                    <div className="mb-5 flex flex-wrap gap-1.5">
                      {["Health", "Climate", "Education"].map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-[var(--company-soft)] px-2.5 py-1.5 text-[10px] text-[var(--company-muted)]"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-[var(--company-border)]">
                      {discoveries.map(({ title, description, icon: Icon }) => (
                        <div
                          key={title}
                          className="flex items-center gap-3 border-b border-[var(--company-border)] p-3 last:border-0"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--company-tint)] text-[var(--company-muted)]">
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold">{title}</p>
                            <p className="mt-0.5 text-[10px] leading-4 text-[var(--company-muted)]">
                              {description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {id === "workspace" && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--company-muted)]">
                      Your private workspace
                    </p>
                    <h2 className="mt-2 text-[25px] font-bold leading-tight tracking-[-.05em]">
                      Keep the thread.
                    </h2>
                    <p className="mt-3 text-xs leading-5 text-[var(--company-muted)]">
                      Give your sources, notes and next steps a place to belong.
                    </p>
                    <div className="mt-5 rounded-xl border border-[var(--company-border)] bg-[var(--company-soft)] p-4">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--company-muted)]">
                        Example project
                      </span>
                      <p className="mt-2 text-sm font-semibold">
                        My literature review
                      </p>
                      <div className="mt-4 space-y-3">
                        {[
                          {
                            icon: BookOpen,
                            label: "A library of saved sources",
                          },
                          {
                            icon: FileText,
                            label: "Notes that connect your ideas",
                          },
                          {
                            icon: Check,
                            label: "A clear plan for what comes next",
                          },
                        ].map(({ icon: Icon, label }) => (
                          <div
                            key={label}
                            className="flex items-center gap-2.5 rounded-lg bg-[var(--company-surface)] p-2.5 text-[11px] text-[var(--company-muted)]"
                          >
                            <Icon size={15} aria-hidden="true" />
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {id === "eyra" && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--company-muted)]">
                      The intelligence behind EYLO
                    </p>
                    <h2 className="mt-2 text-[25px] font-bold leading-tight tracking-[-.05em]">
                      Think it through.
                    </h2>
                    <div className="mt-4 overflow-hidden rounded-xl bg-[#050712]">
                      <img
                        src={import.meta.env.BASE_URL + "brand/eyra.png"}
                        alt="EYRA"
                        width="1024"
                        height="683"
                        loading="lazy"
                        decoding="async"
                        className="h-28 w-full object-cover"
                      />
                    </div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--company-muted)]">
                      A question you could ask
                    </p>
                    <blockquote className="mt-2 rounded-xl border border-[var(--company-border)] bg-[var(--company-soft)] p-4 text-xs leading-6">
                      “Help me turn my research question into a reading plan.”
                    </blockquote>
                    <p className="mt-3 text-[11px] leading-5 text-[var(--company-muted)]">
                      Work with context. Review the sources. Choose your next
                      step.
                    </p>
                  </>
                )}
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 border-t border-[var(--company-border)] pt-3 text-[10px] text-[var(--company-muted)]">
              <Layers3 size={13} aria-hidden="true" /> Discovery, thinking and
              progress. Connected.
            </div>
          </div>
        </div>
      </div>
      <figcaption className="relative mt-4 text-center text-[11px] leading-5 text-[var(--company-muted)]">
        Illustrative product preview. Explore EYLO to use the platform.
      </figcaption>
    </figure>
  );
}
