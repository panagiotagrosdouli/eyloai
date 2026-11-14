import test from "node:test";
import assert from "node:assert/strict";
import { discoveryGatewayError } from "../src/lib/discovery-gateway-error.mjs";
import { searchAllPapersWithStatus } from "../src/lib/eyra-api.js";
import { formatUnavailableSource } from "../src/lib/discovery-source-status.js";

test("gateway health codes are allowlisted and HTTP-bound without reflecting upstream messages", async () => {
  const error = await discoveryGatewayError(
    new Response(
      JSON.stringify({
        code: "DISCOVERY_RATE_LIMIT_UNAVAILABLE",
        error: "secret upstream details",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    ),
  );
  assert.equal(error.code, "DISCOVERY_RATE_LIMIT_UNAVAILABLE");
  assert.equal(error.status, 503);
  assert.equal(error.message.includes("secret"), false);
  const wrongStatus = await discoveryGatewayError(
    new Response('{"code":"DISCOVERY_RATE_LIMIT_UNAVAILABLE"}', {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(wrongStatus.code, undefined);
  const unknown = await discoveryGatewayError(
    new Response('{"code":"DATABASE_SECRET_UNSET"}', {
      status: 503,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(unknown.code, undefined);
});

test("malformed and oversized gateway bodies preserve status but never produce trusted codes", async () => {
  for (const body of [
    "<html>503 error</html>",
    '{"code":"DISCOVERY_RATE_LIMIT_UNAVAILABLE"' + " ".repeat(9000),
  ]) {
    const error = await discoveryGatewayError(
      new Response(body, {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    assert.equal(error.code, undefined);
    assert.equal(error.status, 503);
  }
});

test("search reports a failed EYLO gateway separately from provider health and never falls back directly", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response('{"code":"DISCOVERY_RATE_LIMIT_UNAVAILABLE"}', {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await searchAllPapersWithStatus("sleep learning", {
      proxyBaseUrl: "https://gateway.example",
    });
    assert.equal(requests.length, 5);
    assert.ok(
      requests.every((url) =>
        url.startsWith("https://gateway.example/api/discovery?"),
      ),
    );
    assert.equal(result.papers.length, 0);
    assert.equal(result.available_source_count, 0);
    assert.ok(
      result.source_status.every(
        (source) =>
          source.error_status === 503 &&
          source.error_code === "DISCOVERY_RATE_LIMIT_UNAVAILABLE",
      ),
    );
    assert.match(
      formatUnavailableSource(result.source_status[0]),
      /through EYLO’s research connection/,
    );
    assert.doesNotMatch(
      formatUnavailableSource(result.source_status[0]),
      /OpenAlex is temporarily unavailable/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("the shared EYLO quota and provider-specific429 are described separately", async () => {
  const error = await discoveryGatewayError(
    new Response('{"code":"DISCOVERY_RATE_LIMITED"}', {
      status: 429,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(error.code, "DISCOVERY_RATE_LIMITED");
  assert.match(
    formatUnavailableSource({
      label: "arXiv",
      error_code: error.code,
      error_status: 429,
    }),
    /EYLO’s search limit/,
  );
  assert.equal(
    formatUnavailableSource({ label: "Semantic Scholar", error_status: 429 }),
    "Semantic Scholar is rate limited (HTTP 429)",
  );
});
