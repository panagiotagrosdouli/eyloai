import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  pendingProductOperation,
  PRODUCT_OPERATION_PREFIX,
  verifyProductOperationResult,
} from "@/lib/product-operation-recovery.mjs";
import { getUsableSession, requireSupabase } from "@/lib/supabaseClient";
import { invokeEyra } from "@/lib/eyra-intelligence";
import ProjectDocumentWorkspace, {
  downloadWorkspace,
  workspaceButton as button,
  workspaceInput as input,
} from "@/components/projects/ProjectDocumentWorkspace";
import {
  WORKBENCH_TOOLS,
  createWorkbenchRecord,
  parseFormDefinition,
  PRACTICE_QUESTIONS,
  previewWorkbenchRecord,
  readWorkbench,
  validateFormAnswers,
  validateWorkbenchRecord,
  workbenchPatch,
} from "@/lib/product-workbench.mjs";
const adapters = Object.fromEntries(
  Object.keys(WORKBENCH_TOOLS).map((tool) => [
    tool,
    {
      read: (project) => readWorkbench(project, tool),
      patch: (project, doc) => workbenchPatch(project, tool, doc),
      compare: (doc) =>
        doc.records
          .map((row) => `${row.title}\n${previewWorkbenchRecord(tool, row)}`)
          .join("\n\n"),
      loadExtras:
        tool === "spaces"
          ? async () => ({
              projects: await base44.entities.Project.list(
                "-updated_date",
                1000,
              ),
            })
          : null,
      beforeSave:
        tool === "spaces"
          ? async (_project, doc, extras) => {
              const ids = [
                ...new Set(doc.records.flatMap((row) => row.project_ids)),
              ];
              if (!ids.length) return extras;
              const session = await getUsableSession({
                required: true,
                validate: true,
              });
              const { data, error } = await requireSupabase()
                .from("projects")
                .select("id,user_id")
                .eq("user_id", session.user.id)
                .in("id", ids)
                .limit(50);
              if (error) throw error;
              if (
                data.length !== ids.length ||
                data.some(
                  (row) =>
                    row.user_id !== session.user.id || !ids.includes(row.id),
                )
              )
                throw new Error("A linked project is unavailable.");
              return extras;
            }
          : null,
    },
  ]),
);
export default function ProductWorkbench() {
  const { id, tool } = useParams();
  const config = Object.hasOwn(WORKBENCH_TOOLS, tool)
    ? WORKBENCH_TOOLS[tool]
    : null;
  if (!config) return <main className="eylo-page">Workspace unavailable.</main>;
  return (
    <ProjectDocumentWorkspace
      key={`${id}/${tool}`}
      id={id}
      title={config.title}
      description="Private project workspace. Review your draft, then save explicitly."
      {...adapters[tool]}
    >
      {(state) => <Editor {...state} tool={tool} />}
    </ProjectDocumentWorkspace>
  );
}
function Editor({
  tool,
  project,
  draft,
  setDraft,
  extras,
  busy,
  setPendingDraft,
  setError,
  setNotice,
}) {
  const { user } = useAuth();
  const config = WORKBENCH_TOOLS[tool],
    controller = useRef(null),
    alive = useRef(true),
    operation = useRef(null),
    start = useRef(0);
  const [row, setRow] = useState(null),
    [answers, setAnswers] = useState({}),
    [formId, setFormId] = useState(""),
    [acting, setActing] = useState(false),
    [ai, setAi] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    setPendingDraft(Boolean(row));
    return () => setPendingDraft(false);
  }, [row, setPendingDraft]);
  const open = (record) => {
    if (!row || window.confirm("Discard the open record draft?")) {
      setRow(structuredClone(record));
      setAi("");
      start.current = 0;
    }
  };
  const apply = (e) => {
    e.preventDefault();
    try {
      validateWorkbenchRecord(tool, row);
      const records = draft.records.some((r) => r.id === row.id)
        ? draft.records.map((r) => (r.id === row.id ? row : r))
        : [...draft.records, row];
      readWorkbench(
        { product_workbench: { [tool]: { ...draft, records } } },
        tool,
      );
      setDraft({ ...draft, records });
      setRow(null);
      setError("");
      setNotice("Draft updated. Save the workspace to persist it.");
    } catch (f) {
      setError(f.message);
    }
  };
  const materialize = async (record) => {
    if (
      !window.confirm(
        tool === "workflows"
          ? "Create the listed tasks in your private Life workspace?"
          : tool === "studio"
            ? "Create a new canonical Note from this saved document draft?"
            : "Create an all-day Calendar submission deadline from this saved record?",
      )
    )
      return;
    setActing(true);
    setError("");
    try {
      operation.current = await pendingProductOperation(
        window.sessionStorage,
        user.id,
        project.id,
        tool,
        record,
      );
      const rpc =
        tool === "workflows"
          ? "run_project_task_workflow"
          : "materialize_workbench_record";
      const args =
        tool === "workflows"
          ? {
              p_project_id: project.id,
              p_workflow_id: record.id,
              p_run_id: operation.current.id,
              p_expected_version: project.updated_date,
            }
          : {
              p_project_id: project.id,
              p_tool: tool,
              p_record_id: record.id,
              p_result_id: operation.current.id,
              p_expected_version: project.updated_date,
            };
      const { data, error } = await requireSupabase().rpc(rpc, args);
      if (error) throw error;
      verifyProductOperationResult(tool, operation.current, data);
      if (alive.current) {
        window.sessionStorage.removeItem(operation.current.key);
        operation.current = null;
        setNotice(
          "Records created in your workspace. Reload before another modification.",
        );
        setActing(false);
      }
    } catch (f) {
      if (alive.current) {
        setError(
          (f.message || "Action failed.") +
            " Retrying uses the same operation identity; do not assume a failed response means no records were saved.",
        );
        setActing(false);
      }
    }
  };
  const reviewAnswer = async () => {
    setActing(true);
    setError("");
    try {
      controller.current = new AbortController();
      const result = await invokeEyra({
        prompt: `Interview practice feedback. Use only the supplied goal/question/answer. Do not invent accomplishments or give a hiring score. Identify uncertainty and concrete improvement questions. Goal: ${row.role}\nQuestion: ${row.question}\nAnswer: ${row.answer}`,
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(45000),
        ]),
      });
      if (alive.current) setAi(String(result));
    } catch (f) {
      if (alive.current) setError(f.message);
    } finally {
      if (alive.current) setActing(false);
    }
  };
  const submitResponse = () => {
    try {
      const record = draft.records.find((r) => r.id === formId);
      const response = {
        id: crypto.randomUUID(),
        definition: record.definition,
        answers: validateFormAnswers(record.definition, answers),
        created_at: new Date().toISOString(),
      };
      const updated = { ...record, responses: [...record.responses, response] };
      validateWorkbenchRecord(tool, updated);
      setDraft({
        ...draft,
        records: draft.records.map((r) => (r.id === record.id ? updated : r)),
      });
      setFormId("");
      setAnswers({});
      setNotice("Response added to draft. Save Smart Forms to persist it.");
    } catch (f) {
      setError(f.message);
    }
  };
  const names = Object.fromEntries(
    (extras?.projects || []).map((p) => [p.id, p.title]),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={busy || acting || draft.records.length >= 100}
          onClick={() => open(createWorkbenchRecord(tool))}
        >
          New {config.title} record
        </button>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            downloadWorkspace(
              JSON.stringify(
                {
                  format: "eylo-project-workbench",
                  tool,
                  project_id: project.id,
                  document: readWorkbench(project, tool),
                },
                null,
                2,
              ),
              `eylo-${tool}.json`,
            )
          }
        >
          Export saved records
        </button>
        <button
          className={button}
          disabled={busy || acting}
          onClick={() => window.location.reload()}
        >
          Reload saved workspace
        </button>
      </div>
      {row && (
        <form
          onSubmit={apply}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <fieldset disabled={busy || acting} className="min-w-0 space-y-4">
            <legend className="mb-3 font-semibold">Record draft</legend>
            <label className="block text-sm">
              Record title
              <input
                required
                className={input}
                maxLength={160}
                value={row.title}
                onChange={(e) => setRow({ ...row, title: e.target.value })}
              />
            </label>
            {config.fields.map(([key, label, type, options]) => (
              <label className="block text-sm" key={key}>
                {label}
                {type === "projects" ? (
                  <span className="block max-h-64 overflow-auto">
                    {(extras?.projects || []).map((p) => (
                      <span
                        key={p.id}
                        className="flex min-h-10 min-w-0 items-center gap-2 [overflow-wrap:anywhere]"
                      >
                        <input
                          aria-label={p.title || "Untitled project"}
                          type="checkbox"
                          checked={row.project_ids.includes(p.id)}
                          onChange={(e) =>
                            setRow({
                              ...row,
                              project_ids: e.target.checked
                                ? [...row.project_ids, p.id]
                                : row.project_ids.filter((id) => id !== p.id),
                            })
                          }
                        />
                        {p.title}
                      </span>
                    ))}
                  </span>
                ) : type === "select" ? (
                  <select
                    className={input}
                    value={row[key]}
                    onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                  >
                    {options.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                ) : type === "textarea" ? (
                  <textarea
                    rows={4}
                    className={input}
                    maxLength={key === "content" ? 20000 : 6000}
                    value={row[key]}
                    disabled={
                      tool === "forms" &&
                      key === "definition" &&
                      row.responses.length > 0
                    }
                    onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                  />
                ) : (
                  <input
                    className={input}
                    type={
                      type === "date"
                        ? "date"
                        : type === "number"
                          ? "number"
                          : "text"
                    }
                    value={row[key]}
                    onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                  />
                )}
              </label>
            ))}
            {tool === "interview" && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    if (
                      !row.answer ||
                      window.confirm(
                        "Replace the practice question and clear this answer?",
                      )
                    )
                      setRow({
                        ...row,
                        question:
                          PRACTICE_QUESTIONS[
                            Math.floor(
                              Math.random() * PRACTICE_QUESTIONS.length,
                            )
                          ],
                        answer: "",
                        seconds: "0",
                      });
                  }}
                >
                  Choose practice question
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    if (!start.current) {
                      start.current = Date.now();
                      setNotice("Practice timer started.");
                    } else {
                      setRow({
                        ...row,
                        seconds: String(
                          Math.floor((Date.now() - start.current) / 1000),
                        ),
                      });
                      start.current = 0;
                      setNotice("Practice duration recorded.");
                    }
                  }}
                >
                  Start / stop practice timer
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={!row.answer.trim()}
                  onClick={reviewAnswer}
                >
                  Ask EYRA for answer feedback
                </button>
              </div>
            )}
            {ai && (
              <p className="whitespace-pre-wrap rounded-lg border border-border p-3 text-sm">
                {ai}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button className={button} type="submit">
                Apply record to draft
              </button>
              <button
                className={button}
                type="button"
                onClick={() => {
                  if (window.confirm("Discard the record draft?")) setRow(null);
                }}
              >
                Cancel record
              </button>
            </div>
          </fieldset>
          {acting && tool === "interview" && (
            <button
              type="button"
              className={button}
              onClick={() => controller.current?.abort()}
            >
              Cancel EYRA feedback
            </button>
          )}
        </form>
      )}
      {!draft.records.length && (
        <p className="rounded-xl border border-dashed border-border p-6">
          No saved or draft records yet.
        </p>
      )}
      {draft.records.map((record) => (
        <article
          key={record.id}
          className="space-y-3 rounded-xl border border-border bg-card p-4 [overflow-wrap:anywhere]"
        >
          <h2 className="font-semibold">{record.title}</h2>
          <p className="whitespace-pre-wrap text-sm">
            {previewWorkbenchRecord(tool, record, names)}
          </p>
          {tool === "spaces" &&
            record.project_ids.map((id) => (
              <a
                key={id}
                className="mr-3 inline-flex min-h-11 items-center text-sm text-primary"
                href={`/projects/${id}`}
              >
                {names[id] || "Open authorized project"}
              </a>
            ))}
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy || acting}
              onClick={() => open(record)}
            >
              Edit record
            </button>
            <button
              className={button}
              disabled={busy || acting || Boolean(row)}
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this record from the draft? Save to persist removal.",
                  )
                )
                  setDraft({
                    ...draft,
                    records: draft.records.filter((r) => r.id !== record.id),
                  });
              }}
            >
              Remove record
            </button>
            {["workflows", "studio", "conferences"].includes(tool) && (
              <button
                className={button}
                disabled={
                  busy ||
                  acting ||
                  Boolean(row) ||
                  !readWorkbench(project, tool).records.some(
                    (r) =>
                      r.id === record.id &&
                      JSON.stringify(r) === JSON.stringify(record),
                  )
                }
                onClick={() => materialize(record)}
              >
                {tool === "workflows"
                  ? "Previewed tasks: confirm creation"
                  : tool === "studio"
                    ? "Create Note from saved draft"
                    : "Add saved deadline to Calendar"}
              </button>
            )}
            {["workflows", "studio", "conferences"].includes(tool) && (
              <button
                className={button}
                disabled={busy || acting}
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear retry metadata only after checking confirmed server results. This can allow a new operation to create another copy.",
                    )
                  ) {
                    window.sessionStorage.removeItem(
                      `${PRODUCT_OPERATION_PREFIX}${user.id}:${project.id}:${tool}:${record.id}`,
                    );
                    operation.current = null;
                    setNotice("Pending retry metadata cleared by you.");
                  }
                }}
              >
                Clear pending operation after review
              </button>
            )}
            {tool === "forms" && (
              <button
                className={button}
                disabled={busy || Boolean(row)}
                onClick={() => {
                  setFormId(record.id);
                  setAnswers({});
                }}
              >
                Fill private form
              </button>
            )}
          </div>
          {tool === "forms" && formId === record.id && (
            <div className="space-y-3 rounded-lg bg-secondary p-3">
              <p className="text-xs">
                Private responses remain in this project; this form is not
                published.
              </p>
              {parseFormDefinition(record.definition).map((f) => (
                <label className="block text-sm" key={f.id}>
                  {f.label}
                  {f.required ? " *" : ""}
                  <input
                    className={input}
                    type={
                      f.type === "date"
                        ? "date"
                        : f.type === "number"
                          ? "number"
                          : "text"
                    }
                    value={answers[f.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [f.id]: e.target.value })
                    }
                  />
                </label>
              ))}
              <button
                className={button}
                disabled={busy}
                onClick={submitResponse}
              >
                Apply private response to draft
              </button>
            </div>
          )}
        </article>
      ))}
      {tool === "workflows" && (
        <section aria-label="Confirmed task runs">
          <h2 className="font-semibold">Confirmed task runs</h2>
          {(project.product_workflow_runs || []).map((run) => (
            <p key={run.id} className="text-sm">
              {run.created_at} · {run.task_ids?.length || 0} created tasks · Run{" "}
              {run.id}
            </p>
          ))}
          <a
            href="/life"
            className="inline-flex min-h-11 items-center text-primary"
          >
            Open Life tasks
          </a>
        </section>
      )}
      {["studio", "conferences"].includes(tool) && (
        <section aria-label="Confirmed record creations">
          <h2 className="font-semibold">Confirmed record creations</h2>
          {(project.product_materializations || [])
            .filter((result) => result.tool === tool)
            .map((result) => (
              <p key={result.id} className="text-sm">
                {result.created_at} · Record {result.id}
              </p>
            ))}
        </section>
      )}
    </div>
  );
}
