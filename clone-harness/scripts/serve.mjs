// 정적 서버 — Playwright(capture)가 붙는다. 빌드 없음, 디렉터리를 그대로 뿌린다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, isMain } from '../lib/paths.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * rootDir 을 뿌리는 정적 서버를 띄운다. port=0 이면 임의 포트.
 * 반환: { server, port, url, close() }
 */
export function startServer(rootDir, port = 0) {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let rel = urlPath === '/' ? '/index.html' : urlPath;
      const filePath = path.join(root, path.normalize(rel));
      // 경로 탈출 방지
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        port: addr.port,
        url,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  const which = process.argv[3] || 'src'; // src | dist | root
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/serve.mjs <run-name> [src|dist|root]');
    process.exit(2);
  }
  const p = runPaths(runName);
  const dir = which === 'dist' ? p.dist : which === 'root' ? p.root : p.src;
  const port = Number(process.argv[4] || process.env.PORT || 4173);
  const { url } = await startServer(dir, port);
  console.log(`정적 서버: ${url}  (root: ${dir})`);
  console.log('Ctrl+C 로 종료');
}
