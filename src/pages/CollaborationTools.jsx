import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getUsableSession, requireSupabase } from "@/lib/supabaseClient";
import {
  downloadWorkspace,
  workspaceButton as button,
  workspaceInput as input,
} from "@/components/projects/ProjectDocumentWorkspace";
const TOOLS = {
  teams: {
    title: "Teams",
    tables: ["eylo_teams", "eylo_team_members", "eylo_team_invites"],
  },
  connect: { title: "Connect", tables: ["eylo_directory", "eylo_connections"] },
  community: { title: "Community", tables: ["eylo_community_posts"] },
  "peer-review": {
    title: "Peer Review Workspace",
    tables: ["eylo_peer_submissions", "eylo_peer_reviews", "eylo_connections"],
  },
  feedback: { title: "Feedback", tables: ["eylo_feedback"] },
};
export default function CollaborationTools() {
  const { tool } = useParams();
  return Object.hasOwn(TOOLS, tool) ? (
    <Workspace key={tool} tool={tool} />
  ) : (
    <main className="eylo-page">Workspace unavailable.</main>
  );
}
function Workspace({ tool }) {
  const config = TOOLS[tool],
    alive = useRef(true);
  const [data, setData] = useState(/** @type {Record<string, any[]>} */ ({})),
    [user, setUser] = useState(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [body, setBody] = useState(""),
    [name, setName] = useState(""),
    [about, setAbout] = useState(""),
    [target, setTarget] = useState(""),
    [team, setTeam] = useState(""),
    [parent, setParent] = useState(null),
    [category, setCategory] = useState("bug"),
    [review, setReview] = useState(null),
    [noteId, setNoteId] = useState(""),
    [submissionTitle, setSubmissionTitle] = useState(""),
    [submissionContent, setSubmissionContent] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const session = await getUsableSession({
        required: true,
        validate: true,
      });
      const tables = [
        ...new Set([
          ...config.tables,
          ...(["teams", "peer-review", "community"].includes(tool)
            ? ["eylo_directory"]
            : []),
        ]),
      ];
      const results = await Promise.all(
        tables.map(async (table) => {
          let query = requireSupabase().from(table).select("*");
          if (table === "eylo_feedback")
            query = query.eq("user_id", session.user.id);
          const { data: rows, error } = await query
            .order("created_date", { ascending: false })
            .limit(1000);
          if (error) throw error;
          return [table, rows || []];
        }),
      );
      const next = Object.fromEntries(results);
      if (tool === "peer-review")
        next.notes = await base44.entities.Note.list("-updated_date", 1000);
      if (alive.current) {
        setUser(session.user);
        setData(next);
        const profile = next.eylo_directory?.find(
          (r) => r.user_id === session.user.id,
        );
        if (profile) {
          setName(profile.display_name);
          setAbout(profile.about);
        }
      }
    } catch (f) {
      if (alive.current)
        setError(
          ["PGRST205", "42P01"].includes(f.code)
            ? "This workspace has not been enabled. Ask the workspace administrator to check its setup."
            : f.message ||
                "Workspace could not be loaded. Check your connection and access.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [config, tool]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  const perform = async (action, message) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      if (alive.current) {
        setNotice(message);
        await load();
      }
    } catch (f) {
      if (alive.current)
        setError(
          (f.message || "Action failed.") +
            " Reload to verify the saved state before retrying.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const insert = async (table, payload) => {
    const { data: rows, error } = await requireSupabase()
      .from(table)
      .insert({ ...payload, user_id: user.id })
      .select("*");
    if (error) throw error;
    if (!rows?.length)
      throw new Error("The database did not confirm the new record.");
    return rows[0];
  };
  const update = async (table, row, patch) => {
    const { data: changed, error } = await requireSupabase()
      .from(table)
      .update(patch)
      .eq("id", row.id)
      .eq("updated_date", row.updated_date)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!changed)
      throw new Error(
        "Record changed or permission was denied. Your input is retained.",
      );
  };
  const remove = async (table, row) => {
    if (
      !window.confirm(
        table === "eylo_peer_submissions"
          ? "Delete this shared manuscript snapshot and its attached reviews?"
          : table === "eylo_team_members"
            ? "Remove this membership and revoke its team access?"
            : "Delete this record?",
      )
    )
      return;
    await perform(async () => {
      const { data: rows, error } = await requireSupabase()
        .from(table)
        .delete()
        .eq("id", row.id)
        .select("id");
      if (error) throw error;
      if (!rows?.length) throw new Error("Delete was not confirmed.");
    }, "Record deleted.");
  };
  const directory = (data.eylo_directory || []).filter(
      (p) => p.user_id !== user?.id && p.visible,
    ),
    names = Object.fromEntries(
      (data.eylo_directory || []).map((p) => [p.user_id, p.display_name]),
    );
  const connections = data.eylo_connections || [],
    accepted = connections
      .filter((c) => c.status === "accepted")
      .map((c) => (c.user_id === user?.id ? c.recipient_id : c.user_id));
  const canManage = (teamId) =>
    (data.eylo_teams || []).some(
      (t) => t.id === teamId && t.user_id === user?.id,
    ) ||
    (data.eylo_team_members || []).some(
      (m) =>
        m.team_id === teamId && m.user_id === user?.id && m.role === "admin",
    );
  const people =
    tool === "peer-review"
      ? accepted.map(
          (id) =>
            (data.eylo_directory || []).find((p) => p.user_id === id) || {
              user_id: id,
              display_name: "Accepted contact " + id.slice(-6),
            },
        )
      : directory;
  const personSelect = (
    <label className="block text-sm">
      Member
      <select
        aria-label="Member"
        className={input}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Choose a consenting directory member</option>
        {people.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.display_name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <main className="eylo-page mx-auto max-w-5xl space-y-5">
      <Link
        to="/tools"
        className="inline-flex min-h-11 items-center text-primary"
      >
        All tools
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage what you share. Your personal projects and Notes remain private
          unless you explicitly share a snapshot.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Loading or saving…</p>}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={load}>
          Reload workspace
        </button>
        <button
          className={button}
          disabled={busy || !user}
          onClick={() =>
            downloadWorkspace(
              JSON.stringify(
                {
                  format: "eylo-owned-collaboration-records",
                  tool,
                  records: Object.fromEntries(
                    config.tables.map((table) => [
                      table,
                      (data[table] || []).filter(
                        (row) => row.user_id === user.id,
                      ),
                    ]),
                  ),
                  coverage:
                    "Up to1000 visible recent rows per collection; only your authored records exported.",
                },
                null,
                2,
              ),
              `eylo-${tool}-owned.json`,
            )
          }
        >
          Export my loaded records
        </button>
      </div>
      {user && (
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {tool === "connect" && (
            <>
              <section className="space-y-3 rounded-xl border border-border p-4">
                <h2 className="font-semibold">My directory profile</h2>
                <p className="text-xs text-muted-foreground">
                  Publishing makes this name and bio visible to signed-in EYLO
                  users. Your private projects and Notes are not shared.
                </p>
                <label className="block text-sm">
                  Display name
                  <input
                    className={input}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Public bio
                  <textarea
                    className={input}
                    maxLength={1000}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {[true, false].map((visible) => (
                    <button
                      key={String(visible)}
                      className={button}
                      disabled={!name.trim()}
                      onClick={() => {
                        if (
                          visible &&
                          !window.confirm(
                            "Publish your display name and bio to signed-in EYLO members?",
                          )
                        )
                          return;
                        void perform(
                          async () => {
                            const old = (data.eylo_directory || []).find(
                              (r) => r.user_id === user.id,
                            );
                            const query = old
                              ? requireSupabase()
                                  .from("eylo_directory")
                                  .update({
                                    display_name: name,
                                    about,
                                    visible,
                                  })
                                  .eq("user_id", user.id)
                              : requireSupabase()
                                  .from("eylo_directory")
                                  .insert({
                                    user_id: user.id,
                                    display_name: name,
                                    about,
                                    visible,
                                  });
                            const { error } = await query;
                            if (error) throw error;
                          },
                          visible
                            ? "Directory profile published."
                            : "Directory profile hidden.",
                        );
                      }}
                    >
                      {visible
                        ? "Publish directory profile"
                        : "Hide directory profile"}
                    </button>
                  ))}
                </div>
              </section>
              {personSelect}
              <button
                className={button}
                disabled={!target}
                onClick={() =>
                  perform(
                    () => insert("eylo_connections", { recipient_id: target }),
                    "Connection request saved.",
                  )
                }
              >
                Request connection
              </button>
              {connections.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-border p-4"
                >
                  <p>
                    {names[
                      row.user_id === user.id ? row.recipient_id : row.user_id
                    ] || "Member"}{" "}
                    · {row.status}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.recipient_id === user.id &&
                      row.status === "pending" &&
                      ["accepted", "declined"].map((status) => (
                        <button
                          className={button}
                          key={status}
                          onClick={() =>
                            perform(
                              () => update("eylo_connections", row, { status }),
                              `Connection ${status}.`,
                            )
                          }
                        >
                          {status === "accepted"
                            ? "Accept connection"
                            : "Decline connection"}
                        </button>
                      ))}
                    {["pending", "accepted"].includes(row.status) && (
                      <button
                        className={button}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Disconnect or withdraw this connection?",
                            )
                          )
                            void perform(
                              () =>
                                update("eylo_connections", row, {
                                  status: "disconnected",
                                }),
                              "Connection disconnected.",
                            );
                        }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </>
          )}
          {tool === "teams" && (
            <>
              <label className="block text-sm">
                Team name
                <input
                  className={input}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={!name.trim()}
                onClick={() =>
                  perform(
                    () => insert("eylo_teams", { name }),
                    "Team created. Its owner manages invitations and roles.",
                  )
                }
              >
                Create team
              </button>
              <label className="block text-sm">
                Team
                <select
                  aria-label="Team"
                  className={input}
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                >
                  <option value="">Choose team</option>
                  {(data.eylo_teams || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {personSelect}
              <button
                className={button}
                disabled={!team || !target || !canManage(team)}
                onClick={() =>
                  perform(
                    () =>
                      insert("eylo_team_invites", {
                        team_id: team,
                        recipient_id: target,
                      }),
                    "Invitation saved. No email was sent.",
                  )
                }
              >
                Invite member
              </button>
              {(data.eylo_team_invites || []).map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-border p-4"
                >
                  <p>
                    Invitation ·{" "}
                    {(data.eylo_teams || []).find((t) => t.id === row.team_id)
                      ?.name || "Team"}{" "}
                    · {row.status}
                  </p>
                  {row.recipient_id === user.id &&
                    ["pending", "accepted"].includes(row.status) && (
                      <button
                        className={button}
                        onClick={() =>
                          perform(async () => {
                            if (row.status === "pending")
                              await update("eylo_team_invites", row, {
                                status: "accepted",
                              });
                            const { data: existing, error } =
                              await requireSupabase()
                                .from("eylo_team_members")
                                .select("id")
                                .eq("team_id", row.team_id)
                                .eq("user_id", user.id);
                            if (error) throw error;
                            if (!existing?.length)
                              await insert("eylo_team_members", {
                                team_id: row.team_id,
                                role: "member",
                              });
                          }, "Team joined. Personal records remain private.")
                        }
                      >
                        Accept and join team
                      </button>
                    )}
                  {row.recipient_id === user.id && row.status === "pending" && (
                    <button
                      className={button}
                      disabled={
                        row.user_id !== user.id && !canManage(row.team_id)
                      }
                      onClick={() =>
                        perform(
                          () =>
                            update("eylo_team_invites", row, {
                              status: "declined",
                            }),
                          "Invitation declined.",
                        )
                      }
                    >
                      Decline invite
                    </button>
                  )}
                  {row.status === "pending" && (
                    <button
                      className={button}
                      disabled={
                        row.user_id !== user.id && !canManage(row.team_id)
                      }
                      onClick={() =>
                        perform(
                          () =>
                            update("eylo_team_invites", row, {
                              status: "cancelled",
                            }),
                          "Invitation cancelled.",
                        )
                      }
                    >
                      Cancel invite
                    </button>
                  )}
                </article>
              ))}
              {(data.eylo_team_members || []).map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-border p-4"
                >
                  <p>
                    {names[row.user_id] || "Member"} · {row.role}
                  </p>
                  {(data.eylo_teams || []).find((t) => t.id === row.team_id)
                    ?.user_id === user.id && (
                    <button
                      className={button}
                      onClick={() =>
                        perform(
                          () =>
                            update("eylo_team_members", row, {
                              role: row.role === "admin" ? "member" : "admin",
                            }),
                          "Role updated.",
                        )
                      }
                    >
                      Set {row.role === "admin" ? "member" : "admin"} role
                    </button>
                  )}
                  <button
                    className={button}
                    disabled={
                      row.user_id !== user.id &&
                      !(data.eylo_teams || []).some(
                        (t) => t.id === row.team_id && t.user_id === user.id,
                      )
                    }
                    onClick={() => remove("eylo_team_members", row)}
                  >
                    Remove / leave membership
                  </button>
                </article>
              ))}
            </>
          )}
          {tool === "community" && (
            <>
              <p className="text-sm">
                Posts and replies are visible to all signed-in EYLO users. Share
                only content you intend to publish.
              </p>
              {parent && (
                <p>
                  Replying to selected post{" "}
                  <button className={button} onClick={() => setParent(null)}>
                    Cancel reply
                  </button>
                </p>
              )}
              <label className="block text-sm">
                Community post
                <textarea
                  className={input}
                  maxLength={4000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={!body.trim()}
                onClick={() => {
                  if (
                    window.confirm(
                      "Publish this text to the authenticated EYLO community?",
                    )
                  )
                    void perform(async () => {
                      await insert("eylo_community_posts", {
                        body,
                        parent_id: parent,
                      });
                      setBody("");
                      setParent(null);
                    }, "Post published.");
                }}
              >
                Publish post
              </button>
              {(data.eylo_community_posts || []).map((row) => (
                <article
                  key={row.id}
                  className="space-y-2 rounded-xl border border-border p-4"
                >
                  <p className="text-xs text-muted-foreground">
                    {names[row.user_id] || "EYLO member"} ·{" "}
                    {row.parent_id ? "Reply" : "Post"}
                  </p>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {row.body}
                  </p>
                  <button className={button} onClick={() => setParent(row.id)}>
                    Reply
                  </button>
                  {row.user_id === user.id && (
                    <button
                      className={button}
                      onClick={() => remove("eylo_community_posts", row)}
                    >
                      Delete my post
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
          {tool === "feedback" && (
            <>
              <label className="block text-sm">
                Feedback category
                <select
                  className={input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["bug", "feature", "experience"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Feedback
                <textarea
                  className={input}
                  maxLength={4000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={!body.trim()}
                onClick={() =>
                  perform(async () => {
                    await insert("eylo_feedback", { category, body });
                    setBody("");
                  }, "Feedback saved to the EYLO queue.")
                }
              >
                Submit feedback
              </button>
              {(data.eylo_feedback || []).map((row) => (
                <article
                  className="rounded-xl border border-border p-4"
                  key={row.id}
                >
                  <p>
                    {row.category} · {row.status}
                  </p>
                  <p className="whitespace-pre-wrap">{row.body}</p>
                  <p className="text-xs text-muted-foreground">
                    Receipt: {row.id}
                  </p>
                  <button
                    className={button}
                    onClick={() => remove("eylo_feedback", row)}
                  >
                    Delete my feedback
                  </button>
                </article>
              ))}
            </>
          )}
          {tool === "peer-review" && (
            <>
              <p className="text-sm">
                Share a deliberate manuscript snapshot with an accepted
                connection. Your private Notes and projects stay private.
                Reviewer drafts are visible only to the reviewer until
                submitted.
              </p>
              {personSelect}
              <label className="block text-sm">
                Copy from my Note
                <select
                  className={input}
                  value={noteId}
                  onChange={(e) => {
                    setNoteId(e.target.value);
                    const note = (data.notes || []).find(
                      (n) => n.id === e.target.value,
                    );
                    if (note) {
                      setSubmissionTitle(note.title);
                      setSubmissionContent(note.content);
                    }
                  }}
                >
                  <option value="">Enter text directly</option>
                  {(data.notes || []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Submission title
                <input
                  className={input}
                  maxLength={200}
                  value={submissionTitle}
                  onChange={(e) => setSubmissionTitle(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Shared manuscript snapshot
                <textarea
                  className={input}
                  maxLength={50000}
                  rows={8}
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={
                  !target ||
                  !submissionTitle.trim() ||
                  !submissionContent.trim()
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Share exactly this title and text with the selected accepted connection?",
                    )
                  )
                    void perform(
                      () =>
                        insert("eylo_peer_submissions", {
                          reviewer_id: target,
                          title: submissionTitle,
                          content: submissionContent,
                        }),
                      "Review snapshot shared.",
                    );
                }}
              >
                Share review snapshot
              </button>
              {(data.eylo_peer_submissions || []).map((row) => (
                <article
                  key={row.id}
                  className="space-y-3 rounded-xl border border-border p-4"
                >
                  <h2 className="font-semibold">{row.title}</h2>
                  <details>
                    <summary className="min-h-11 cursor-pointer">
                      Read shared manuscript
                    </summary>
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {row.content}
                    </p>
                  </details>
                  {row.reviewer_id === user.id && (
                    <button
                      className={button}
                      onClick={() =>
                        setReview(
                          (data.eylo_peer_reviews || []).find(
                            (r) => r.submission_id === row.id,
                          ) || {
                            submission_id: row.id,
                            summary: "",
                            strengths: "",
                            concerns: "",
                            status: "draft",
                          },
                        )
                      }
                    >
                      Write / open my review
                    </button>
                  )}
                  {(data.eylo_peer_reviews || [])
                    .filter((r) => r.submission_id === row.id)
                    .map((r) => (
                      <section
                        key={r.id}
                        className="rounded-lg bg-secondary p-3"
                      >
                        <p className="text-xs">Review · {r.status}</p>
                        <p className="whitespace-pre-wrap">{r.summary}</p>
                        <p className="whitespace-pre-wrap">
                          Strengths: {r.strengths}
                        </p>
                        <p className="whitespace-pre-wrap">
                          Concerns: {r.concerns}
                        </p>
                      </section>
                    ))}
                  {row.user_id === user.id && (
                    <button
                      className={button}
                      onClick={() => remove("eylo_peer_submissions", row)}
                    >
                      Withdraw shared snapshot
                    </button>
                  )}
                </article>
              ))}
              {review && (
                <section className="space-y-3 rounded-xl border border-border p-4">
                  <h2 className="font-semibold">My review</h2>
                  {["summary", "strengths", "concerns"].map((key) => (
                    <label className="block text-sm" key={key}>
                      {key}
                      <textarea
                        className={input}
                        maxLength={key === "summary" ? 6000 : 4000}
                        disabled={review.status === "submitted"}
                        value={review[key]}
                        onChange={(e) =>
                          setReview({ ...review, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  {["draft", "submitted"].map((status) => (
                    <button
                      key={status}
                      className={button}
                      disabled={review.status === "submitted"}
                      onClick={() => {
                        if (
                          status === "submitted" &&
                          !window.confirm(
                            "Submit this review to the manuscript owner? A submitted review cannot be edited.",
                          )
                        )
                          return;
                        void perform(
                          async () => {
                            if (review.id)
                              await update("eylo_peer_reviews", review, {
                                summary: review.summary,
                                strengths: review.strengths,
                                concerns: review.concerns,
                                status,
                              });
                            else
                              await insert("eylo_peer_reviews", {
                                submission_id: review.submission_id,
                                summary: review.summary,
                                strengths: review.strengths,
                                concerns: review.concerns,
                                status,
                              });
                            setReview(null);
                          },
                          status === "draft"
                            ? "Private review draft saved."
                            : "Review submitted.",
                        );
                      }}
                    >
                      {status === "draft"
                        ? "Save private review draft"
                        : "Submit final review"}
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </fieldset>
      )}
    </main>
  );
}
