# EYRA streaming consumption and cancellation — 2026-11-16

## Problem

The canonical EYRA endpoint reserves a free-tier usage action before the OpenAI Responses call and emits streamed text deltas before a final `response.completed` event. Previously, **every stream exception** unconditionally called the quota-release RPC, including a browser disconnect after readable model text was already transmitted. Repeated user-initiated disconnects could then obtain AI output without consuming the corresponding monthly allowance.

## Bounded source fix

- Record whether the server wrote a nonempty streamed text delta.
- Record whether the response connection closed before the normal `end()` path.
- If **both** events occurred, do **not** refund the reserved usage action when aborting the upstream stream. There is no confirmed full answer and the browser must not save the draft as completed.
- If the stream is incomplete because the upstream fails **without** a client disconnect, preserve existing refund behavior and send `EYRA_INCOMPLETE` rather than a successful final answer.
- Never make an additional provider request to determine refund eligibility and never write any raw response content to logs.

## Verification

`tests/eyra-stream-api.test.mjs` includes a simulated OpenAI SSE provider with an in-flight stream that aborts when the consumer closes the response after the first text delta. It asserts one provider request, transport cancellation, no quota refund and no completed event. The existing provider-incomplete test continues to require a refund and no successful answer.

**Not verified in hosted staging.** Before production, use two disposable, isolated users to verify quota consistency with real `reserve_eyra_usage` / `release_eyra_usage`, genuine browser AbortSignals, lost networks and provider errors. Inspect abuse limits and reconciliations on an owner-confirmed nonproduction deployment.

This is not a user payment charge; it preserves EYLO's monthly AI-action quota. No live billing or database changes are authorized by this patch.
