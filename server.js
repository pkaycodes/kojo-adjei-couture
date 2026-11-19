'use strict';

/**
 * Minimal static file server for the Kojo Adjei Couture preview site.
 *
 * Hostinger's Node.js hosting expects an application that listens on the port
 * it provides. This serves the files in this folder (index.html, styles.css,
 * script.js, assets/) directly, with no build step and no dependencies.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createReadStream } = fs;

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json'
};

function sendError(res, status, message, isHead) {
  const body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${status}</title>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EDE7DD;color:#12100E;font:400 16px/1.6 Georgia,serif;text-align:center}h1{font-size:3rem;margin:0 0 .5rem;letter-spacing:.02em}p{margin:0;opacity:.7}</style>` +
    `</head><body><main><h1>${status}</h1><p>${message}</p></main></body></html>`;

  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(isHead ? undefined : body);
}

/** Resolve a URL path to a real file inside ROOT, or null if it escapes ROOT. */
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const target = path.join(ROOT, path.normalize(decoded));
  const resolved = path.resolve(target);

  // Block path traversal outside the project root.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;

  return resolved;
}

const server = http.createServer((req, res) => {
  const isHead = req.method === 'HEAD';

  if (req.method !== 'GET' && !isHead) {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(isHead ? undefined : 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    sendError(res, 400, 'Bad request.', isHead);
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = resolveFile(pathname);
  if (!filePath) {
    sendError(res, 403, 'Forbidden.', isHead);
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    // "Pretty" URLs: /collection -> collection.html, /collection/ -> collection/index.html
    let finalPath = filePath;
    let finalStats = stats;

    if (statErr || !stats.isFile()) {
      const htmlCandidate = `${filePath}.html`;
      const resolvedHtml = path.resolve(htmlCandidate);

      if (resolvedHtml.startsWith(ROOT + path.sep) && fs.existsSync(resolvedHtml) && fs.statSync(resolvedHtml).isFile()) {
        finalPath = resolvedHtml;
        finalStats = fs.statSync(resolvedHtml);
      } else {
        const indexCandidate = path.join(filePath, 'index.html');
        if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
          finalPath = indexCandidate;
          finalStats = fs.statSync(indexCandidate);
        } else {
          sendError(res, 404, 'That page could not be found.', isHead);
          return;
        }
      }
    }

    const ext = path.extname(finalPath).toLowerCase();
    const isHtml = ext === '.html';
    const etag = `W/"${finalStats.size.toString(16)}-${finalStats.mtimeMs.toString(16)}"`;

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': finalStats.size,
      'Last-Modified': finalStats.mtime.toUTCString(),
      ETag: etag,
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });

    if (isHead) {
      res.end();
      return;
    }

    const stream = createReadStream(finalPath);
    stream.on('error', () => {
      if (!res.headersSent) sendError(res, 500, 'Something went wrong.', false);
      else res.destroy();
    });
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Kojo Adjei Couture preview running on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
