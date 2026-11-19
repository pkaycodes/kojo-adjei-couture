'use strict';

/**
 * Minimal static file server.
 *
 * Hostinger's Node.js hosting expects an application that listens on the port
 * it provides. This serves the files in this folder directly, with no build
 * step and no dependencies.
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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
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

/** Resolve a URL path to a real path inside ROOT, or null if it escapes ROOT. */
function resolvePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const resolved = path.resolve(path.join(ROOT, path.normalize(decoded)));

  // Block path traversal outside the project root.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;

  return resolved;
}

function statFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

/** Parse a single "bytes=start-end" Range header. Returns null when unusable. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;

  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffixLength = Number(rawEnd);
    if (!suffixLength) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
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

  const requestedPath = resolvePath(pathname);
  if (!requestedPath) {
    sendError(res, 403, 'Forbidden.', isHead);
    return;
  }

  // "Pretty" URLs: /menu -> menu.html, /menu/ -> menu/index.html
  let finalPath = requestedPath;
  let stats = statFile(finalPath);

  if (!stats) {
    const asHtml = `${requestedPath}.html`;
    if (asHtml.startsWith(ROOT + path.sep)) stats = statFile(asHtml), finalPath = asHtml;
  }
  if (!stats) {
    const asIndex = path.join(requestedPath, 'index.html');
    stats = statFile(asIndex);
    if (stats) finalPath = asIndex;
  }
  if (!stats) {
    sendError(res, 404, 'That page could not be found.', isHead);
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const etag = `W/"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Accept-Ranges': 'bytes' });
    res.end();
    return;
  }

  const baseHeaders = {
    'Content-Type': contentType,
    'Last-Modified': stats.mtime.toUTCString(),
    ETag: etag,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes'
  };

  // Partial content for video/audio seeking.
  if (req.headers.range) {
    const range = parseRange(req.headers.range, stats.size);

    if (!range) {
      res.writeHead(416, Object.assign({}, baseHeaders, { 'Content-Range': `bytes */${stats.size}` }));
      res.end();
      return;
    }

    res.writeHead(206, Object.assign({}, baseHeaders, {
      'Content-Range': `bytes ${range.start}-${range.end}/${stats.size}`,
      'Content-Length': range.end - range.start + 1
    }));

    if (isHead) {
      res.end();
      return;
    }

    const partial = createReadStream(finalPath, { start: range.start, end: range.end });
    partial.on('error', () => res.destroy());
    partial.pipe(res);
    return;
  }

  res.writeHead(200, Object.assign({}, baseHeaders, { 'Content-Length': stats.size }));

  if (isHead) {
    res.end();
    return;
  }

  const stream = createReadStream(finalPath);
  stream.on('error', () => {
    if (!res.headersSent) sendError(res, 500, 'Something went wrong.', isHead);
    else res.destroy();
  });
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Static site running on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
