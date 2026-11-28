#!/usr/bin/env python3
"""Real two-user acceptance against Supabase CLI services on loopback only."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlencode, urlparse

API = os.environ.get("API_URL", "http://127.0.0.1:54321").rstrip("/")
ANON = os.environ["ANON_KEY"]
SERVICE = os.environ["SERVICE_ROLE_KEY"]
DB_URL = os.environ["DB_URL"]

def local_target(value, expected_port):
    parsed = urlparse(value)
    if parsed.hostname not in ("127.0.0.1", "localhost", "::1") or parsed.port != expected_port:
        raise RuntimeError("Refusing non-loopback Supabase target")

local_target(API, 54321)
local_target(DB_URL, 54322)

ROOT = Path(__file__).resolve().parents[2]
plan = json.loads((ROOT / "supabase/migration-review-plan.json").read_text())
if plan.get("remote_application_authorized") is not False or plan.get("scope") != "disposable-canonical-test-replay-only":
    raise RuntimeError("Migration plan is not explicitly local-only")
migrations = plan.get("canonical_local_order")
if not migrations:
    raise RuntimeError("No canonical local migration order")
migration_root = (ROOT / "supabase/migrations").resolve()
for name in migrations:
    if not re.fullmatch(r"[0-9]{8,14}_[A-Za-z0-9_-]+\.sql", name):
        raise RuntimeError("Unsafe migration name: " + str(name))
    path = (migration_root / name).resolve()
    if path.parent != migration_root or not path.is_file():
        raise RuntimeError("Migration missing or escaped migrations directory: " + name)
    result = subprocess.run(
        ["psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", DB_URL, "--file", str(path)],
        text=True, capture_output=True
    )
    if result.returncode:
        print(result.stdout, end="")
        print(result.stderr, end="")
        raise RuntimeError("Supabase local migration failed: " + name)
    print("APPLIED in disposable Supabase: " + name, flush=True)

subprocess.run(
    ["psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", DB_URL,
     "--command", "notify pgrst, 'reload schema'"],
    check=True, capture_output=True, text=True
)
time.sleep(1)

def call(path, method="GET", token=None, body=None, headers=None, expected=True):
    h = {"apikey": ANON, "Authorization": "Bearer " + (token or ANON)}
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read()
            if expected and not 200 <= response.status < 300:
                raise AssertionError("HTTP {} for {}".format(response.status, path))
            try:
                payload = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                payload = raw.decode(errors="replace")
            return response.status, payload, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        if expected:
            raise AssertionError("HTTP {} for {}: {}".format(exc.code, path, raw[:500].decode(errors="replace")))
        return exc.code, None, raw

admin_headers = {"apikey": SERVICE, "Authorization": "Bearer " + SERVICE}
def admin_create(email, password):
    req = urllib.request.Request(API + "/auth/v1/admin/users", data=json.dumps({
        "email": email, "password": password, "email_confirm": True
    }).encode(), headers={**admin_headers, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.loads(response.read())

def admin_delete(user_id):
    req = urllib.request.Request(API + "/auth/v1/admin/users/" + user_id, headers=admin_headers, method="DELETE")
    with urllib.request.urlopen(req, timeout=15) as response:
        if not 200 <= response.status < 300:
            raise AssertionError("Disposable Auth cleanup failed")

nonce = str(uuid.uuid4())
password = "Eylo-Local-" + str(uuid.uuid4()) + "-aA9!"
email_a = "eylo-a-" + nonce + "@example.test"
email_b = "eylo-b-" + nonce + "@example.test"
user_a = user_b = token_a = token_b = None
object_a = object_b = None
try:
    user_a = admin_create(email_a, password)
    user_b = admin_create(email_b, password)
    assert user_a["id"] != user_b["id"]
    def signin(email):
        _, payload, _ = call("/auth/v1/token?grant_type=password", method="POST", body={"email": email, "password": password})
        assert payload.get("access_token") and payload.get("user", {}).get("id")
        return payload
    session_a = signin(email_a)
    session_b = signin(email_b)
    token_a, token_b = session_a["access_token"], session_b["access_token"]
    assert session_a["user"]["id"] == user_a["id"]
    assert session_b["user"]["id"] == user_b["id"]
    call("/rest/v1/")

    snapshot_id = str(uuid.uuid4())
    _, snapshot, _ = call("/rest/v1/rpc/save_eyra_conversation_snapshot", method="POST", token=token_a, body={
        "p_title": "Disposable integration conversation",
        "p_snapshot_id": snapshot_id,
        "p_messages": [
            {"role": "user", "text": "Synthetic acceptance question", "sources": []},
            {"role": "assistant", "text": "Synthetic persisted answer", "sources": []}
        ]
    })
    if isinstance(snapshot, list):
        snapshot = snapshot[0]
    assert snapshot["id"] == snapshot_id
    _, own_thread, _ = call("/rest/v1/eyra_conversations?id=eq." + snapshot_id + "&select=id,title,version", token=token_a)
    _, own_messages, _ = call("/rest/v1/eyra_messages?conversation_id=eq." + snapshot_id + "&select=role,sequence_number,content&order=sequence_number.asc", token=token_a)
    assert len(own_thread) == 1 and [row["sequence_number"] for row in own_messages] == [1, 2]
    assert own_messages[1]["content"]["text"] == "Synthetic persisted answer"
    _, foreign_thread, _ = call("/rest/v1/eyra_conversations?id=eq." + snapshot_id + "&select=id", token=token_b)
    _, foreign_messages, _ = call("/rest/v1/eyra_messages?conversation_id=eq." + snapshot_id + "&select=id", token=token_b)
    assert foreign_thread == [] and foreign_messages == []
    status, _, _ = call("/rest/v1/eyra_conversations", method="POST", token=token_b,
                        body={"user_id": user_a["id"], "title": "Spoofed owner"},
                        headers={"Prefer": "return=representation"}, expected=False)
    assert status >= 400, "PostgREST must reject an owner-spoofed conversation insert"
    status, _, _ = call("/rest/v1/eyra_conversations?id=eq." + snapshot_id + "&select=id", expected=False)
    assert status >= 400, "Anonymous request must be rejected"
    print("PASS: real local Auth, PostgREST, EYRA snapshot restore and conversation/message owner isolation")

    run_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    request_hash = hashlib.sha256(("acceptance:" + request_id).encode()).hexdigest()
    _, run_rows, _ = call("/rest/v1/eyra_agent_runs", method="POST", token=SERVICE,
        body={"id": run_id, "user_id": user_a["id"], "request_id": request_id,
              "request_hash": request_hash, "input_preview": "Synthetic local acceptance"},
        headers={"Prefer": "return=representation"})
    assert run_rows[0]["id"] == run_id
    action_id = str(uuid.uuid4())
    _, action_rows, _ = call("/rest/v1/eyra_agent_actions", method="POST", token=SERVICE,
        body={"id": action_id, "run_id": run_id, "user_id": user_a["id"], "call_id": "local-check",
              "tool_name": "search", "arguments_hash": hashlib.sha256(b"{}").hexdigest()},
        headers={"Prefer": "return=representation"})
    assert action_rows[0]["id"] == action_id
    _, own_runs, _ = call("/rest/v1/eyra_agent_runs?id=eq." + run_id + "&select=id,status", token=token_a)
    _, foreign_runs, _ = call("/rest/v1/eyra_agent_runs?id=eq." + run_id + "&select=id", token=token_b)
    assert len(own_runs) == 1 and foreign_runs == []
    status, _, _ = call("/rest/v1/eyra_agent_runs", method="POST", token=token_a,
        body={"user_id": user_a["id"], "request_id": str(uuid.uuid4()),
              "request_hash": hashlib.sha256(b"denied").hexdigest(), "input_preview": "Must be denied"},
        expected=False)
    assert status >= 400, "Authenticated clients must not write service-only ledger rows"
    print("PASS: service-only EYRA run/action writes and owner-isolated ledger reads")

    object_a = user_a["id"] + "/acceptance-" + nonce + ".txt"
    object_b = user_b["id"] + "/acceptance-" + nonce + ".txt"
    def storage(path, method, token, payload=None):
        route = "authenticated/eylo-files/" + path if method == "GET" else "eylo-files/" + path
        headers = {"apikey": ANON, "Authorization": "Bearer " + token, "Content-Type": "text/plain"}
        if method == "POST":
            headers["x-upsert"] = "false"
        req = urllib.request.Request(API + "/storage/v1/object/" + route,
                                     data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()
    assert storage(object_a, "POST", token_a, b"synthetic account A file")[0] < 300
    status, content = storage(object_a, "GET", token_a)
    assert status < 300 and content == b"synthetic account A file"
    assert storage(object_a, "GET", token_b)[0] >= 400
    assert storage(object_a, "POST", token_b, b"cross-account overwrite")[0] >= 400
    assert storage(object_b, "POST", token_b, b"synthetic account B file")[0] < 300
    print("PASS: real local private Storage upload/read and cross-account denial")
    assert storage(object_a, "DELETE", token_a)[0] < 300
    object_a = None
    assert storage(object_b, "DELETE", token_b)[0] < 300
    object_b = None
finally:
    for token, path in ((token_a, object_a), (token_b, object_b)):
        if token and path:
            storage(path, "DELETE", token)
    for user in (user_a, user_b):
        if user and user.get("id"):
            admin_delete(user["id"])
print("PASS: disposable Auth identities and private Storage objects cleaned up")

