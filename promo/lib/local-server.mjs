import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveFilePath(rootDir, requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/landing.html' : url.pathname);
  const filePath = path.resolve(rootDir, `.${pathname}`);
  if (!filePath.startsWith(rootDir)) {
    throw new Error('Refused path outside local server root.');
  }
  return filePath;
}

export async function startLocalServer(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const filePath = resolveFilePath(rootDir, request.url || '/');
      const info = await stat(filePath);
      if (!info.isFile()) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      const file = await readFile(filePath);
      response.setHeader('Content-Type', getContentType(filePath));
      response.statusCode = 200;
      response.end(file);
    } catch (error) {
      response.statusCode = error.code === 'ENOENT' ? 404 : 500;
      response.end(response.statusCode === 404 ? 'Not found' : 'Server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine local server address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}
