import { Link } from "react-router-dom";
import { buildRecordedProjectSignals } from "@/lib/project-recorded-signals.mjs";

export default function RecordedProjectSignals({ project, onOpenWorkplan }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const report = buildRecordedProjectSignals(project, today);
  const paths = {
    experiments: `/projects/${encodeURIComponent(project.id)}/research/experiments`,
    publications: `/projects/${encodeURIComponent(project.id)}/research/publications`,
    budget: `/projects/${encodeURIComponent(project.id)}/budget`,
  };
  return (
    <section
      aria-labelledby="recorded-signals-title"
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="recorded-signals-title" className="text-lg font-semibold">
        Saved-record project summary
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Calculated from this project’s saved records as of {today}. Unsaved
        edits and AI interpretations are excluded. These figures do not
        establish scientific quality or project success.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {report.signals.map((signal) => (
          <article
            key={signal.key}
            className="min-w-0 rounded-xl border border-border p-4"
          >
            <h3 className="text-xs font-semibold text-muted-foreground">
              {signal.label}
            </h3>
            <p className="mt-3 break-words text-lg font-semibold">
              {signal.value}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {signal.detail}
            </p>
            {signal.key === "workplan" ? (
              <button
                type="button"
                onClick={onOpenWorkplan}
                className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-primary underline underline-offset-4"
              >
                Open saved workplan
              </button>
            ) : (
              <Link
                to={paths[signal.key]}
                className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-primary underline underline-offset-4"
              >
                Open source workspace
              </Link>
            )}
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Source: your saved project snapshot
        {report.project_version
          ? ` · ${report.project_version}`
          : " · save time not recorded"}
        . Refresh the project after saving changes in another workspace.
      </p>
    </section>
  );
}
