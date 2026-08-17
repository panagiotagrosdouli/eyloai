import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENALEX_URL = "https://api.openalex.org/works";
const GRANTS_URL = "https://api.grants.gov/v1/api/search2";
const MAX_WATCHLISTS_PER_RUN = 30;

type JsonRecord = Record<string, unknown>;

function json(payload: JsonRecord, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameString(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function abstractFromInverted(index: Record<string, number[]> | null) {
  if (!index) return "";
  const words: string[] = [];
  Object.entries(index).forEach(([word, positions]) => {
    positions.forEach((position) => { words[position] = word; });
  });
  return words.filter(Boolean).join(" ").slice(0, 500);
}

async function searchOpenAlex(query: string) {
  const params = new URLSearchParams({ search: query, per_page: "5", sort: "publication_date:desc" });
  const response = await fetch(`${OPENALEX_URL}?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`OpenAlex failed: ${response.status}`);
  const payload = await response.json();
  return (payload.results || []).map((work: JsonRecord) => {
    const primaryLocation = work.primary_location as JsonRecord | undefined;
    const source = primaryLocation?.source as JsonRecord | undefined;
    return {
      externalId: String(work.id || ""),
      type: "paper",
      title: String(work.title || "Untitled paper"),
      description: abstractFromInverted(work.abstract_inverted_index as Record<string, number[]> | null),
      source: String(source?.display_name || "OpenAlex"),
      sourceUrl: String(work.doi || work.id || ""),
      year: Number(work.publication_year || 0) || null,
      priority: "MEDIUM",
      confidence: "MEDIUM",
      confidenceScore: 70,
      priorityReason: "A recent scholarly record matched this watchlist.",
      evidence: "Scheduled OpenAlex source check",
      recommendedAction: "Review the source and save it if it advances your work.",
      detectedAt: new Date().toISOString(),
      dismissed: false,
      saved: false,
    };
  });
}

function daysUntil(value: unknown) {
  if (!value) return null;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86_400_000) : null;
}

async function searchGrants(query: string) {
  const response = await fetch(GRANTS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows: 5, keyword: query, oppStatuses: "forecasted|posted" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Grants.gov failed: ${response.status}`);
  const payload = await response.json();
  return (payload.data?.oppHits || []).map((hit: JsonRecord) => {
    const remaining = daysUntil(hit.closeDate);
    const highPriority = remaining !== null && remaining >= 0 && remaining <= 45;
    return {
      externalId: `grants:${hit.id}`,
      type: "opportunity",
      title: String(hit.title || "Untitled opportunity"),
      description: `${hit.agency || hit.agencyName || "Official funding notice"} · deadline ${hit.closeDate || "not listed"}`,
      source: "Grants.gov",
      sourceUrl: `https://www.grants.gov/search-results-detail/${hit.id}`,
      agency: String(hit.agency || hit.agencyName || ""),
      deadline: String(hit.closeDate || ""),
      priority: highPriority ? "HIGH" : "MEDIUM",
      confidence: "HIGH",
      confidenceScore: 90,
      priorityReason: highPriority ? "The official deadline is within 45 days." : "An official funding record matched this watchlist.",
      evidence: "Scheduled Grants.gov source check",
      recommendedAction: "Open the official notice and verify eligibility and deadline details.",
      detectedAt: new Date().toISOString(),
      dismissed: false,
      saved: false,
    };
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Monitoring backend is not configured." }, 503);

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = request.headers.get("x-eylo-cron-token") || "";
  const { data: stored, error: secretError } = await client
    .from("system_secrets")
    .select("secret_hash")
    .eq("name", "monitor_cron")
    .maybeSingle();
  const incomingHash = token ? await sha256(token) : "";
  if (secretError || !stored?.secret_hash || !sameString(incomingHash, stored.secret_hash)) {
    return json({ error: "Scheduled monitoring authorization required." }, 401);
  }

  const [{ data: watchlists, error: watchlistError }, { data: discoveries, error: discoveryError }] = await Promise.all([
    client.from("watchlists").select("id,user_id,data").order("updated_date", { ascending: true }).limit(MAX_WATCHLISTS_PER_RUN),
    client.from("monitoring_discoveries").select("user_id,data").order("created_date", { ascending: false }).limit(5000),
  ]);
  if (watchlistError || discoveryError) {
    return json({ error: "Could not load monitoring records." }, 500);
  }

  const seen = new Set((discoveries || []).map((row) => `${row.user_id}:${row.data?.externalId || ""}`));
  let inserted = 0;
  let notifications = 0;
  let failed = 0;

  for (const row of watchlists || []) {
    const watchlist = (row.data || {}) as JsonRecord;
    const query = String(watchlist.query || "").trim();
    if (!query || watchlist.active === false) continue;

    try {
      const records = watchlist.type === "funding program"
        ? await searchGrants(query)
        : await searchOpenAlex(query);

      for (const record of records) {
        const dedupeKey = `${row.user_id}:${record.externalId}`;
        if (!record.externalId || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const discovery = {
          ...record,
          watchlistId: row.id,
          watchQuery: query,
          watchlistType: String(watchlist.type || "topic"),
        };
        const { error: insertError } = await client
          .from("monitoring_discoveries")
          .insert({ user_id: row.user_id, data: discovery });
        if (insertError && insertError.code !== "23505") throw insertError;
        if (!insertError) inserted += 1;

        if (record.priority === "HIGH" && !insertError) {
          const { error: notificationError } = await client.from("notifications").insert({
            user_id: row.user_id,
            data: {
              discoveryId: record.externalId,
              title: record.title,
              description: record.priorityReason,
              priority: record.priority,
              type: record.type,
              sourceUrl: record.sourceUrl,
              read: false,
              createdAt: record.detectedAt,
            },
          });
          if (notificationError) throw notificationError;
          notifications += 1;
        }
      }

      const { error: updateError } = await client
        .from("watchlists")
        .update({ data: { ...watchlist, lastCheckedAt: new Date().toISOString(), lastResultCount: records.length } })
        .eq("id", row.id);
      if (updateError) throw updateError;
    } catch (error) {
      failed += 1;
      console.error("Watchlist check failed", { watchlistId: row.id, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return json({
    checked: (watchlists || []).length,
    inserted,
    notifications,
    failed,
    completed_at: new Date().toISOString(),
  });
});
