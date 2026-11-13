import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_TOOLS } from "../src/lib/product-registry.mjs";
import {
  WORKBENCH_TOOLS,
  createWorkbenchRecord,
  readWorkbench,
  validateWorkbenchRecord,
  workbenchPatch,
  parseFormDefinition,
  validateFormAnswers,
  previewWorkbenchRecord,
} from "../src/lib/product-workbench.mjs";
import {
  blankSheet,
  validateSheet,
  importSheetCsv,
  evaluateSheetCell,
  sheetCsv,
  searchCanonicalMemory,
  runRecoveryChecks,
  createPersonalToken,
} from "../src/lib/product-utilities.mjs";
import {
  encryptOfflineSnapshot,
  decryptOfflineSnapshot,
  validateOfflineSnapshot,
  clearOfflineVaults,
  OFFLINE_PREFIX,
} from "../src/lib/offline-vault.mjs";
const project = "10000000-0000-4000-8000-000000000001";
const record = (tool) => {
  const row = {
    ...createWorkbenchRecord(tool),
    title: "User authored fixture",
  };
  const values = {
    spaces: { project_ids: [project] },
    skills: {
      baseline: "1",
      current: "3",
      target: "4",
      practice: "Two supplied practice sessions",
    },
    interview: {
      role: "Research role",
      question: "Explain your evidence",
      answer: "My supplied answer",
      seconds: "30",
    },
    workflows: { steps: "Review sources\n\nDraft methods" },
    studio: { purpose: "Explain methods", content: "User authored text" },
    methodology: {
      question: "What changed?",
      approach: "Describe supplied measurements",
    },
    ethics: {
      retention: "Delete identifiable data after the consented period",
    },
    conferences: {
      website: "https://example.org/official-fixture",
      date: "2026-12-05",
      deadline: "2026-12-01",
    },
    forms: { definition: "Name | text | required\nCount | number | optional" },
  };
  return { ...row, ...values[tool] };
};
test("all22 requested product identities have a unique reachable work category", () => {
  assert.equal(PRODUCT_TOOLS.length, 22);
  assert.equal(new Set(PRODUCT_TOOLS.map((p) => p.id)).size, 22);
  assert.deepEqual(
    PRODUCT_TOOLS.map((p) => p.id),
    [
      4, 5, 12, 15, 20, 22, 25, 32, 34, 35, 37, 39, 42, 43, 46, 52, 53, 61, 64,
      68, 71, 76,
    ],
  );
});
for (const tool of Object.keys(WORKBENCH_TOOLS))
  test(`${tool}: bounded private record roundtrip and meaningful preview`, () => {
    const row = record(tool);
    validateWorkbenchRecord(tool, row);
    const doc = { version: 1, records: [row] };
    assert.equal(
      readWorkbench({ product_workbench: { [tool]: doc } }, tool).records[0].id,
      row.id,
    );
    assert.ok(
      previewWorkbenchRecord(tool, row, { [project]: "Owned project" }).length >
        0,
    );
    const prior = { product_workbench: { other: { preserved: true } } };
    assert.equal(
      workbenchPatch(prior, tool, doc).product_workbench.other.preserved,
      true,
    );
    assert.throws(
      () =>
        readWorkbench(
          {
            product_workbench: { [tool]: { version: 1, records: [row, row] } },
          },
          tool,
        ),
      /Duplicate/,
    );
  });
