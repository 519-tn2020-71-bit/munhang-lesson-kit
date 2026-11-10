// exploragram 수업 HTML을 한 파일로 묶는다(공유판: 실시간 기능 없음).
// 쓰기: node scripts/bundle.mjs 수업.html [--out 결과.html]
//   - munhang.css·js·ppt.css, 교실 도구 kit.css·kit.js(툴바 정리, 떠 있는 타이머, 폰 쓸어넘기기, 화면 점검),
//     exploragram 엔진, 시험지에서 자른 그림까지 모두 파일 안에 넣는다. 폴더 없이 폰·메신저·USB로 보내도 같게 열린다.
//   - 실시간(학생 기기가 교사 화면을 따라오고 답이 모이는 기능)은 빼고 묶는다. 외부 서버에 아무것도 보내지 않는다.
//   - 엔진은 처음 한 번 인터넷(jsDelivr)에서 받아 engine/vendor/에 두고 다시 쓴다. 새 엔진을 쓰려면 vendor 폴더를 지운다.
//   결과: 수업-바로보기.html (--out을 주면 그 이름. 같은 이름을 주면 그 자리에서 한 파일로 바꾼다)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outArg = oi >= 0 ? args[oi + 1] : null;
const src = args.find((a, i) => !a.startsWith('--') && i !== oi + 1);
if (!src) { console.error('쓰기: node scripts/bundle.mjs 수업.html [--out 결과.html]'); process.exit(1); }
const engine = path.join(import.meta.dirname, '..', 'engine');
const read = (f) => fs.readFileSync(path.join(engine, f), 'utf8');
let html = fs.readFileSync(src, 'utf8');
if (/data-inline="exploragram\.js"/.test(html) || /data-inline="kit\.js"/.test(html)) {
  console.error('이미 묶인 파일이다. 묶기 전 원본을 주세요.'); process.exit(1);
}
const styleTag = (name, body) => `<style data-inline="${name}">\n${body.replace(/<\/style/gi, '<\\/style')}\n</style>`;
// defer 순서(munhang.js → exploragram.js)를 지키려고 스크립트는 data: 주소로 넣는다
const scriptTag = (name, body) => `<script defer data-inline="${name}" src="data:text/javascript;charset=utf-8;base64,${Buffer.from(body, 'utf8').toString('base64')}"></script>`;

const RE = {
  mcss: /<link[^>]+href="[^"]*munhang\.css"[^>]*>/,
  mjs: /<script[^>]+src="[^"]*munhang\.js"[^>]*><\/script>/,
  ppt: /<link[^>]+href="[^"]*munhang\/ppt\.css"[^>]*>/,
  kcss: /<link[^>]+href="[^"]*kit\.css"[^>]*>/,
  kjs: /<script[^>]+src="[^"]*kit\.js"[^>]*><\/script>/,
  ecss: /<link[^>]+href="(https:[^"]*exploragram\.css)"[^>]*>/,
  ejs: /<script[^>]+src="(https:[^"]*exploragram\.js)"[^>]*><\/script>/,
};
if (!RE.ecss.test(html) || !RE.ejs.test(html)) { console.error('exploragram.css·js 줄을 찾지 못했다.'); process.exit(1); }

