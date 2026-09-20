// 生产产物冒烟用的最小静态服务器：按 deploy/nginx/spa.conf 的方式托管 apps/admin/dist，
// 同时把 /api 反代到本地 API，并带上与生产一致的 CSP / 安全响应头。
// 目的不是替代 nginx，而是让「构建产物 + SPA 回退 + 跨端口 API + CSP」这条链路可被自动化验证。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'apps', 'admin', 'dist');
const port = Number(process.env.ADMIN_DIST_PORT ?? 5188);
const apiTarget = process.env.ADMIN_DIST_API_TARGET ?? 'http://127.0.0.1:3001';
const apiUrl = new URL(apiTarget);

// 与 deploy/nginx/spa.conf 保持一致（connect-src 只放行同源与真实 API 域名）。
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://webapi.xmlga.top",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function applySecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', CSP);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
}

function proxyToApi(request, response) {
  const upstream = http.request(
    {
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `${apiUrl.hostname}:${apiUrl.port}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', (error) => {
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ code: 1099, message: `api proxy failed: ${error.message}`, data: null }));
  });

  request.pipe(upstream);
}

const server = http.createServer((request, response) => {
  const requestUrl = request.url ?? '/';

  if (requestUrl.startsWith('/api/')) {
    proxyToApi(request, response);
    return;
  }

  const pathname = decodeURIComponent(requestUrl.split('?')[0]);
  const candidate = path.join(distDir, pathname);
  const isFile = candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile();

  // SPA 回退：静态资源缺失返回 404，其余路径交给 index.html（等价于 nginx 的 try_files）。
  const target = isFile ? candidate : path.join(distDir, 'index.html');
  if (!isFile && path.extname(pathname)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }

  applySecurityHeaders(response);
  response.writeHead(200, { 'content-type': MIME_TYPES[path.extname(target)] ?? 'application/octet-stream' });
  fs.createReadStream(target).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[admin-dist] serving ${distDir} on http://127.0.0.1:${port} (api → ${apiTarget})`);
});
