/* ============================================================
   كارب — عامل الخدمة (Service Worker)
   ------------------------------------------------------------
   ⚠️ درس مهم: النسخة السابقة كانت "الذاكرة أولًا" لكل الطلبات،
   فكان المستخدم يبقى على نسخة قديمة حتى بعد رفع تحديث جديد.
   الحل: الصفحة والسكربتات تُطلب من الشبكة أولًا (فيصل التحديث فورًا)،
   والصور والأيقونات من الذاكرة أولًا (فتبقى سريعة ولا تتغير كثيرًا).
   ============================================================ */
const CACHE_NAME = "karb-cache-v3";
const CORE_ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./logo.png", "./logo-dark.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* يسمح للصفحة بطلب تفعيل النسخة الجديدة فورًا */
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // اترك Supabase/CDN للشبكة مباشرة

  const isDoc = req.mode === "navigate" || req.destination === "document" || url.pathname.endsWith(".html");

  if (isDoc) {
    /* الشبكة أولًا: يضمن أن أي تحديث ترفعه يصل للعميل فورًا،
       ومع ذلك يعمل التطبيق دون إنترنت عبر النسخة المحفوظة. */
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  /* بقية الملفات (صور/أيقونات): الذاكرة أولًا مع تحديث صامت في الخلفية */
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
