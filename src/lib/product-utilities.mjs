import { parseResearchCsv } from "./research-data.mjs";
export const blankSheet = () => ({
  version: 1,
  title: "Workbook",
  headers: ["A", "B", "C"],
  rows: [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ],
});
export function validateSheet(sheet) {
  if (
    !sheet ||
    sheet.version !== 1 ||
    typeof sheet.title !== "string" ||
    sheet.title.length > 160 ||
    !Array.isArray(sheet.headers) ||
    !sheet.headers.length ||
    sheet.headers.length > 12 ||
    new Set(sheet.headers.map((h) => String(h).toLowerCase())).size !==
      sheet.headers.length ||
    sheet.headers.some(
      (h) => typeof h !== "string" || !h.trim() || h.length > 100,
    ) ||
    !Array.isArray(sheet.rows) ||
    sheet.rows.length > 100 ||
    sheet.rows.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== sheet.headers.length ||
        row.some((cell) => typeof cell !== "string" || cell.length > 500),
    )
  )
    throw new Error(
      "Use at most 100 rows,12 distinct column labels and 500 characters per cell.",
    );
  if (new TextEncoder().encode(JSON.stringify(sheet)).length > 262144)
    throw new Error("Workbook exceeds the 256 KiB limit.");
  return sheet;
}
export const readSheet = (project) =>
  validateSheet(project.spreadsheet ?? blankSheet());
export const sheetPatch = (_project, sheet) => ({
  spreadsheet: validateSheet(sheet),
});
export function importSheetCsv(text) {
  const parsed = parseResearchCsv(text, {
    bytes: 1048576,
    rows: 100,
    columns: 12,
    fieldCharacters: 500,
  });
  return validateSheet({ version: 1, title: "Imported workbook", ...parsed });
}
export function evaluateSheetCell(sheet, row, column) {
  const memo = new Map(),
    stack = new Set();
  let remaining = 10000;
  const visit = (r, c) => {
    if (--remaining < 0 || stack.size >= 128) return "#BUDGET!";
    if (r < 0 || c < 0 || r >= sheet.rows.length || c >= sheet.headers.length)
      return "#REF!";
    const id = `${r}:${c}`;
    if (stack.has(id)) return "#CYCLE!";
    if (memo.has(id)) return memo.get(id);
    const raw = sheet.rows[r][c];
    if (!raw.startsWith("=")) {
      memo.set(id, raw);
      return raw;
    }
    const match =
      /^=(SUM|AVERAGE|MIN|MAX)\(([A-L])(\d{1,3}):([A-L])(\d{1,3})\)$/i.exec(
        raw,
      );
    if (!match) return "#FORMULA!";
    const c1 = match[2].toUpperCase().charCodeAt(0) - 65,
      c2 = match[4].toUpperCase().charCodeAt(0) - 65,
      r1 = Number(match[3]) - 1,
      r2 = Number(match[5]) - 1;
    if (
      r1 > r2 ||
      c1 > c2 ||
      r1 < 0 ||
      r2 >= sheet.rows.length ||
      c2 >= sheet.headers.length
    )
      return "#REF!";
    stack.add(id);
    const values = [];
    let failure = "";
    outer: for (let rr = r1; rr <= r2; rr++)
      for (let cc = c1; cc <= c2; cc++) {
        const value = String(visit(rr, cc)).trim();
        if (value.startsWith("#")) {
          failure = value;
          break outer;
        }
        if (!value) continue;
        if (
          !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value) ||
          !Number.isFinite(Number(value))
        ) {
          failure = "#VALUE!";
          break outer;
        }
        values.push(Number(value));
      }
    stack.delete(id);
    if (failure) {
      memo.set(id, failure);
      return failure;
    }
    const op = match[1].toUpperCase();
    if (!values.length) return op === "SUM" ? "0" : "#EMPTY!";
    const result =
      op === "SUM"
        ? values.reduce((a, b) => a + b, 0)
        : op === "AVERAGE"
          ? values.reduce((a, b) => a + b, 0) / values.length
          : op === "MIN"
            ? Math.min(...values)
            : Math.max(...values);
    const output = Number.isFinite(result) ? String(result) : "#VALUE!";
    memo.set(id, output);
    return output;
  };
  return visit(row, column);
}
export function sheetCsv(sheet, evaluated = false) {
  validateSheet(sheet);
  const cell = (value) => {
    let text = String(value);
    if (/^[\s\uFEFF]*[=+@\t\r-]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    [
      sheet.headers,
      ...sheet.rows.map((row, r) =>
        row.map((value, c) =>
          evaluated ? evaluateSheetCell(sheet, r, c) : value,
        ),
      ),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
export function searchCanonicalMemory(query, sources) {
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return sources
    .filter((row) =>
      words.every((word) =>
        `${row.title} ${row.text}`.toLowerCase().includes(word),
      ),
    )
    .slice(0, 100)
    .map((row) => ({ ...row, snippet: String(row.text).slice(0, 600) }));
}
export async function runRecoveryChecks(fetcher, signal) {
  const paths = ["/api/capabilities", "/api/deployment-status"];
  const results = [];
  for (const path of paths) {
    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      signal?.throwIfAborted();
      try {
        const response = await fetcher(path, { cache: "no-store", signal });
        if (!response.ok) throw new Error(`HTTP${response.status}`);
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new Error("Expected JSON, received another document type.");
        const body = await response.json();
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error("Invalid service response.");
        result = {
          path,
          status: "responding",
          attempts: attempt,
          note: "Response format verified; provider or production readiness is not established.",
        };
        break;
      } catch (error) {
        result = {
          path,
          status: "failed",
          attempts: attempt,
          error: error.message,
        };
        if (attempt < 3)
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * 2 ** (attempt - 1)),
          );
      }
    }
    results.push(result);
  }
  return results;
}
export async function createPersonalToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw =
    "eylo_pat_" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return {
    raw,
    hash: Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
