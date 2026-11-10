// 미리보기용 정적 서버: node tools/serve.mjs [폴더] [포트]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..')), port = +(process.argv[3] || 8782);
const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': type[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
}).listen(port, () => console.log(`http://localhost:${port}/`));