test("method planning, ethics approval references and conference dates do not fabricate acceptance", () => {
  assert.match(
    previewWorkbenchRecord("methodology", {
      ...record("methodology"),
      objective: "causal",
    }),
    /do not establish causation/,
  );
  assert.throws(() =>
    validateWorkbenchRecord("ethics", {
      ...record("ethics"),
      participants: "yes",
      consent: "not_applicable",
    }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("ethics", {
      ...record("ethics"),
      approval: "approved",
    }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("ethics", {
      ...record("ethics"),
      reference: "https://secret:password@example.org",
    }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("conferences", {
      ...record("conferences"),
      deadline: "2026-12-10",
    }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("conferences", {
      ...record("conferences"),
      date: "2026-02-30",
    }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("skills", { ...record("skills"), current: "6" }),
  );
  assert.throws(() =>
    validateWorkbenchRecord("workflows", {
      ...record("workflows"),
      steps: Array(21).fill("Task").join("\n"),
    }),
  );
});
test("private forms validate required, numeric/date types, definition stability and answer identity", () => {
  const definition =
    "Name | text | required\nCount | number | required\nDay | date | optional";
  assert.equal(parseFormDefinition(definition).length, 3);
  assert.deepEqual(
    validateFormAnswers(definition, {
      field_0: "Alice",
      field_1: "1.5",
      field_2: "2026-11-13",
    }),
    { field_0: "Alice", field_1: "1.5", field_2: "2026-11-13" },
  );
  for (const answers of [
    { field_1: "1" },
    { field_0: "A", field_1: "Infinity" },
    { field_0: "A", field_1: "2", field_2: "2026-02-30" },
  ])
    assert.throws(() => validateFormAnswers(definition, answers));
  assert.throws(() => parseFormDefinition("Same\nSame"));
  const row = record("forms");
  assert.throws(() =>
    validateWorkbenchRecord("forms", {
      ...row,
      responses: [
        { id: crypto.randomUUID(), definition: "Other", answers: {} },
      ],
    }),
  );
});
test("workbook safe aggregates, cycles, invalid references and unsupported scripts", () => {
  const sheet = {
    version: 1,
    title: "Values",
    headers: ["A", "B", "C"],
    rows: [
      ["0.1", "2", "=SUM(B1:B2)"],
      ["0.2", "3", "=AVERAGE(B1:B2)"],
      ["=SUM(A1:A2)", "=MAX(B1:B2)", "=MIN(B1:B2)"],
    ],
  };
  validateSheet(sheet);
  assert.equal(evaluateSheetCell(sheet, 0, 2), "5");
  assert.equal(evaluateSheetCell(sheet, 1, 2), "2.5");
  assert.equal(evaluateSheetCell(sheet, 2, 1), "3");
  assert.equal(evaluateSheetCell(sheet, 2, 2), "2");
  sheet.rows[0][0] = "=SUM(A1:A2)";
  assert.equal(evaluateSheetCell(sheet, 0, 0), "#CYCLE!");
  sheet.rows[0][0] = "=SUM(A1:A99)";
  assert.equal(evaluateSheetCell(sheet, 0, 0), "#REF!");
  sheet.rows[0][0] = '=fetch("https://example.org")';
  assert.equal(evaluateSheetCell(sheet, 0, 0), "#FORMULA!");
  sheet.rows[0][0] = "text";
  sheet.rows[0][2] = "=SUM(A1:A2)";
  assert.equal(evaluateSheetCell(sheet, 0, 2), "#VALUE!");
});
test("workbook CSV imports preserve quoted content and exports protect formulas", () => {
  const sheet = importSheetCsv(
    'Label,Value\n"comma, quote""",2\n=HYPERLINK(x),3',
  );
  assert.equal(sheet.rows[0][0], 'comma, quote"');
  assert.ok(sheetCsv(sheet).includes('"\'=HYPERLINK(x)"'));
  assert.throws(() => validateSheet({ ...blankSheet(), headers: ["A", "A"] }));
  assert.throws(() =>
    validateSheet({ ...blankSheet(), rows: [["mismatched"]] }),
  );
  assert.throws(() => importSheetCsv("A\n" + Array(101).fill("1").join("\n")));
});
test("canonical memory requires all query words and retains exact source identity", () => {
  const source = [
    {
      id: "note-id",
      title: "Methods",
      text: "A supplied uncertainty observation",
      kind: "Note",
      href: "/notes?focus=note-id",
    },
  ];
  assert.equal(
    searchCanonicalMemory("supplied uncertainty", source)[0].href,
    source[0].href,
  );
  assert.equal(searchCanonicalMemory("supplied invented", source).length, 0);
  assert.equal(searchCanonicalMemory("", source).length, 0);
});
test("read-only recovery retries transient responses and rejects HTML200", async () => {
  const calls = [];
  let count = 0;
  const results = await runRecoveryChecks(async (path, options) => {
    calls.push({ path, options });
    if (path.includes("capabilities") && ++count < 2)
      return new Response("{}", { status: 503 });
    return path.includes("capabilities")
      ? Response.json({ ai: false })
      : new Response("<html/>", { headers: { "content-type": "text/html" } });
  });
  assert.equal(results[0].attempts, 2);
  assert.equal(results[0].status, "responding");
  assert.equal(results[1].status, "failed");
  assert.equal(results[1].attempts, 3);
  assert.ok(calls.every((c) => !c.options.method && !c.options.body));
});
test("personal tokens are unpredictable secrets with only a SHA-256 digest for persistence", async () => {
  const a = await createPersonalToken(),
    b = await createPersonalToken();
  assert.match(a.raw, /^eylo_pat_[a-f0-9]{64}$/);
  assert.match(a.hash, /^[a-f0-9]{64}$/);
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.hash, a.raw);
});
test("encrypted offline snapshot roundtrip, wrong passphrase, tampering and owner substitution", async () => {
  const snapshot = {
    owner_id: project,
    notes: [
      {
        user_id: project,
        data: {
          title: "Private offline title",
          content: "confidential canary",
        },
      },
    ],
    projects: [],
    created_at: "2026-11-13",
  };
  const vault = await encryptOfflineSnapshot(
    snapshot,
    "Long private passphrase",
  );
  assert.equal(JSON.stringify(vault).includes("confidential"), false);
  assert.deepEqual(
    await decryptOfflineSnapshot(vault, "Long private passphrase"),
    snapshot,
  );
  await assert.rejects(() =>
    decryptOfflineSnapshot(vault, "Different passphrase"),
  );
  await assert.rejects(() =>
    decryptOfflineSnapshot(
      { ...vault, owner_id: "other-owner" },
      "Long private passphrase",
    ),
  );
  await assert.rejects(() =>
    decryptOfflineSnapshot(
      { ...vault, ciphertext: "bad" },
      "Long private passphrase",
    ),
  );
  assert.throws(() =>
    validateOfflineSnapshot({
      ...snapshot,
      notes: [{ user_id: "foreign", data: {} }],
    }),
  );
  await assert.rejects(() => encryptOfflineSnapshot(snapshot, "short"));
});
test("signout cache clearing targets only encrypted EYLO snapshots", () => {
  const map = new Map([
    [OFFLINE_PREFIX + "owner", "cipher"],
    ["other-app", "keep"],
  ]);
  const storage = {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
    removeItem: (key) => map.delete(key),
  };
  clearOfflineVaults(storage);
  assert.equal(map.has("other-app"), true);
  assert.equal(map.size, 1);
});

test("operation retry metadata survives reload without storing source text or crossing accounts", async () => {
  const { pendingProductOperation, verifyProductOperationResult } =
    await import("../src/lib/product-operation-recovery.mjs");
  const saved = new Map(),
    storage = {
      getItem: (key) => saved.get(key) || null,
      setItem: (key, value) => saved.set(key, value),
    };
  const source = {
    id: crypto.randomUUID(),
    title: "Private canary title",
    steps: "Private canary steps",
  };
  const owner = "00000000-0000-4000-8000-000000000001";
  const first = await pendingProductOperation(
      storage,
      owner,
      project,
      "workflows",
      source,
    ),
    retry = await pendingProductOperation(
      storage,
      owner,
      project,
      "workflows",
      source,
    );
  assert.equal(first.id, retry.id);
  assert.equal([...saved.values()].join("").includes("Private canary"), false);
  await assert.rejects(
    () =>
      pendingProductOperation(storage, owner, project, "workflows", {
        ...source,
        steps: "Changed step",
      }),
    /different draft/,
  );
  const other = await pendingProductOperation(
    storage,
    "00000000-0000-4000-8000-000000000002",
    project,
    "workflows",
    source,
  );
  assert.notEqual(first.id, other.id);
  assert.throws(() => verifyProductOperationResult("workflows", first, {}));
  assert.throws(() =>
    verifyProductOperationResult("workflows", first, {
      id: first.id,
      task_ids: [],
    }),
  );
  assert.doesNotThrow(() =>
    verifyProductOperationResult("workflows", first, {
      id: first.id,
      task_ids: [crypto.randomUUID()],
    }),
  );
});
test("workbook evaluation stops excessive dependency chains instead of freezing the editor", () => {
  const sheet = {
    version: 1,
    title: "Bounded chain",
    headers: Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)),
    rows: Array.from({ length: 100 }, () => Array(12).fill("")),
  };
  for (let index = 0; index < 1199; index++) {
    const next = index + 1;
    const ref =
      String.fromCharCode(65 + (next % 12)) + (Math.floor(next / 12) + 1);
    sheet.rows[Math.floor(index / 12)][index % 12] = `=SUM(${ref}:${ref})`;
  }
  sheet.rows[99][11] = "1";
  validateSheet(sheet);
  assert.equal(evaluateSheetCell(sheet, 0, 0), "#BUDGET!");
  assert.equal(evaluateSheetCell(sheet, 99, 11), "1");
});
test("unrecognized prototype names cannot select a workbench product", () => {
  for (const tool of ["__proto__", "constructor", "toString"])
    assert.throws(() => readWorkbench({}, tool), /Unknown product/);
});
