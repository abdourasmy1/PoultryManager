const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve("dist");
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
const files = walk(root)
  .filter(
    (f) =>
      !f.includes("/android/") &&
      !f.includes("/ios/") &&
      !f.endsWith(".hbc") &&
      !f.endsWith("service-worker.js") &&
      !f.endsWith("metadata.json"),
  )
  .map((f) => "/" + path.relative(root, f));
const hash = crypto
  .createHash("sha256")
  .update(files.join("\n"))
  .digest("hex")
  .slice(0, 12);
fs.writeFileSync(
  path.join(root, "service-worker.js"),
  `
const CACHE='poultry-${hash}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting();})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('poultry-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const hit=await caches.match(event.request);if(hit)return hit;
    try{return await fetch(event.request);}catch{
      if(event.request.mode==='navigate'){const page=await caches.match('/index.html');if(page)return page;}
      return Response.error();
    }
  })());
});
`,
);
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html
  .replace('<html lang="en">', '<html lang="ar">')
  .replace(
    /<title>.*?<\/title>/,
    "<title>مدير الدواجن | تجارتك في نظرة واحدة</title>",
  )
  .replace(
    "</head>",
    '<meta name="theme-color" content="#216A50"><meta name="description" content="إدارة مشتريات ومبيعات الدواجن، الحسابات، المخزون والأرباح في مكان واحد."></head>',
  )
  .replace(
    "</body>",
    "<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));}</script></body>",
  );
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("Offline cache prepared for " + files.length + " local assets.");
