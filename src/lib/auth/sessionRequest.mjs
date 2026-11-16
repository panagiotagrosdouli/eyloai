export class SessionChangedError extends Error {
  constructor() {
    super('Your account changed while this request was running. Please try again.');
    this.name = 'SessionChangedError';
    this.code = 'SESSION_CHANGED';
  }
}

/** Keep a request and its one authentication retry within the initiating account.
 * Auth event callbacks stay synchronous and never call back into the Auth SDK.
 */
export async function sessionRequest(url, options, {
  auth, getUsableSession, invalidateAuthentication, fetchImpl = fetch,
}) {
  options?.signal?.throwIfAborted();
  const controller = new AbortController();
  const signal = options?.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  let ownerId;
  let changed = false;
  let observedUserId;
  const { data: listener } = auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    observedUserId = session?.user?.id ?? null;
    if (event === 'SIGNED_OUT' || (ownerId && observedUserId !== ownerId)) {
      changed = true;
      controller.abort(new SessionChangedError());
    }
  });
  const assertOwner = session => {
    if (changed || !ownerId || session?.user?.id !== ownerId
      || (observedUserId !== undefined && observedUserId !== ownerId)) {
      throw new SessionChangedError();
    }
    signal.throwIfAborted();
  };
  let bodyGuardActive = false;
  let abortBody;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    listener.subscription.unsubscribe();
    if (abortBody) signal.removeEventListener('abort', abortBody);
  };
  const currentSession = async () => {
    const result = await auth.getSession();
    if (result.error) throw result.error;
    return result.data?.session;
  };
  const send = async forceRefresh => {
    assertOwner(await currentSession());
    const session = await getUsableSession({
      forceRefresh, required: true, validate: true,
      expectedUserId: ownerId, signal,
    });
    assertOwner(session);
    assertOwner(await currentSession());
    const headers = new Headers(options?.headers);
    headers.set('authorization', `Bearer ${session.access_token}`);
    const response = await fetchImpl(url, { ...options, headers, signal });
    assertOwner(await currentSession());
    return { response, session };
  };
  try {
    const initial = await currentSession();
    ownerId = initial?.user?.id;
    // Let the existing session path report a missing session consistently.
    if (!ownerId) {
      await getUsableSession({ required: true, validate: true });
      throw new SessionChangedError();
    }
    let { response, session } = await send(false);
    if (response.status === 401) {
      await response.body?.cancel();
      ({ response, session } = await send(true));
    }
    if (response.status === 401) {
      assertOwner(await currentSession());
      throw await invalidateAuthentication(undefined, session.access_token);
    }
    if (!response.body) return response;
    // Keep both cancellation and the account boundary alive while callers
    // consume JSON or an EYRA event stream, not just until headers arrive.
    const reader = response.body.getReader();
    const body = new ReadableStream({
      start(stream) {
        abortBody = () => {
          void reader.cancel(signal.reason).catch(() => {});
          stream.error(signal.reason);
          cleanup();
        };
        signal.addEventListener('abort', abortBody, { once: true });
      },
      async pull(stream) {
        try {
          signal.throwIfAborted();
          const item = await reader.read();
          signal.throwIfAborted();
          if (item.done) { stream.close(); cleanup(); }
          else stream.enqueue(item.value);
        } catch (error) {
          stream.error(error);
          cleanup();
        }
      },
      cancel(reason) { cleanup(); return reader.cancel(reason); },
    });
    bodyGuardActive = true;
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally {
    if (!bodyGuardActive) cleanup();
  }
}
