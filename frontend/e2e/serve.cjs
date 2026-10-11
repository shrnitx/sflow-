const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../build");
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  let target = path.resolve(root, "." + pathname);
  if (!target.startsWith(root + path.sep) && target !== root) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (target === root) target = path.join(root, "index.html");
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    target = path.join(root, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write("StudyFlow smoke server listening on " + port + "\n");
});
