// 지문 세트 데이터(.mjs) → 문항 수업 HTML 한 파일 (munhang 공유판 · 국어 예시 양식)
// 흐름: 표지 → 독해 포인트 → ① 지문 분석(문단별) → ② 전체 구조 → ③ 어휘·핵심 개념·배경지식 → ④ 만점 구조도 → ⑤ 문제 풀이(고르기·판정·정리)
// 쓰기: node scripts/gen.mjs 세트.mjs [다른 세트 …] [--out 폴더] [--base 주소]
//   --base: 묶지 않고, munhang 파일과 엔진을 인터넷 주소에서 부르는 가벼운 HTML을 만든다(공개 저장소에 올릴 예시용, 열 때 인터넷 필요).
//           예: --base https://cdn.jsdelivr.net/gh/519-tn2020-71-bit/munhang-lesson-kit@main/skills/munhang/engine
//   결과 HTML은 --out 폴더(없으면 세트 파일이 있는 폴더)에 생기고, 그 자리에서 한 파일로 묶인다(엔진 포함, 실시간 없음).
//   시험지에서 자른 그림은 결과 폴더의 그림/ 안에 두고 지문에 <img src="그림/…png" alt="…">로 쓴다.
//   양식: 기본은 노란 테·흰 카드 PPT 양식(engine/ppt.css). 학교·선생님 PPT 양식은 세트의 style로 색·글꼴을 바꾼다.
//
// 표기: [[2:구절]] 범주 형광(1~5) · **구절** 굵게 · [[구절::풀이]] 밑줄 풀이 · {{답}} 빈칸
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
// 한 파일 묶기 스크립트(같은 폴더)
const BUNDLE = path.join(import.meta.dirname, 'bundle.mjs');

const NEG = /(않은|않는|틀린|아닌|어긋나는|거리가 먼|부적절)/;
const NUM = ['①', '②', '③', '④', '⑤'];
const SW = { 1: '회색', 2: '주황', 3: '초록', 4: '파랑', 5: '분홍' };
const NOTE = { role: '→ 역할', core: '@ 핵심', infer: '그래서(추론)' };
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\[\[g~\w+:.+?\]\]/g, '').replace(/\[\[(?:[1-5]:)?(.+?)(?:::.+?)?\]\]/g, '$1').replace(/\*\*|\{\{|\}\}/g, '');
const mark = (s) => String(s)
  .replace(/\[\[g~(\w+):(.+?)\]\]/g, '<span class="mh-gloss $1 step">$2</span>')
  .replace(/\[\[([1-5]):(.+?)\]\]/g, '<span class="mh-h$1">$2</span>')
  .replace(/\[\[(.+?)::(.+?)\]\]/g, '<span class="mh-ul">$1</span><span class="mh-gloss step">$2</span>')
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\{\{(.+?)\}\}/g, '<span class="blank">$1</span>');
const stemHtml = (q) => q.stem.replace(/(않은|않는|틀린) 것은/, '<u>$1</u> 것은') + (q.pts3 ? ' [3점]' : '');
const firstSentence = (s) => (plain(s).match(/^.*?[.?!](?=\s|$)/) || [plain(s)])[0];
const shortTab = (p) => {
  const m = p.match(/^보기\d*([abc])?$/);
  if (m) return '보기' + (m[1] ? '①②③'['abc'.indexOf(m[1])] : '');
  return p.replace(/([abc])$/, (x) => '①②③'['abc'.indexOf(x)]);
};
// 높이 어림(px): 읽기 글 26px·줄 45px·한 줄 40자, 설명 상자 22px·줄 33px·한 줄 46자
const hText = (s) => Math.ceil(plain(s).length / 40) * 45 + 10;
const hNote = (s) => Math.ceil(plain(s).length / 44) * 33 + 22;
const BUDGET = 520;

