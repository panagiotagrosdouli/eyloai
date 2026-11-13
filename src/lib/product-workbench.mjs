import { moneyToMinor } from "./project-budget.mjs";
export const WORKBENCH_TOOLS = {
  spaces: {
    id: 4,
    title: "Spaces",
    fields: [["project_ids", "Projects", "projects"]],
  },
  skills: {
    id: 12,
    title: "Skills",
    fields: [
      ["baseline", "Starting self-assessment (0–5)", "number"],
      ["current", "Current self-assessment (0–5)", "number"],
      ["target", "Target (0–5)", "number"],
      ["practice", "Practice log", "textarea"],
    ],
  },
  interview: {
    id: 15,
    title: "Interview Simulator",
    fields: [
      ["role", "Role or interview goal", "text"],
      ["question", "Practice question", "textarea"],
      ["answer", "Your answer", "textarea"],
      ["seconds", "Practice seconds", "number"],
    ],
  },
  workflows: {
    id: 25,
    title: "Workflow Builder",
    fields: [["steps", "Task steps — one title per line", "textarea"]],
  },
  studio: {
    id: 37,
    title: "Studio",
    fields: [
      ["audience", "Audience", "text"],
      ["purpose", "Purpose", "textarea"],
      ["content", "Document draft", "textarea"],
    ],
  },
  methodology: {
    id: 52,
    title: "Methodology Coach",
    fields: [
      [
        "objective",
        "Objective",
        "select",
        ["descriptive", "causal", "qualitative"],
      ],
      ["question", "Research question", "textarea"],
      ["approach", "Proposed approach", "textarea"],
      ["limitations", "Known limitations", "textarea"],
    ],
  },
  ethics: {
    id: 64,
    title: "Research Ethics",
    fields: [
      ["participants", "Human participants", "select", ["no", "yes"]],
      ["sensitive", "Sensitive data", "select", ["no", "yes"]],
      [
        "consent",
        "Consent plan",
        "select",
        ["planned", "obtained", "not_applicable"],
      ],
      [
        "approval",
        "Declared review status",
        "select",
        ["not_requested", "pending", "approved"],
      ],
      ["reference", "Approval reference URL", "text"],
      ["retention", "Retention and deletion plan", "textarea"],
    ],
  },
  conferences: {
    id: 68,
    title: "Conference Hub",
    fields: [
      ["website", "Official conference URL", "text"],
      ["date", "Conference date", "date"],
      ["deadline", "Submission deadline", "date"],
      ["location", "Location or online venue", "text"],
      ["fee", "Estimated fee", "text"],
    ],
  },
  forms: {
    id: 71,
    title: "Smart Forms",
    fields: [
      [
        "definition",
        "Fields: label | text, number or date | required or optional",
        "textarea",
      ],
    ],
  },
};
export const PRACTICE_QUESTIONS = [
  "Explain a difficult problem you solved and the evidence you used.",
  "Describe a trade-off in your work and how you evaluated alternatives.",
  "How did you respond to critical feedback?",
  "Explain your research or project to someone outside your field.",
];
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export const isCalendarDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function safeSource(value, required = false) {
  if (!value && !required) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete HTTPS source URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Sources must use HTTPS without embedded credentials.");
}
export function createWorkbenchRecord(tool) {
  const config = Object.hasOwn(WORKBENCH_TOOLS, tool)
    ? WORKBENCH_TOOLS[tool]
    : null;
  if (!config) throw new Error("Unknown product.");
  const fields = Object.fromEntries(
    config.fields.map(([key, , type, options]) => [
      key,
      type === "projects"
        ? []
        : type === "select"
          ? options[0]
          : type === "number"
            ? "0"
            : "",
    ]),
  );
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: "",
    ...fields,
    ...(tool === "forms" ? { responses: [] } : {}),
    ...(tool === "conferences" ? { fee: "0.00" } : {}),
  };
}
export function parseFormDefinition(value) {
  const lines = String(value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 20)
    throw new Error("Define between 1 and 20 form fields.");
  const seen = new Set();
  return lines.map((line, index) => {
    const [label, type = "text", required = "optional", ...extra] = line
      .split("|")
      .map((s) => s.trim());
    if (
      !label ||
      label.length > 100 ||
      !["text", "number", "date"].includes(type) ||
      !["required", "optional"].includes(required) ||
      extra.length ||
      seen.has(label.toLowerCase())
    )
      throw new Error(
        "Each field needs a unique label, supported type and required/optional setting.",
      );
    seen.add(label.toLowerCase());
    return {
      id: `field_${index}`,
      label,
      type,
      required: required === "required",
    };
  });
}
export function validateFormAnswers(definition, answers) {
  const fields = parseFormDefinition(definition),
    result = {};
  for (const field of fields) {
    const value = String(answers?.[field.id] ?? "").trim();
    if (value.length > 2000 || (field.required && !value))
      throw new Error(`Complete ${field.label} (maximum 2,000 characters).`);
    if (
      value &&
      field.type === "number" &&
      (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))
    )
      throw new Error(`${field.label} must be a number.`);
    if (value && field.type === "date" && !isCalendarDate(value))
      throw new Error(`${field.label} must be a real calendar date.`);
    result[field.id] = value;
  }
  return result;
}
export function validateWorkbenchRecord(tool, row) {
  const config = Object.hasOwn(WORKBENCH_TOOLS, tool)
    ? WORKBENCH_TOOLS[tool]
    : null;
  if (
    !config ||
    !row ||
    row.version !== 1 ||
    !uuid(row.id) ||
    typeof row.title !== "string" ||
    !row.title.trim() ||
    row.title.length > 160
  )
    throw new Error("Add a title and a supported record identity.");
  for (const [key, label, type, options] of config.fields) {
    const value = row[key];
    if (type === "projects") {
      if (
        !Array.isArray(value) ||
        value.length > 20 ||
        new Set(value).size !== value.length ||
        value.some((id) => !uuid(id))
      )
        throw new Error("Select at most 20 distinct owned projects.");
      continue;
    }
    if (
      typeof value !== "string" ||
      value.length > (key === "content" ? 20000 : 6000)
    )
      throw new Error(`${label} exceeds its supported length.`);
    if (type === "select" && !options.includes(value))
      throw new Error(`Choose a supported ${label}.`);
    if (type === "date" && !isCalendarDate(value))
      throw new Error(`${label} must be a real calendar date.`);
  }
  if (
    tool === "skills" &&
    ["baseline", "current", "target"].some(
      (key) => !/^\d$/.test(row[key]) || Number(row[key]) > 5,
    )
  )
    throw new Error("Skill self-assessments must be integers from 0 to 5.");
  if (
    tool === "interview" &&
    (!row.role.trim() || !row.question.trim() || !/^\d{1,6}$/.test(row.seconds))
  )
    throw new Error(
      "Add an interview goal, question and a bounded practice duration.",
    );
  if (
    tool === "workflows" &&
    (!row.steps.trim() ||
      row.steps.split("\n").filter((s) => s.trim()).length > 20 ||
      row.steps.split("\n").some((s) => s.trim().length > 160))
  )
    throw new Error(
      "Use between 1 and 20 nonempty task titles, at most 160 characters each.",
    );
  if (tool === "studio" && (!row.content.trim() || !row.purpose.trim()))
    throw new Error("Add a purpose and document content.");
  if (tool === "methodology" && (!row.question.trim() || !row.approach.trim()))
    throw new Error("Describe your research question and approach.");
  if (tool === "ethics") {
    if (!row.retention.trim())
      throw new Error("Describe the retention and deletion plan.");
    if (row.participants === "yes" && row.consent === "not_applicable")
      throw new Error("Human-participant plans need a consent plan.");
    safeSource(row.reference, row.approval === "approved");
  }
  if (tool === "conferences") {
    safeSource(row.website, true);
    moneyToMinor(row.fee);
    if (row.deadline > row.date)
      throw new Error(
        "Submission deadline must not follow the conference date.",
      );
  }
  if (tool === "forms") {
    parseFormDefinition(row.definition);
    if (!Array.isArray(row.responses) || row.responses.length > 100)
      throw new Error("This private form supports at most 100 responses.");
    const seen = new Set();
    for (const answer of row.responses) {
      if (
        !uuid(answer.id) ||
        seen.has(answer.id) ||
        answer.definition !== row.definition
      )
        throw new Error(
          "Form responses require unique IDs and the unchanged definition.",
        );
      seen.add(answer.id);
      validateFormAnswers(answer.definition, answer.answers);
    }
  }
  return row;
}
export function readWorkbench(project, tool) {
  if (!Object.hasOwn(WORKBENCH_TOOLS, tool))
    throw new Error("Unknown product.");
  const doc = project.product_workbench?.[tool] ?? { version: 1, records: [] };
  if (
    doc.version !== 1 ||
    !Array.isArray(doc.records) ||
    doc.records.length > 100
  )
    throw new Error("Unsupported saved workspace format.");
  if (
    tool === "spaces" &&
    new Set(doc.records.flatMap((row) => row.project_ids || [])).size > 50
  )
    throw new Error(
      "A Spaces workspace supports at most 50 distinct linked projects.",
    );
  const ids = new Set();
  for (const row of doc.records) {
    validateWorkbenchRecord(tool, row);
    if (ids.has(row.id)) throw new Error("Duplicate saved record.");
    ids.add(row.id);
  }
  if (new TextEncoder().encode(JSON.stringify(doc)).length > 262144)
    throw new Error("Workspace exceeds the 256 KiB limit.");
  return doc;
}
export function workbenchPatch(project, tool, document) {
  readWorkbench(project, tool);
  readWorkbench({ product_workbench: { [tool]: document } }, tool);
  return {
    product_workbench: {
      ...(project.product_workbench || {}),
      [tool]: document,
    },
  };
}
export function previewWorkbenchRecord(tool, row, projectNames = {}) {
  validateWorkbenchRecord(tool, row);
  if (tool === "spaces")
    return row.project_ids
      .map((id) => projectNames[id] || "Linked project unavailable")
      .join("\n");
  if (tool === "skills")
    return `Self-reported change: ${Number(row.current) - Number(row.baseline)} of 5. Remaining target gap: ${Math.max(0, Number(row.target) - Number(row.current))}.\n${row.practice}`;
  if (tool === "interview")
    return `Goal: ${row.role}\nQuestion: ${row.question}\nPractice duration: ${row.seconds}s\nAnswer: ${row.answer}\nNo automated competency score.`;
  if (tool === "workflows")
    return row.steps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => `${i + 1}. Create task: ${s}`)
      .join("\n");
  if (tool === "studio")
    return `${row.purpose}\nAudience: ${row.audience}\n\n${row.content}`;
  if (tool === "methodology")
    return `Question: ${row.question}\nProposed approach: ${row.approach}\nReview: ${row.objective === "causal" ? "Define allocation, confounding controls and a causal identification strategy; observational associations alone do not establish causation." : row.objective === "qualitative" ? "Define sampling, researcher reflexivity, coding and interpretation review." : "Define the population, measures, missing-data handling and uncertainty."}\nLimitations: ${row.limitations || "Not yet recorded"}`;
  if (tool === "ethics")
    return `Declared review: ${row.approval}; source: ${row.reference || "none"}\n${row.participants === "yes" ? "Review informed consent, withdrawal and participant protection." : "Document whether human-participant review applies."}\n${row.sensitive === "yes" ? "Review access restriction and data minimization." : "Record the data sensitivity assessment."}\nRetention: ${row.retention}\nUser-declared plan; not ethics approval.`;
  if (tool === "conferences")
    return `Conference: ${row.date}\nSubmission deadline: ${row.deadline}\nLocation: ${row.location}\nEstimated fee: ${row.fee} (currency to be confirmed with organizer)\nUser-supplied source: ${row.website}`;
  if (tool === "forms")
    return (
      parseFormDefinition(row.definition)
        .map((f) => `${f.label}: ${f.type}${f.required ? " (required)" : ""}`)
        .join("\n") + `\nPrivate responses: ${row.responses.length}`
    );
  return "";
}

/** Exports only the persisted form record supplied by the caller. */
export function formResponsesCsv(record) {
  validateWorkbenchRecord('forms', record);
  const fields = parseFormDefinition(record.definition);
  const cell = value => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [
    ['Response ID', ...fields.map(field => field.label)],
    ...record.responses.map(response => {
      const answers = validateFormAnswers(record.definition, response.answers);
      return [response.id, ...fields.map(field => answers[field.id])];
    }),
  ].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
