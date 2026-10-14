// Serves the static export (out/) the way GitHub Pages serves this project
// site, for the production e2e specs: under /blocker-rush, a directory
// without its trailing slash redirects to it, a directory serves its
// index.html, the Content-Type comes from the extension, and anything
// missing gets 404.html with a 404.
//
// Usage: node scripts/serve-pages.mjs <port>   (from apps/web, after a build)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_PATH = "/blocker-rush";
const ROOT = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.argv[2] ?? 3300);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const isFile = async (path) => (await stat(path).catch(() => null))?.isFile() ?? false;
const isDir = async (path) => (await stat(path).catch(() => null))?.isDirectory() ?? false;

const send = async (res, path, status = 200) => {
  res.writeHead(status, {
    "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
    "Cache-Control": "max-age=600",
  });
  res.end(await readFile(path));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
    res.writeHead(404).end();
    return;
  }
  const path = join(ROOT, normalize(pathname.slice(BASE_PATH.length)));
  if (!path.startsWith(ROOT.replace(/\/$/, ""))) {
    res.writeHead(404).end();
    return;
  }
  if (await isDir(path)) {
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` }).end();
    } else if (await isFile(join(path, "index.html"))) {
      await send(res, join(path, "index.html"));
    } else {
      await send(res, join(ROOT, "404.html"), 404);
    }
  } else if (await isFile(path)) {
    await send(res, path);
  } else if (await isFile(`${path}.html`)) {
    await send(res, `${path}.html`);
  } else {
    await send(res, join(ROOT, "404.html"), 404);
  }
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${BASE_PATH}/`));