// ---------- 활동지·교과서 그대로(디지털 교과서) ----------
// set.sheet = [{ title: '장 제목', sec: '목차 묶음(선택)', blocks: [ … ] }, …]  장 하나 = 화면 한 장
//   ['text', '본문·활동지 글 그대로. {{답}}은 누르면 열리는 빈칸, [[2:구절]] 형광, **굵게**, [[g~core:주석]] →로 여는 파란 주석. 빈 줄은 문단 나눔']
//     글은 고치지 않되, 읽기 자료에는 범주 형광(뜻은 set.legend)과 파란 주석을 얹는다. 형광 없는 긴 글은 경고한다
//   ['q', '물음 그대로', '예시 답(선택, →로 연다)', { write: true }]   write면 학생이 적는 칸을 둔다(보내기 없음, 실시간 뺌)
//   ['quiz', '물음', ['선지1', '선지2', …], 정답 번호, ['선지별 까닭', …](선택)]
//   ['table', [['머리', '머리'], ['칸 {{답}}', '칸'], …]]   첫 줄이 머리
//   ['box', '상자 제목', '자료 글']   (학습 목표, 보기, 참고 자료)
//   ['img', '그림/파일.png', '그림 설명(alt)']
const SHEET_CSS = `.mh-sheet { border: 2px solid var(--ppt-line, #BDBDBD); border-radius: 12px; padding: 14px 26px; background: #FFFFFF; font-size: 26px; line-height: 1.7; margin: 0 0 14px; }
.mh-sheet p { margin: 0 0 6px; }
.mh-q { margin: 0 0 14px; font-size: 26px; line-height: 1.6; }
.mh-qt { font-size: 26px; font-weight: 700; margin: 0 0 6px; }
.mh-write { display: block; width: 100%; box-sizing: border-box; min-height: 84px; padding: 8px 14px; border: 2px solid var(--ppt-line, #BDBDBD); border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 24px; line-height: 1.5; resize: vertical; }
.mh-write:focus { outline: none; border-color: var(--ppt-blue, #2B59C3); }
.mh-sheet .mh-gloss { margin: 0 0 6px 30px; }
.mh-sheet-legend { margin: -4px 0 8px; font-size: 20px; }
.mh-ans { color: var(--ppt-blue, #2B59C3); font-size: 24px; margin: 6px 0 0; padding-left: 14px; border-left: 4px solid var(--ppt-blue, #2B59C3); }
.mh-box { border: 2px dashed var(--ppt-line, #BDBDBD); border-radius: 10px; padding: 10px 20px; font-size: 24px; line-height: 1.6; margin: 0 0 14px; }
.mh-box .k { display: block; font-weight: 800; color: var(--ppt-blue, #2B59C3); margin-bottom: 2px; }
section.slide table.compare.mh-sheet-t { font-size: 23px; margin: 0 0 14px; }
`;
function sheetSlides(set, slide) {
  set.sheet.forEach((pg, pi) => {
    let h = 0, hl = false;
    const html = pg.blocks.map((b, bi) => {
      const [kind, a, c, d, e] = b;
      if (kind === 'text') {
        h += Math.ceil(plain(a).length / 40) * 44 + 40 + (String(a).match(/\[\[g~/g) || []).length * 36;
        if (plain(a).length > 120 && !/\[\[[1-5]:/.test(a)) console.warn(`활동지 ${pi + 1}장「${plain(pg.title)}」: 긴 글에 형광이 없다. 핵심 문장·근거에 [[2:…]]~[[5:…]]를 칠한다`);
        if (/\[\[[1-5]:/.test(a)) hl = true;
        return `  <div class="mh-sheet">${String(a).split(/\n\n+/).map((t) => `<p>${mark(t).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
      }
      if (kind === 'q') {
        h += Math.ceil(plain(a).length / 42) * 42 + (d && d.write ? 110 : 0) + (c ? Math.ceil(plain(c).length / 48) * 38 + 10 : 0) + 14;
        return `  <div class="mh-q"><p class="mh-qt">${mark(a)}</p>${d && d.write ? `<textarea class="mh-write" placeholder="여기에 적어요" aria-label="${attr(plain(a))}"></textarea>` : ''}${c ? `<p class="mh-ans step"><b>예시 답</b> ${mark(c)}</p>` : ''}</div>`;
      }
      if (kind === 'quiz') {
        h += 60 + c.length * 70;
        return `  <p class="mh-qt">${mark(a)}</p>\n  <div class="quiz" data-q="s${pi + 1}-${bi + 1}">\n` +
          c.map((o, i) => `    <button class="opt"${i + 1 === d ? ' data-ok' : ''}${e && e[i] ? ` data-why="${attr(e[i])}"` : ''}>${o}</button>`).join('\n') + '\n  </div>';
      }
      if (kind === 'table') {
        h += a.length * 48 + 20;
        const [head, ...rows] = a;
        return `  <table class="compare mh-sheet-t"><thead><tr>${head.map((x) => `<th>${mark(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${mark(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      }
      if (kind === 'box') { h += Math.ceil(plain(c).length / 46) * 38 + 50; return `  <div class="mh-box"><span class="k">${a}</span>${mark(c)}</div>`; }
      if (kind === 'img') { h += 340; return `  <figure class="fig"><img src="${attr(a)}" alt="${attr(c || '')}" style="max-height:320px;width:auto;max-width:100%"></figure>`; }
      console.warn('알 수 없는 블록:', kind);
      return '';
    }).join('\n');
    const legend = hl && set.legend ? `\n  <div class="mh-legend mh-sheet-legend"><span class="k">표시</span>${Object.entries(set.legend).map(([k, v]) => `<span><span class="mh-h${k}">${SW[k]}</span> ${v}</span>`).join('')}</div>` : '';
    if (legend) h += 40;
    if (h > 520) console.warn(`활동지 ${pi + 1}장「${plain(pg.title)}」이 넘칠 수 있다(어림 ${h}px). 블록을 두 장으로 나눈다`);
    slide(`sheet-${pi + 1}`, pg.sec || set.sheetSec || '활동', plain(pg.title), `  <h2>${pg.title}</h2>${legend}\n${html}`);
  });
}

function build(set, OUT) {
  const BASE = baseUrl || 'munhang';
  set.paras = set.paras || [];
  set.qs = set.qs || [];
  const body = set.paras.filter((p) => !p.bogi);
  const bogiOf = (n) => set.paras.filter((p) => p.bogi === n);
  const S = [];
  const slide = (id, sec, title, inner) => S.push(`<section class="slide" id="${id}" data-sec="${sec}" data-title="${attr(title)}">\n${inner}\n</section>`);

  // 설명(notes)을 주석 줄로: at 구절(문장 끝)이 있는 그 문장 바로 아래 한 줄, at이 없으면 조각 끝 줄
  //   → 역할·연결(role) / @ 핵심·추론(core, infer)
  // addNotes: 형광 문장에 빠진 주석을 AI가 더한 것(주석 자료와 구별해 둔다). 문단별로 notes 뒤에 붙인다
  Object.entries(set.addNotes || {}).forEach(([pid, ns]) => { const p = set.paras.find((x) => x.p === pid); if (!p) console.warn("addNotes 문단 없음:", pid); else p.notes = [...(p.notes || []), ...ns]; });
  set.paras.forEach((p) => {
    p.gl = []; p.sums = [];
    (p.notes || []).forEach(([k, t, sub, at0], ni) => {
      const at = at0 || (p.at && p.at[ni]);
      // 지문 주석에는 문항 번호(정답·선지 꼬리표)를 넣지 않는다: 문제 풀이 장에서 다룬다
      const t2 = t.replace(/\s*\(\d+번[^)]*\)/g, '').replace(/(^|[.!?]\s+)[^.!?]*\d+번[^.!?]*[.!?]/g, '$1').trim();
      if (!t2) return;
      const txt = (sub && !t2.startsWith(sub) ? sub + ': ' : '') + t2;
      const i = at ? p.text.indexOf(at) : -1;
      if (at && i < 0) console.warn('주석 위치를 못 찾음:', p.p, at);
      let pos = i < 0 ? p.text.length : i + at.length;
      const open = p.text.lastIndexOf('[[', pos - 1), close = p.text.lastIndexOf(']]', pos - 1);
      if (open > close) pos = p.text.indexOf(']]', pos) + 2;   // 형광 안이면 형광이 끝난 뒤에 단다
      // 주석은 문장이 끝난 뒤(마침표 다음)에 단다: 문장 중간을 끊지 않는다
      if (!/[.?!][\]\*<\/u>]*$/.test(p.text.slice(0, pos))) {
        const m = /[.?!](?=(?:\]\]|\*\*|<\/u>)*(?:\s|$|\[\[g~))/g;
        m.lastIndex = pos;
        const hit = m.exec(p.text);
        pos = hit ? hit.index + 1 : p.text.length;
        while (/^(\]\]|\*\*|<\/u>)/.test(p.text.slice(pos))) pos += p.text.slice(pos).match(/^(\]\]|\*\*|<\/u>)/)[0].length;
      }
      while (p.text.startsWith('[[g~', pos)) pos = p.text.indexOf(']]', pos) + 2;   // 같은 자리 주석은 차례대로
      // 밑줄(<u>) 범위 안이면 주석 앞에서 밑줄을 닫고 뒤에서 다시 연다: 주석 줄에 밑줄이 번지지 않게
      const head = p.text.slice(0, pos);
      const inU = (head.match(/<u>/g) || []).length > (head.match(/<\/u>/g) || []).length;
      const g = `[[g~${k}:${txt}]]`;
      p.text = head + (inU ? `</u>${g}<u>` : g) + p.text.slice(pos);
      p.gl.push(plain(txt).length);
    });
  });
  const para = (p) => {
    const tag = p.bogi ? 'div' : 'p';
    const sums = (p.sums || []).map((t) => `<span class="mh-sum step">${mark(t)}</span>`).join('');
    const cls = p.bogi ? 'mh-bogi' : p.poem ? 'mh-poem' : '';
    const inner = p.bogi ? `<p${p.poem ? ' class="mh-poem"' : ''}>${mark(p.text)}</p>` : mark(p.text);
    return `  <${tag} data-para="${p.p}" data-tab="${attr(p.tab || shortTab(p.p))}"${p.label ? ` data-label="${attr(p.label)}"` : ''}${cls ? ` class="${cls}"` : ''}>${inner}${sums}</${tag}>`;
  };

  // 독해 포인트
  if (set.lead) {
    const legend = set.legend ? `\n  <div class="mh-legend"><span class="k">표시</span>${Object.entries(set.legend).map(([k, v]) => `<span><span class="mh-h${k}">${SW[k]}</span> ${v}</span>`).join('')}<span><span class="mh-gloss core">파란 글</span> 주석(→로 연다)</span></div>` : '';
    slide('lead', '0. 독해 포인트', '독해 포인트', `  <h2>이 글은 무엇을 말할까?</h2>\n  <div class="mh-lead" data-ai="독해 포인트"><span class="k">독해 포인트</span>${set.lead}</div>\n  <p class="mh-theme step">주제 &nbsp;${set.theme}</p>${legend}`);
  }

  // 활동지·교과서 그대로(디지털 교과서): set.sheet의 장을 그대로 싣는다. {{답}} 빈칸은 누르면 열린다
  if (set.sheet) sheetSlides(set, slide);

  // ① 지문 분석: 문단(head가 있는 조각부터)별로, 높이를 어림해 장을 나눈다
  const blocks = [];
  for (const p of body) {
    if (p.head || !blocks.length) blocks.push({ head: p.head || set.readH || '지문 읽기', items: [] });
    blocks[blocks.length - 1].items.push(p);
  }
  let si = 0;
  blocks.forEach((b) => {
    let cur = [], h = 0, part = 0;
    const flush = () => {
      if (!cur.length) return;
      si++;
      const inner = `  <div class="mh-read" data-src="src" data-paras="${cur.map((p) => p.p).join(',')}" data-title="off"></div>`;
      slide(`read-${si}`, '① 지문 분석', b.head.replace(/<[^>]+>/g, '') + (part ? ' (이어서)' : ''), `  <h2>${b.head}${part ? ' <small>(이어서)</small>' : ''}</h2>\n${inner}`);
      cur = []; h = 0; part++;
    };
    b.items.forEach((p) => {
      // 높이 어림(PPT 양식): 지문 30px 한 줄 46자·51px, 주석 24px 한 줄 56자·35px
      // 시(p.poem)는 줄바꿈(\n)마다 한 줄로 센다
      const ph = (p.poem ? plain(p.text).split('\n').reduce((t, l) => t + Math.max(1, Math.ceil(l.length / 46)) * 49, 0) : Math.ceil(plain(p.text).length / 46) * 51) + 10 + p.gl.reduce((a, n) => a + Math.ceil(n / 56) * 35 + 14, 0) + 12
        + (/<img/.test(p.text) ? 340 : 0) + (p.text.match(/<br>/g) || []).length * 30;   // 그림은 한 장 높이에 가깝게, 줄바꿈은 한 줄씩 더 센다
      if (cur.length && h + ph > BUDGET) flush();
      cur.push(p); h += ph;
    });
    flush();
  });

  // ② 전체 구조
  if (set.flow) {
    slide('flow', '② 전체 구조', '전체 구조 한눈에', `  <h2>${set.flowH || '전체 구조 한눈에'}</h2>\n  <div class="mh-rows" data-ai="전체 구조">\n` +
      set.flow.map(([tag, item, desc]) => `    <div class="mh-row step"><span class="tag">${tag}</span><span class="item">${item}</span><span>${mark(desc || '')}</span></div>`).join('\n') +
      `\n  </div>${set.flowTheme ? `\n  <p class="mh-theme step">전체 주제 &nbsp;${set.flowTheme}</p>` : ''}`);
  }

  // ③ 어휘 · 핵심 개념 · 배경지식
  // 어휘가 적고 개념이 짧으면 한 장에 함께 둔다(아래가 비지 않게)
  const cs = set.concepts || [];
  const clen = cs.reduce((a, c) => a + plain(c[1]).length, 0);
  const vocab = set.vocab || [];
  const vlen = vocab.reduce((a, [w, m]) => a + plain(w + m).length, 0);
  const vcard = (c) => `  <div class="mh-concept" data-ai="${c[2] || '핵심 개념'}"><span class="mh-w">${c[2] || '핵심 개념'} — ${c[0]}</span>${mark(c[1])}</div>`;
  const together = vocab.length && vocab.length <= 4 && cs.length && cs.length <= 2 && vlen + clen <= 300;
  if (together) {
    slide('vocab-1', '③ 어휘·개념', '어휘 · 핵심 개념', `  <h2>어휘 · 핵심 개념</h2>\n  <ul class="mh-vocab" data-ai="어휘 뜻풀이">\n` +
      vocab.map(([w, m]) => `    <li><span class="mh-w">${w}</span>${m}</li>`).join('\n') + `\n  </ul>\n` + cs.map(vcard).join('\n'));
  } else if (vocab.length) {
    for (let i = 0; i < vocab.length; i += 7) {
      slide(`vocab-${i / 7 + 1}`, '③ 어휘·개념', '어휘', `  <h2>어휘 — 이것만은 꼭 익히자</h2>\n  <ul class="mh-vocab" data-ai="어휘 뜻풀이">\n` +
        vocab.slice(i, i + 7).map(([w, m]) => `    <li><span class="mh-w">${w}</span>${m}</li>`).join('\n') + `\n  </ul>`);
    }
  }
  // 핵심 개념·배경지식: 짧으면 한 장에 둘
  if (together) { /* 위에서 어휘와 함께 실었다 */ } else if (cs.length === 2 && clen <= 420) {
    slide('concept-1', '③ 어휘·개념', '핵심 개념 · 배경지식', `  <h2>핵심 개념 · 배경지식</h2>\n` + cs.map((c) => `  <div class="mh-concept" data-ai="${c[2] || '핵심 개념'}"><span class="mh-w">${c[2] || '핵심 개념'} — ${c[0]}</span>${mark(c[1])}</div>`).join('\n'));
  } else cs.forEach((c, i) => {
    slide(`concept-${i + 1}`, '③ 어휘·개념', c[0], `  <h2>${c[2] || '핵심 개념'} — ${c[0]}</h2>\n  <div class="mh-concept" data-ai="${c[2] || '핵심 개념'}">${mark(c[1])}</div>`);
  });

  // ④ 만점 구조도
  (set.struct || []).forEach((st, i) => {
    let html = '', rows = [];
    const flushT = () => { if (rows.length) html += `  <table class="compare mh-struct"><tbody>\n${rows.join('\n')}\n  </tbody></table>\n`; rows = []; };
    st.rows.forEach((r) => {
      if (typeof r === 'string') { flushT(); html += `  <p class="mh-arrow">${r}</p>\n`; }
      else rows.push(`    <tr><th>${mark(r[0])}</th><td>${mark(r[1])}</td></tr>`);
    });
    flushT();
    slide(`struct-${i + 1}`, '④ 만점 구조도', st.title, `  <h2>만점 구조도 · ${st.title}</h2>\n<div data-ai="만점 구조도">\n${html}</div>`);
  });

  // ④-2 익스플로라그램: 값을 바꿔 보며 원리를 확인하는 장(과학·경제처럼 값이 바뀌는 지문, 선생님이 고른 세트만)
  (set.explore || []).forEach((x, i) => slide(`explore-${i + 1}`, '④ 익스플로라그램', x.title, x.html));

  // ⑤ 문제 풀이
  const qStart = S.length;
  // 세트 권장 풀이 시간: 문항당 독서 100초, 문학 90초(30초 단위 올림). set.timer(초)로 바꾼다. 떠 있는 타이머(툴바 「타이머」)의 처음 시간이 된다
  const timerSec = set.timer || (!set.qs.length ? 300 : 0) || Math.ceil((set.qs.length * (/문학/.test(set.kind || '') ? 90 : 100)) / 30) * 30;
  set.qs.forEach((q) => {
    const sec = `⑤ ${q.n}번`;
    const neg = NEG.test(q.stem);
    const bogi = bogiOf(q.n);
    const bogiLen = bogi.reduce((a, p) => a + plain(p.text).length, 0);
    const long = q.tight || q.choices.reduce((a, c) => a + plain(c[0]).length, 0) / q.choices.length > 38;
    const pair = bogi.length && bogiLen <= 280 && !long;   // 선지가 길면 <보기>는 따로 한 장
    if (bogi.length && !pair) bogi.forEach((p, i) => slide(`q${q.n}-bogi${i + 1}`, sec, `${q.n}번 보기${bogi.length > 1 ? ' ' + (i + 1) : ''}`,
      `  <h2>${q.n}. ${stemHtml(q)}</h2>\n  <div class="mh-read" data-src="src" data-paras="${p.p}" data-title="off"></div>`));
    const opts = q.choices.map(([t, , why], i) => {
      const ok = i + 1 === q.answer;
      const w = firstSentence(why);
      return `    <button class="opt"${ok ? ' data-ok' : ''} data-why="${attr(ok && !/^맞다/.test(w) ? '맞다. ' + w : w)}">${t}</button>`;
    }).join('\n');
    const quiz = `<div${long ? ' class="mh-tight"' : ''}><div class="quiz" data-q="${q.n}"${set.madeQs ? ' data-ai="자료로 만든 문항"' : ''}>\n${opts}\n  </div></div>`;
    if (!q.noPoll) slide(`q${q.n}-poll`, sec, `${q.n}번 고르기`, `  <h2${long ? ' class="mh-h2s"' : ''}>${q.n}. ${stemHtml(q)}</h2>\n  ` +
      (pair ? `<div class="mh-pair">\n  <div class="mh-read" data-src="src" data-paras="${bogi.map((p) => p.p).join(',')}" data-title="off"></div>\n  ${quiz}\n  </div>` : quiz));
    // 판정 장 탭: 근거가 있는 조각만(지문 순서대로) + <보기>
    const used = new Set(q.choices.flatMap(([, ev]) => ev.split(';').map((x) => x.split('|')[0].trim())));
    const paras = q.paras || [...body.filter((p) => used.has(p.p)), ...bogi].map((p) => p.p).join(',');
    const chs = q.choices.map(([t, ev, why], i) => {
      const ox = (i + 1 === q.answer) !== neg ? 'o' : 'x';
      const w = why + (i + 1 === q.answer ? ' 그래서 정답이다.' : '');
      return `        <div class="mh-ch" data-only="${i + 1}" data-ox="${ox}" data-ev="${attr(ev)}">\n          <p class="mh-ct">${NUM[i]} ${t}</p>\n          <p class="mh-why">${w}</p></div>`;
    }).join('\n');
    const jlong = q.choices.reduce((a, c) => a + plain(c[0]).length + plain(c[2]).length, 0) / q.choices.length > 130;
    slide(`q${q.n}-judge`, sec, `${q.n}번 선지 판정`,
      `  <h2${jlong ? ' class="mh-h2s"' : ''}>${q.n}. ${stemHtml(q)}</h2>\n  <div class="mh-judge${jlong ? ' mh-tight' : ''}" data-src="src" data-q="${q.n}" data-answer="${q.answer}" data-paras="${paras}">\n    <div class="mh-view"></div>\n    <div class="mh-side">\n      <div class="reveal" data-stops="시작|①|②|③|④|⑤">\n        <p data-only="0" style="font-size:24px">${q.type ? `<b>${q.type}</b><br>` : ''}${q.hint || '→를 누르면 선지가 하나씩 나온다. ○, ✕를 먼저 고른 뒤 「판정과 근거」를 누르자.'}</p>\n${chs}\n      </div>\n    </div>\n  </div>`);
    // 문항 정리(PPT 양식): 선지마다 아래 줄 ➜ 근거 → 적절/부적절, 정답 표시
    const keyLong = q.choices.reduce((a, c) => a + plain(c[0]).length + Math.min(plain(firstSentence(c[2])).length, 60), 0) > 420;
    const keyItems = q.choices.map(([t, , why, short], i) => {
      const ox = (i + 1 === q.answer) !== neg ? 'o' : 'x';
      const r = (short || firstSentence(why).replace(/[.]$/, '')) + ` → ${ox === 'o' ? '적절' : '부적절'}`;
      // 높이 어림: 선지 21~23px 한 줄 48자·32px, 근거 20~21px 한 줄 50자·30px
      const h = Math.ceil((plain(t).length + 4) / 54) * 32 + Math.ceil(plain(r).length / 58) * 30 + 12;
      return { h, html: `    <li${i + 1 === q.answer ? ' class="ok"' : ''}><span class="t">${NUM[i]} ${t}</span><span class="r step">${r}</span></li>` };
    });
    const total = keyItems.reduce((a, x) => a + x.h, 0);
    // 조금 넘치면 나누지 않고 촘촘하게(나누면 두 장 다 아래가 빈다), 많이 넘칠 때만 두 장
    const tight = total > 500 && total <= 640;
    const parts = total > 640 ? [keyItems.slice(0, 3), keyItems.slice(3)] : [keyItems];
    parts.forEach((part, pi) => slide(`q${q.n}-key${pi ? '-2' : ''}`, sec, `${q.n}번 정리${parts.length > 1 ? ` (${pi + 1}/2)` : ''}`,
      `  <h2${keyLong ? ' class="mh-h2s"' : ''}>${q.n}. ${stemHtml(q)}</h2>\n  <ul class="mh-key${keyLong || tight ? ' small' : ''}${tight ? ' tight' : ''}" data-ai="선지별 근거 요약">\n${part.map((x) => x.html).join('\n')}\n  </ul>`));
  });

  // 양식: 학교·선생님 PPT 양식은 set.style로 바꾼다. 비우면 기본(노란 테·흰 카드·파란 주석)
  //   style: { bg: '바깥 테 색', ink: '글자 색', note: '주석·강조 색', line: '지문 상자 테두리', title: '제목 상자 테두리', font: '글꼴 이름' }
  const T = set.style || {};
  const themeCss = [
    T.bg && `--ppt-yellow: ${T.bg};`, T.ink && `--ppt-ink: ${T.ink};`, T.note && `--ppt-blue: ${T.note};`, T.line && `--ppt-line: ${T.line};`,
  ].filter(Boolean).join(' ');
  const themeRules = (themeCss ? `body[data-theme="ppt"] { ${themeCss} }
` : '')
    + (T.title ? `body[data-theme="ppt"] section.slide > h2 { border-color: ${T.title} !important; box-shadow: none; }
` : '')
    + (T.font ? `body[data-theme="ppt"] section.slide { font-family: ${JSON.stringify(T.font)}, var(--ch-font, sans-serif); }
` : '');
  const subject = set.subject || '국어';
  const exam = set.exam || '';

  // 세트 하나 = HTML 한 파일. 장이 많아도 나누지 않는다(목차로 옮겨 다닌다)
  const html = `<!doctype html>
<html lang="ko" data-deck="${set.deck}" data-mh-timer="${timerSec}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${exam ? exam + ' ' : ''}${set.range}${/\d$/.test(set.range) ? "번" : ""} · ${plain(String(set.topic).replace(/<br\s*\/?>/g, ' '))}</title>
<link rel="stylesheet" href="${BASE}/munhang.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2.8.1/engine/exploragram.css">
<link rel="stylesheet" href="${BASE}/kit.css">
<link rel="stylesheet" href="${BASE}/ppt.css">
<script defer src="${BASE}/munhang.js"></script>
<script defer src="${BASE}/kit.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2.8.1/engine/exploragram.js"></script>
<style>
section.slide > h2 small { font-size: 24px; color: #6B6B6B; }
b.mh-boxw { border: 2px solid #333; padding: 0 4px; font-weight: 700; }
.mh-read img, .mh-view img { max-height: 320px; width: auto; max-width: 100%; margin: 0 auto; }
${set.sheet ? SHEET_CSS : ''}
${themeRules}${set.css || ''}
</style>
</head>
<body data-theme="ppt">

${set.paras.length ? `<template class="mh-src" id="src" data-title="${attr(set.title || '')}" data-ai="형광 범주">\n${set.paras.map(para).join('\n')}\n</template>` : ''}

<section class="slide cover" id="cover" data-title="표지">
  <div class="band"><p class="kicker">${[exam, subject, set.kind || '독서'].filter(Boolean).join(' · ')}</p></div>
  <h1>${set.topic}<br>${set.range}${/\d$/.test(set.range) ? "번" : ""}</h1>
</section>

${S.join('\n\n')}

</body>
</html>
`;
  const file = path.join(OUT, set.file);
  fs.writeFileSync(file, html);
  // 한 파일로 묶는다: munhang·kit·ppt.css와 엔진, 그림까지 파일 안에 넣는다(실시간 없음)
  if (!baseUrl) execFileSync(process.execPath, [BUNDLE, file, '--out', file], { stdio: 'inherit' });
  else if (/<img[^>]*src="(?!data:|https?:)/.test(html)) console.warn('그림이 있는 세트다. --base로 만든 파일은 그림/ 폴더를 옆에 함께 두어야 보인다.');
  console.log(set.file, S.length + 1 + '장');
}

const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const bi = argv.indexOf('--base');
const baseUrl = bi >= 0 ? argv[bi + 1].replace(/\/+$/, '') : '';
const outDir = oi >= 0 ? path.resolve(argv[oi + 1]) : null;
const files = argv.filter((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1) && (bi < 0 || i !== bi + 1));
if (!files.length) { console.error('쓰기: node scripts/gen.mjs 세트.mjs [다른 세트 …] [--out 폴더] [--base 주소]'); process.exit(1); }
for (const f of files) {
  const set = (await import(pathToFileURL(path.resolve(f)).href + '?t=' + Date.now())).default;
  const out = outDir || path.dirname(path.resolve(f));
  fs.mkdirSync(out, { recursive: true });
  build(set, out);
}
