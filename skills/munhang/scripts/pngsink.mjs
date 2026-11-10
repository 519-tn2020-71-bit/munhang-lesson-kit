// pdfcrop.html이 그린 그림을 받아 PNG로 저장하는 작은 로컬 서버.
// 쓰기: node scripts/pngsink.mjs <저장 폴더> [포트=8790]
//   브라우저에서 pdfcrop.html?...&save=13번_보기그림.png&sink=http://localhost:8790 을 열면 그림이 그 폴더에 저장된다.
//   이 컴퓨터(localhost)에서만 받는다. 파일 이름은 폴더 밖으로 나가지 못하게 이름만 쓴다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '.');
const port = +(process.argv[3] || 8790);
fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const u = new URL(req.url, 'http://x');
  if (req.method !== 'POST' || u.pathname !== '/save') { res.statusCode = 404; res.end(); return; }
  const name = path.basename(u.searchParams.get('name') || 'crop.png').replace(/[^\p{L}\p{N}_.-]/gu, '_');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const b64 = body.replace(/^data:image\/png;base64,/, '');
    const file = path.join(dir, name.endsWith('.png') ? name : name + '.png');
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('저장:', file, Math.round(fs.statSync(file).size / 1024) + 'KB');
    res.end('ok ' + name);
  });
}).listen(port, '127.0.0.1', () => console.log(`그림 받기: http://localhost:${port}/save → ${dir}`));
