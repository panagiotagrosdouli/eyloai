import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Compass, FolderOpen, Check } from "lucide-react";

const startingPoints = [
  {
    id: "review",
    label: "A literature review",
    icon: BookOpen,
    title: "Give your reading a direction.",
    body: "Start with a focused question. Explore relevant literature, follow the original sources and bring the useful evidence into your workspace.",
    question: "How does sleep affect learning?",
    query: "sleep and learning",
    steps: [
      "Explore related publications",
      "Check the original evidence",
      "Build your reading list and notes",
    ],
    action: "Explore this research question",
  },
  {
    id: "topic",
    label: "A new research topic",
    icon: Compass,
    title: "Find a way into something new.",
    body: "Turn a broad interest into a starting point. Discover the research and people around a topic, then use EYRA to help shape the questions you want to investigate.",
    question: "What can cities do about extreme heat?",
    query: "urban heat adaptation",
    steps: [
      "Discover the research landscape",
      "Explore researchers and institutions",
      "Shape your next question with EYRA",
    ],
    action: "Discover this topic",
  },
  {
    id: "project",
    label: "A project plan",
    icon: FolderOpen,
    title: "Give a promising idea a next step.",
    body: "Ground your idea in existing work. Bring sources, notes and tasks into a project so the next step stays connected to the question that started it.",
    question: "How can digital tools support language learning?",
    query: "digital tools language learning",
    steps: [
      "Find the evidence behind your idea",
      "Capture your thinking in notes",
      "Organize a project and its next tasks",
    ],
    action: "Find a starting point for this project",
  },
];

export default function ResearchStartingPoints() {
  const [selected, setSelected] = useState("review");
  const point = startingPoints.find((item) => item.id === selected);
  return (
    <section
      id="start-here"
      aria-labelledby="starting-points-title"
      className="scroll-mt-24 px-5 py-16 sm:px-9 sm:py-20 lg:px-16"
    >
      <div className="mx-auto max-w-[1350px] overflow-hidden rounded-[28px] bg-[#172A40] text-white">
        <div className="grid lg:grid-cols-[1fr_1.1fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#94D8FF]">
              What are you working on?
            </p>
            <h2
              id="starting-points-title"
              className="mt-5 max-w-md text-[clamp(2rem,3.5vw,3.4rem)] font-bold leading-[1.12] tracking-[-.055em]"
            >
              Bring a question.
              <br />
              Leave with a direction.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#C4D5E5]">
              See how EYLO fits the work you already want to do. Choose a
              starting point.
            </p>
            <div
              role="group"
              aria-label="Choose your research starting point"
              className="mt-8 grid gap-3"
            >
              {startingPoints.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected === id}
                  aria-controls="starting-point-detail"
                  onClick={() => setSelected(id)}
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${selected === id ? "border-[#96D9FF] bg-[#E9F6FF] text-[#172A40]" : "border-[#446078] bg-[#20384F] text-[#E2ECF5] hover:border-[#94D8FF] hover:bg-[#29465F]"}`}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {selected === id ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <ArrowRight size={17} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div
            id="starting-point-detail"
            aria-live="polite"
            aria-atomic="true"
            className="border-t border-white/15 bg-[#20384F] p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-12"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#94D8FF]">
              Your route through EYLO
            </p>
            <h3 className="mt-4 max-w-lg text-2xl font-semibold leading-tight tracking-[-.035em] sm:text-3xl">
              {point.title}
            </h3>
            <p className="mt-4 min-h-[84px] max-w-lg text-sm leading-7 text-[#D0DFEC]">
              {point.body}
            </p>
            <ol className="my-7 grid gap-4">
              {point.steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 text-sm text-[#E2ECF5]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#68849B] text-[11px] text-[#94D8FF]">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="rounded-2xl border border-[#627E95] bg-[#172A40] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#AEC5D8]">
                Try an example question
              </p>
              <p className="mt-3 text-lg font-medium leading-7">
                “{point.question}”
              </p>
              <Link
                to={`/discover?q=${encodeURIComponent(point.query)}`}
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#94D8FF] underline decoration-[#68849B] underline-offset-4 hover:text-white"
              >
                {point.action}
                <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#AEC5D8]">
              Opens a real search. Results depend on the available sources. No
              account needed to explore.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
