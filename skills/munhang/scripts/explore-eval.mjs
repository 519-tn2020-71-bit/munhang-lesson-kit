// 익스플로라그램(세트의 explore[])의 계산 상자 식(data-let)을 입력값별로 계산해 표로 보인다. 내용 검토용.
// 쓰기: node scripts/explore-eval.mjs <세트.mjs> [장 번호=1] [이름=값,값,... ...]
//   예: node explore-eval.mjs adapter.mjs 1 d=0.1,0.3,0.5,0.9 t=0,1
//   이름=값 목록을 주지 않으면 그 장의 손잡이(input range의 min·value·max, data-set 단추 값)를 모두 조합한다.
//   식 문법은 엔진과 같다: ^ 거듭제곱, pow·exp·sqrt·abs·min·max·round, log(x)=상용로그, ln(x)=자연로그, 삼항 연산자.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [setFile, nArg = '1', ...pairs] = process.argv.slice(2);
if (!setFile) { console.error('쓰기: node explore-eval.mjs <세트.mjs> [장 번호] [이름=값,값 ...]'); process.exit(1); }
const set = (await import(pathToFileURL(path.resolve(setFile)).href)).default;
const ex = (set.explore || [])[+nArg - 1];
if (!ex) { console.error('그 번호의 익스플로라그램이 없다. 개수:', (set.explore || []).length); process.exit(1); }
const html = ex.html;
const letSrc = (html.match(/data-let="([^"]+)"/) || [])[1] || '';
const lets = letSrc.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf('='); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; });

// 손잡이 찾기
const knobs = {};
for (const m of html.matchAll(/<input[^>]*type="range"[^>]*>/g)) {
  const a = (k) => (m[0].match(new RegExp(k + '="([^"]+)"')) || [])[1];
  const name = a('name'); if (!name) continue;
  knobs[name] = [...new Set([+a('min'), +a('value'), +a('max')])];
}
for (const m of html.matchAll(/data-set="(\w+)" data-value="([^"]+)"/g)) (knobs[m[1]] ||= []).push(+m[2]);
for (const p of pairs) { const [k, v] = p.split('='); knobs[k] = v.split(',').map(Number); }

// 엔진 식 → JS
const toJs = (e) => e.replace(/\^/g, '**').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
const F = { pow: Math.pow, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max, round: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, floor: Math.floor, ceil: Math.ceil, log: (x, b) => (b == null ? Math.log10(x) : Math.log(x) / Math.log(b)), ln: Math.log, sin: Math.sin, cos: Math.cos };
const evalAll = (inp) => {
  const env = { ...F, ...inp };
  for (const [k, e] of lets) env[k] = Function(...Object.keys(env), `return (${toJs(e)});`)(...Object.values(env));
  return env;
};
// 결과 문장(data-show)과 출력(data-expr)
const shows = [...html.matchAll(/<p[^>]*data-show="([^"]+)"[^>]*>(.*?)<\/p>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '')]);
const outs = [...new Set([...html.matchAll(/data-expr="([^"]+)"/g)].map((m) => m[1]))];

const names = Object.keys(knobs);
const combos = names.reduce((acc, k) => acc.flatMap((c) => knobs[k].map((v) => ({ ...c, [k]: v }))), [{}]);
console.log(`# ${ex.title}\n계산 식: ${letSrc}\n손잡이: ${names.map((k) => `${k}=${knobs[k].join('/')}`).join('  ')}\n`);
for (const c of combos) {
  let env;
  try { env = evalAll(c); } catch (e) { console.log(JSON.stringify(c), '→ 계산 오류:', e.message); continue; }
  const shown = shows.filter(([cond]) => { try { return Function(...Object.keys(env), `return (${toJs(cond)});`)(...Object.values(env)); } catch { return false; } }).map(([, t]) => t.trim());
  const vals = outs.map((o) => { try { const v = Function(...Object.keys(env), `return (${toJs(o)});`)(...Object.values(env)); return `${o}=${typeof v === 'number' ? +v.toFixed(3) : v}`; } catch { return `${o}=?`; } });
  console.log(`${Object.entries(c).map(([k, v]) => `${k}=${v}`).join(', ')} → ${vals.join(', ')}\n    문장: ${shown.join(' / ') || '(없음)'}`);
}