// 실시간 표시는 지운다(혹시 다른 판에서 만든 수업 파일을 묶을 때)
html = html.replace(/(<html\b[^>]*?)\s+data-mh-live(?:="[^"]*")?/i, '$1');
html = html.replace(/(<html\b[^>]*?)\s+data-live="[^"]*"/i, '$1');

if (RE.mcss.test(html)) html = html.replace(RE.mcss, () => styleTag('munhang.css', read('munhang.css')));
if (RE.mjs.test(html)) html = html.replace(RE.mjs, () => scriptTag('munhang.js', read('munhang.js')));
if (RE.ppt.test(html)) html = html.replace(RE.ppt, () => styleTag('ppt.css', read('ppt.css')));
// 교실 도구: 뼈대에 kit.css·kit.js 줄이 있으면 그 자리에, 없으면 엔진 css 뒤·엔진 js 앞에 넣는다
if (RE.kcss.test(html)) html = html.replace(RE.kcss, () => styleTag('kit.css', read('kit.css')));
else html = html.replace(RE.ecss, (m) => m + '\n' + styleTag('kit.css', read('kit.css')));
if (RE.kjs.test(html)) html = html.replace(RE.kjs, () => scriptTag('kit.js', read('kit.js')));
else html = html.replace(RE.ejs, (m) => scriptTag('kit.js', read('kit.js')) + '\n' + m);

// 시험지에서 잘라 온 그림(<img src="그림/…png">)도 파일 안에 넣는다
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
html = html.replace(/(<img\b[^>]*\bsrc=")(?!data:|https?:)([^"]+)"/g, (m, pre, rel) => {
  const file = path.join(path.dirname(path.resolve(src)), decodeURIComponent(rel));
  const ext = (rel.split('.').pop() || '').toLowerCase();
  if (!fs.existsSync(file) || !MIME[ext]) { console.error('그림을 찾지 못했다:', rel); process.exit(1); }
  return `${pre}data:${MIME[ext]};base64,${fs.readFileSync(file).toString('base64')}"`;
});
const left = html.match(/(?:href|src)="munhang\/[^"]+"/g);
if (left) { console.error('묶지 못한 munhang 파일이 남았다:', left.join(', ')); process.exit(1); }

// 엔진을 넣으면서 실시간 수업을 떼어 낸다:
//  ① 엔진 제작자의 실시간 서버 주소·키를 비운다  ② 실시간 모듈을 시작하지 않는다(툴바 단추, ?join= 학생 입장 모두 없음)
//  ③ 설정 창에서 「실시간 수업」 스위치를 뺀다. 넘기기·판서·쓸어넘기기는 엔진의 다른 부분이라 그대로다.
const NO_LIVE = [
  [/const LIVE_CONFIG = \{[^\n]*\};/, 'const LIVE_CONFIG = {};', true],
  [/^(\s*)Live\.init\(\);[^\n]*$/m, '$1/* 실시간 수업 뺌(공유판) */', true],
  [/const LIVE_SUPA_JS = '[^']*';/, "const LIVE_SUPA_JS = '';", false],
  ["['기능 켜고 끄기', ['ink', 'board', 'live', 'liveInk']]", "['기능 켜고 끄기', ['ink', 'board']]", false],
];
const vendor = path.join(engine, 'vendor');
for (const [key, make, name] of [['ecss', styleTag, 'exploragram.css'], ['ejs', scriptTag, 'exploragram.js']]) {
  const m = html.match(RE[key]);
  if (!m) continue;
  const keep = path.join(vendor, name);
  let body;
  if (fs.existsSync(keep)) body = fs.readFileSync(keep, 'utf8');
  else {
    let res;
    try { res = await fetch(m[1]); } catch (e) { res = null; }
    if (!res || !res.ok) { console.error(`엔진을 내려받지 못했다(처음 한 번은 인터넷이 필요하다): ${m[1]}`); process.exit(1); }
    body = await res.text();
    fs.mkdirSync(vendor, { recursive: true });
    fs.writeFileSync(keep, body);
  }
  if (name === 'exploragram.js') {
    for (const [a, b, must] of NO_LIVE) {
      const hit = typeof a === 'string' ? body.includes(a) : a.test(body);
      if (!hit) {
        if (must) { console.error('엔진이 바뀌어 실시간을 떼어 내지 못했다. engine/vendor를 지우고 다시 받거나 하네스를 고쳐야 한다:', String(a)); process.exit(1); }
        continue;
      }
      body = body.replace(a, b);
    }
  }
  html = html.replace(m[0], () => make(name, body));
}
const out = outArg || src.replace(/\.html?$/i, '') + '-바로보기.html';
fs.writeFileSync(out, html);
console.log(`저장: ${out} (${Math.round(html.length / 1024)}KB, 엔진 포함, 실시간 없음)`);
