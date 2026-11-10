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
