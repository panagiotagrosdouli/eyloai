/* Static shell only: never API/Auth/Supabase responses or document bytes. */
const CACHE = "eylo-offline-shell-v1";
self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
const staticAsset = (raw) => {
  try {
    const url = new URL(raw, self.location.origin);
    return url.origin === self.location.origin &&
      /^\/assets\/[A-Za-z0-9_.-]+$/.test(url.pathname) &&
      !url.search
      ? url
      : null;
  } catch {
    return null;
  }
};
self.addEventListener("message", (event) => {
  if (event.data?.type !== "EYLO_CACHE_SHELL") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE),
        failures = [];
      let total = 0,
        shellReady = false;
      try {
        const shell = await fetch("/");
        if (
          !shell.ok ||
          !shell.headers.get("content-type")?.includes("text/html")
        )
          throw new Error("Shell unavailable");
        const html = await shell.clone().text();
        if (html.length > 1048576) throw new Error("Shell budget exceeded");
        const urls = [
          ...(Array.isArray(event.data.urls) ? event.data.urls : []),
          ...Array.from(
            html.matchAll(/(?:src|href)="([^"<>]+)"/g),
            (match) => match[1],
          ),
        ];
        const assets = [
          ...new Set(
            urls
              .map(staticAsset)
              .filter(Boolean)
              .map((url) => url.href),
          ),
        ];
        if (!assets.length || assets.length > 100)
          throw new Error("Invalid static asset coverage");
        // Bound this cache across app updates; failed preparation is never reported ready.
        for (const request of await cache.keys()) await cache.delete(request);
        await cache.put("/offline-shell", shell);
        shellReady = true;
        for (const asset of assets) {
          try {
            const response = await fetch(asset);
            if (
              !response.ok ||
              Number(response.headers.get("content-length")) > 5242880
            )
              throw new Error("Asset unavailable");
            const bytes = await response.clone().arrayBuffer();
            if (
              bytes.byteLength > 5242880 ||
              total + bytes.byteLength > 20971520
            )
              throw new Error("Cache budget exceeded");
            total += bytes.byteLength;
            await cache.put(asset, response);
          } catch {
            failures.push(asset);
          }
        }
      } catch {
        failures.push("shell");
      }
      event.ports?.[0]?.postMessage({
        cached: shellReady && failures.length === 0,
        failures: failures.length,
      });
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (event.request.mode === "navigate" && url.pathname === "/offline")
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          (await caches.match("/offline-shell", {
            cacheName: CACHE,
            ignoreVary: true,
          })) ||
          new Response("Prepare Offline access while online first.", {
            status: 503,
          }),
      ),
    );
  else if (staticAsset(url.href))
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          (await caches.match(event.request, {
            cacheName: CACHE,
            ignoreVary: true,
          })) || new Response("Asset unavailable offline.", { status: 503 }),
      ),
    );
});
