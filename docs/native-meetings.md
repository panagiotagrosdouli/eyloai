# EYLO Native Meetings

EYLO native calls use LiveKit as the WebRTC selective forwarding unit (SFU). React clients connect to the LiveKit endpoint for encrypted audio/video transport. Vercel's `/api/meeting-room` endpoint handles authenticated room lifecycle, invitation membership and short-lived access tokens; it does not relay media.

## Required configuration

Configure these environment variables on a non-production preview/staging deployment before testing calls:

- `LIVEKIT_URL`: public TLS `wss://` endpoint reachable by browsers.
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`: LiveKit server credentials. Keep them server-only; do not use a `VITE_` prefix.
- Existing `VITE_SUPABASE_URL`, Supabase publishable/anon key and server secret key: the endpoint authenticates each user with Supabase Auth and uses the server key only after authentication to check meeting ownership and memberships.
- `APP_URL`: canonical HTTPS EYLO origin used to construct invitation links (defaults to `https://eyloai.vercel.app`).

LiveKit may be a managed provider or self-hosted. Self-hosting requires a persistent LiveKit server, a TLS endpoint, valid TURN/STUN configuration for restrictive networks, open UDP media ports (and the configured TCP fallback), monitoring and capacity management. Vercel serverless functions are not the media server. No media endpoint or credentials are bundled in this repository.

## Access model

- Meeting owners start/end rooms. Room names are derived server-side from the meeting and LiveKit secret; clients cannot choose them.
- Access tokens are minted after Supabase authentication and are valid for ten minutes. Their identity is a pseudonymous hash, with host moderation grants only for the owner.
- Participants can join only after accepting an invitation created by the owner. Invitations are bound to a verified account email, stored as a SHA-256 token hash, expire after seven days and are single use.
- Invitation delivery is not configured. EYLO creates a restricted link for the host to share; it does not claim an email was sent.
- Chat messages are sent as LiveKit data packets and are not persisted by EYLO. The current client does not record or transcribe calls.
- Historical external meeting links remain in their meeting records and open in a separate tab. New rooms are native EYLO/LiveKit rooms.

## Database migration

`supabase/migrations/20261110_native_video_meetings.sql` adds owner-scoped invitations and participant membership with RLS. Review and apply it through the project's standard Supabase migration process in staging first. It has not been applied to production from this change.

## Verification boundary

Repository checks validate the API's fail-closed configuration and unauthenticated rejection paths. They do not establish real two-user media connectivity. A real call requires the migration, configured LiveKit endpoint and credentials, two separately authenticated staging accounts, and browser permission to use microphones/cameras. The owner should complete the two-user audio/video, reconnection, screen share and mobile test before enabling native calls in production.

## Real two-account browser verification

The opt-in Playwright run in `tests/e2e-native-meetings.mjs` uses two separate browser contexts and two existing, verified staging accounts. It does not stub the meeting API, LiveKit, camera or microphone and it does not create fake media devices. The default browser is headed so the machine's actual camera and microphone are used. Screen sharing requires a person to select a screen/window in the browser chooser.

Use a dedicated HTTPS staging or preview deployment with the native-meetings migration already applied and LiveKit configured. Do not point this test at production. It creates a real meeting record in the staging workspace; the host ends the room at the end of a successful run, while the record remains subject to normal meeting retention.

Install the project's Playwright Chromium binary if needed (`npx playwright install chromium`), then set these environment variables in a local shell or secret manager:

- `EYLO_E2E_BASE_URL`: HTTPS staging origin. The script explicitly refuses `https://eyloai.vercel.app`.
- `EYLO_E2E_ALLOWED_HOST`: exact approved preview hostname (for example `eylo-preview-xyz.vercel.app`), separate from the URL. The script refuses mismatched hosts, credentials in URLs and known live EYLO hostnames.
- `EYLO_E2E_HOST_EMAIL` and `EYLO_E2E_HOST_PASSWORD`: verified staging host account.
- `EYLO_E2E_GUEST_EMAIL` and `EYLO_E2E_GUEST_PASSWORD`: a different verified staging account.
- `EYLO_E2E_CONFIRM_DATA_MUTATION=YES`: explicit acknowledgement that the test creates a staging meeting.

Run `npm run test:e2e:meetings`. The test checks invitation binding flow, two connected participants, live camera and audio tracks received in both browsers, chat delivery, microphone and camera toggles, guest leave, and host termination. It prints a PASS record only after these checks complete. Passwords and invitation tokens are not written to its output.

Optional checks:

- `EYLO_E2E_SCREEN_SHARE=1`: perform the browser sharing selection when prompted; verifies that the second participant receives the additional live screen video track.
- `EYLO_E2E_RECONNECT=1`: briefly takes the guest browser offline and checks that both sides return to the connected state.
- `EYLO_E2E_HEADLESS=true`: run headless only where real camera/microphone devices are correctly exposed to Chromium. The recommended real-device verification is headed.

This repository does not currently have credentials or a connected staging media service available to execute this run. A successful build or mocked test must not be reported as proof of live two-user calling. Record the actual output, browser/device environment and optional checks when a maintainer runs this against staging.
