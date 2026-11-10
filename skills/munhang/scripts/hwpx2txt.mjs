// HWPX(한글 2014 이후 기본 형식)에서 글을 뽑는다. 프로그램 설치가 필요 없다.
// 쓰기: node tools/hwpx2txt.mjs 시험지.hwpx [출력.txt]
// 구형 HWP는 한글에서 「다른 이름으로 저장 → HWPX 또는 PDF」로 바꾼 뒤 쓴다.
import fs from 'node:fs';
import zlib from 'node:zlib';

const [, , src, out] = process.argv;
if (!src) { console.error('쓰기: node tools/hwpx2txt.mjs 파일.hwpx [출력.txt]'); process.exit(1); }
const buf = fs.readFileSync(src);

// zip 중앙 디렉터리를 읽어 파일 목록을 얻는다
function entries(b) {
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip(HWPX) 파일이 아니다. 구형 HWP라면 한글에서 HWPX나 PDF로 저장해 주세요.');
  const n = b.readUInt16LE(e + 10);
  let p = b.readUInt32LE(e + 16);
  const list = [];
  for (let i = 0; i < n; i++) {
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28), extra = b.readUInt16LE(p + 30), comment = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nameLen);
    list.push({ name, method, size, local });
    p += 46 + nameLen + extra + comment;
  }
  return list;
}
function read(b, ent) {
  const p = ent.local, start = p + 30 + b.readUInt16LE(p + 26) + b.readUInt16LE(p + 28);
  const data = b.subarray(start, start + ent.size);
  return (ent.method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const sections = entries(buf).filter((x) => /^Contents\/section\d+\.xml$/.test(x.name))
  .sort((a, b) => parseInt(a.name.match(/\d+/)) - parseInt(b.name.match(/\d+/)));
const lines = [];
for (const s of sections) {
  const xml = read(buf, s);
  // 문단(<hp:p>)마다 한 줄. 표 안의 문단도 차례대로 나온다.
  for (const m of xml.matchAll(/<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g)) {
    const t = [...m[1].matchAll(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g)]
      .map((x) => unescape(x[1].replace(/<hp:tab[^>]*\/>/g, '\t').replace(/<[^>]+>/g, ''))).join('');
    lines.push(t);
  }
}
const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
if (out) { fs.writeFileSync(out, text); console.log(`저장: ${out} (${text.length}자)`); } else process.stdout.write(text);
