/*! munhang.js — exploragram 위에 얹는 문항 수업 부품
 * 지문(template.mh-src) · 읽기(.mh-read) · 선지 판정(.mh-judge) · 문항 점검
 * exploragram.js보다 먼저 불러야 한다(<script defer>를 엔진 줄 위에 둔다).
 * 그래야 지문을 장에 복사한 뒤 엔진이 .step을 센다.
 */
(() => {
  'use strict';
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const issues = [];
  const slides = () => $$('section.slide');
  const slideNo = (el) => slides().indexOf(el.closest('section.slide')) + 1;
  const report = (el, code, msg) => issues.push({ slide: el ? slideNo(el) : 0, code, msg });

  // ---------- 지문 ----------
  const srcs = {};
  $$('template.mh-src').forEach((t) => { srcs[t.id] = t; });
  const parasOf = (id) => (srcs[id] ? [...srcs[id].content.children].filter((e) => e.matches('[data-para]')) : []);
  const labelOf = (p) => p.dataset.label || (/^\d+$/.test(p.dataset.para) ? p.dataset.para + '문단' : p.dataset.para);
  const pick = (id, spec) => {
    const all = parasOf(id);
    if (!spec) return all;
    const want = new Set();
    spec.split(',').map((x) => x.trim()).forEach((x) => {
      const m = x.match(/^(\d+)-(\d+)$/);
      if (m) for (let i = +m[1]; i <= +m[2]; i++) want.add(String(i));
      else want.add(x);
    });
    return all.filter((p) => want.has(p.dataset.para));
  };
  const titleEl = (id) => {
    const t = srcs[id] && srcs[id].dataset.title;
    if (!t) return null;
    const p = document.createElement('p');
    p.className = 'mh-title';
    p.textContent = t;
    return p;
  };

  // 글자 사이 공백을 하나로 보고 구절을 찾는다. 찾으면 [글자노드, 위치] 목록을 돌려준다.
  function textMap(root) {
    const map = [];
    let s = '';
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      for (let i = 0; i < n.data.length; i++) {
        if (/[​-‍⁠﻿]/.test(n.data[i])) continue;   // 엔진이 끼운 보이지 않는 글자(단어 잇기 등)는 건너뛴다
        const c = /\s/.test(n.data[i]) ? ' ' : n.data[i];
        if (c === ' ' && (s === '' || s.endsWith(' '))) continue;
        s += c;
        map.push([n, i]);
      }
    }
    return { s, map };
  }
  function locate(root, phrase) {
    const want = norm(phrase);
    if (!root || !want) return null;
    const { s, map } = textMap(root);
    const at = s.indexOf(want);
    return at < 0 ? null : map.slice(at, at + want.length);
  }
  function highlight(root, phrase) {
    const hit = locate(root, phrase);
    if (!hit) return null;
    const segs = new Map();
    hit.forEach(([n, i]) => {
      const g = segs.get(n) || [i, i];
      g[0] = Math.min(g[0], i); g[1] = Math.max(g[1], i);
      segs.set(n, g);
    });
    let first = null;
    for (const [n, [a, b]] of segs) {
      const r = document.createRange();
      r.setStart(n, a); r.setEnd(n, b + 1);
      const m = document.createElement('mark');
      m.className = 'mh-hl';
      r.surroundContents(m);
      first = first || m;
    }
    return first;
  }
  function clearMarks(root) {
    $$('mark.mh-hl', root).forEach((m) => {
      const p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    });
  }
  // 읽기용 주석(밑줄 풀이, 문단 요약, 꼬리표)을 뺀 원문 사본
  const ANNOT = '.mh-note, .mh-gloss, .mh-sum';
  const bare = (p) => {
    const c = p.cloneNode(true);
    $$(ANNOT, c).forEach((n) => n.remove());
    $$('.mh-ul', c).forEach((n) => n.classList.remove('mh-ul'));
    $$('.mh-h1, .mh-h2, .mh-h3, .mh-h4, .mh-h5', c).forEach((n) => n.removeAttribute('class'));   // 범주 형광은 판정 장에서 뺀다
    $$('.step', c).forEach((n) => n.classList.remove('step'));
    return c;
  };
  // "2|구절; 보기|구절" → [{para, phrase}]
  const evs = (spec) => String(spec || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const k = x.indexOf('|');
    return k < 0 ? { para: x, phrase: '' } : { para: x.slice(0, k).trim(), phrase: x.slice(k + 1).trim() };
  });

  // ---------- 읽기 장 ----------
  $$('.mh-read').forEach((box) => {
    const id = box.dataset.src;
    if (!srcs[id]) { report(box, 'mh-src', `지문 template#${id}가 없다`); return; }
    const t = titleEl(id);
    if (t && box.dataset.title !== 'off') box.appendChild(t);
    const got = pick(id, box.dataset.paras);
    if (!got.length) report(box, 'mh-paras', `지문 ${id}에 data-paras="${box.dataset.paras}"에 맞는 문단이 없다`);
    got.forEach((p) => box.appendChild(p.cloneNode(true)));
    if (box.hasAttribute('data-qref')) qrefs(box);
  });

  // 문항 근거 꼬리표: 선지의 data-ev 구절 끝에 "6-①"을 붙인다
  function qrefs(box) {
    const groups = new Map();
    $$('.mh-judge').forEach((j) => { const k = j.dataset.q || '?'; groups.set(k, (groups.get(k) || []).concat(j)); });
    const items = [];
    let gi = 0;
    groups.forEach((js, q) => {
      js.flatMap((x) => $$('.mh-ch', x)).forEach((ch, i) => {
        const n = +ch.dataset.n || i + 1;
        evs(ch.dataset.ev).forEach(({ para, phrase }) => { if (phrase) items.push({ para, phrase, label: q + '-' + '①②③④⑤⑥'[n - 1], cls: 'q' + (gi % 5) }); });
      });
      gi++;
    });
    [...box.children].filter((el) => el.matches('[data-para]')).forEach((el) => {
      const { s, map } = textMap(el);
      const ends = [];
      items.filter((it) => it.para === el.dataset.para).forEach((it) => {
        const at = s.indexOf(norm(it.phrase));
        if (at >= 0 && !ends.some((e) => e.label === it.label)) ends.push({ end: at + norm(it.phrase).length - 1, label: it.label, cls: it.cls });
      });
      ends.sort((a, b) => b.end - a.end || (a.label < b.label ? 1 : -1)).forEach(({ end, label, cls }) => {
        const [node, i] = map[end];
        const rest = node.splitText(i + 1);
        const b = document.createElement('span');
        b.className = 'mh-qref ' + cls;
        b.textContent = label;
        node.parentNode.insertBefore(b, rest);
      });
    });
  }

  // ---------- 선지 판정 ----------
  $$('.mh-judge').forEach((j) => {
    const id = j.dataset.src;
    const view = j.querySelector('.mh-view');
    if (!srcs[id] || !view) { report(j, 'mh-src', `선지 판정에 지문(data-src="${id}")이나 .mh-view가 없다`); return; }
    const tabs = document.createElement('div');
    tabs.className = 'mh-tabs';
    const body = document.createElement('div');
    body.className = 'mh-body';
    pick(id, j.dataset.paras).forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mh-tab'; b.dataset.para = p.dataset.para;
      b.textContent = p.dataset.tab || labelOf(p);
      tabs.appendChild(b);
      // 판정 장의 지문에는 읽기용 주석과 단계(.step)를 두지 않는다
      const c = bare(p);
      c.hidden = true;
      body.appendChild(c);
    });
    // 근거가 두 곳 이상(지문과 <보기>, (가)와 (나) 등)이면 근거 문장만 뽑아 한 화면에 모아 보인다
    const ex = document.createElement('div');
    ex.className = 'mh-ex';
    ex.hidden = true;
    body.appendChild(ex);
    view.append(tabs, body);
    j.setAttribute('data-activity', '');   // 자동 점검이 활동 장으로 센다
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // 문단 el에서 구절들이 든 문장을 찾아, 구절은 형광으로 감싼 HTML 조각 목록을 돌려준다
    const excerpts = (el, phrases) => {
      const { s } = textMap(el);
      const groups = [];
      phrases.forEach((ph) => {
        const w = norm(ph);
        const at = s.indexOf(w);
        if (at < 0) return;
        const before = s.slice(0, at);
        const m = before.match(/^.*[.?!][”’"」)]*\s/s);
        const a = m ? m[0].length : 0;
        const tail = /[.?!][”’"」)]*(?=\s|$)/g;
        tail.lastIndex = at + w.length - 1;
        const t = tail.exec(s);
        const b = t ? t.index + t[0].length : s.length;
        let g = groups.find((x) => a < x.b && b > x.a);
        if (!g) groups.push(g = { a, b, r: [] });
        g.a = Math.min(g.a, a); g.b = Math.max(g.b, b);
        g.r.push([at, at + w.length]);
      });
      return groups.sort((x, y) => x.a - y.a).map((g) => {
        g.r.sort((x, y) => x[0] - y[0]);
        // 문장이 길면 형광 앞뒤 40자만 남긴다
        let a = g.a, b = g.b;
        if (b - a > 150) { a = Math.max(a, g.r[0][0] - 40); b = Math.min(b, g.r[g.r.length - 1][1] + 40); }
        let html = a > g.a ? '…' : '', k = a;
        g.r.forEach(([x, y]) => { x = Math.max(x, k); if (y <= x) return; html += esc(s.slice(k, x)) + '<mark class="mh-hl">' + esc(s.slice(x, y)) + '</mark>'; k = y; });
        return html + esc(s.slice(k, b)) + (b < g.b ? '…' : '');
      });
    };
    const show = (para) => {
      [...body.children].forEach((c) => { c.hidden = c.dataset.para !== para; });
      [...tabs.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.para === para)));
      body.scrollTop = 0;
    };
    tabs.addEventListener('click', (e) => { const b = e.target.closest('.mh-tab'); if (b) show(b.dataset.para); });
    if (tabs.firstChild) show(tabs.firstChild.dataset.para);

    const open = (ch) => {
      ch.classList.add('is-open');
      clearMarks(body);
      $$('.mh-tab', tabs).forEach((b) => b.classList.remove('has-ev'));
      let firstPara = null, firstMark = null;
      evs(ch.dataset.ev).forEach(({ para, phrase }) => {
        const el = [...body.children].find((c) => c.dataset.para === para);
        const tab = [...tabs.children].find((b) => b.dataset.para === para);
        if (tab) tab.classList.add('has-ev');
        firstPara = firstPara || para;
        const m = el && phrase ? highlight(el, phrase) : null;
        if (m && !firstMark) firstMark = m;
      });
      const list = evs(ch.dataset.ev).filter((e) => e.phrase);
      const paras = [...new Set(list.map((e) => e.para))];
      if (paras.length > 1) {
        // 근거가 여러 곳: 곳마다 근거 문장을 뽑아 함께 보인다. 탭을 누르면 그 글 전체(형광 포함)로 간다
        ex.innerHTML = paras.map((para) => {
          const el = [...body.children].find((c) => c.dataset.para === para);
          const tab = [...tabs.children].find((b) => b.dataset.para === para);
          if (!el) return '';
          const parts = excerpts(el, list.filter((e) => e.para === para).map((e) => e.phrase));
          return `<div class="mh-ex-i"><span class="mh-ex-t">${esc(tab ? tab.textContent : para)}</span>${parts.map((h) => `<p>${h}</p>`).join('')}</div>`;
        }).join('') + '<p class="mh-ex-note">탭을 누르면 그 글 전체에서 근거를 볼 수 있다.</p>';
        [...body.children].forEach((c) => { c.hidden = c !== ex; });
        [...tabs.children].forEach((b) => b.setAttribute('aria-pressed', 'false'));
        body.scrollTop = 0;
      } else if (firstPara) show(firstPara);
      if (firstMark && paras.length <= 1) firstMark.scrollIntoView({ block: 'nearest' });
      const g = ch.querySelector('.mh-guess[aria-pressed="true"]');
      const res = ch.querySelector('.mh-res');
      if (res) res.textContent = g ? (g.dataset.g === ch.dataset.ox ? '예상이 맞았다.' : '예상과 다르다.') : '';
    };
    $$('.mh-ch', j).forEach((ch) => {
      const ox = ch.dataset.ox === 'x' ? 'x' : 'o';
      ch.dataset.ox = ox;
      const ctl = document.createElement('div');
      ctl.className = 'mh-ctl';
      ctl.innerHTML = '<button type="button" class="mh-guess" data-g="o">○ 맞다</button>' +
        '<button type="button" class="mh-guess" data-g="x">✕ 틀리다</button>' +
        '<button type="button" class="mh-open">판정과 근거</button>';
      const verdict = document.createElement('p');
      verdict.className = 'mh-verdict';
      verdict.innerHTML = (ox === 'o' ? '<b class="mh-o">○ 맞는 설명</b>' : '<b class="mh-x">✕ 틀린 설명</b>') + ' <span class="mh-res"></span>';
      const ct = ch.querySelector('.mh-ct') || ch.firstElementChild;
      if (ct) ct.after(ctl); else ch.prepend(ctl);
      ctl.after(verdict);
      ctl.addEventListener('click', (e) => {
        const g = e.target.closest('.mh-guess');
        if (g) $$('.mh-guess', ctl).forEach((b) => b.setAttribute('aria-pressed', String(b === g)));
        if (e.target.closest('.mh-open')) open(ch);
      });
    });
  });

  // ---------- 점검 ----------
  const NEG = /(않은|않는|틀린|아닌|어긋나는|거리가 먼|부적절)/;
  function check() {
    const out = issues.slice();
    const add = (el, code, msg) => out.push({ slide: el ? slideNo(el) : 0, code, msg });
    $$('template.mh-src').forEach((t) => {
      const seen = new Set();
      parasOf(t.id).forEach((p) => {
        if (seen.has(p.dataset.para)) add(null, 'mh-dup-para', `지문 ${t.id}에 data-para="${p.dataset.para}"가 두 번 있다`);
        seen.add(p.dataset.para);
        const len = norm(bare(p).textContent).length;
        if (len > 330) add(null, 'mh-long-para', `지문 ${t.id}의 ${labelOf(p)}이(가) ${len}자다. 판정 장 지문 칸에 들어가도록 330자 이하로 data-para="2a", "2b"처럼 나눈다`);
      });
    });
    // 같은 문항(data-q)의 판정 장은 묶어서 센다(선지를 두 장에 나눈 경우)
    const groups = new Map();
    $$('.mh-judge').forEach((j) => { const k = j.dataset.q || '?'; groups.set(k, (groups.get(k) || []).concat(j)); });
    groups.forEach((js, q) => {
      const j = js[0];
      const chs = js.flatMap((x) => $$('.mh-ch', x));
      const sec = j.closest('section.slide');
      const stem = norm((j.querySelector('.mh-stem') || (sec && sec.querySelector('h2')) || {}).textContent);
      const ans = +j.dataset.answer;
      if (js.some((x) => +x.dataset.answer !== ans)) add(j, 'mh-answer', `${q}번 판정 장들의 data-answer가 서로 다르다`);
      if (!ans) add(j, 'mh-answer', `${q}번 .mh-judge에 data-answer(정답 번호)가 없다`);
      if (chs.length !== 5) add(j, 'mh-choices', `${q}번 선지가 ${chs.length}개다(보통 5개)`);
      if (!stem) add(j, 'mh-stem', `${q}번 발문(.mh-stem 또는 장 제목)이 없다`);
      const neg = NEG.test(stem);
      chs.forEach((ch, i) => {
        const n = +ch.dataset.n || i + 1;
        const ox = ch.getAttribute('data-ox');
        if (ox !== 'o' && ox !== 'x') add(ch, 'mh-ox', `${q}번 ${n}번 선지에 data-ox="o|x"가 없다`);
        const should = (n === ans) !== neg ? 'o' : 'x';
        if (ans && (ox === 'o' || ox === 'x') && ox !== should) add(ch, 'mh-ox-key', `${q}번 ${n}번 선지 data-ox="${ox}"가 정답 ${ans}번과 발문(${neg ? '적절하지 않은 것' : '적절한 것'})에 맞지 않다. "${should}"여야 한다`);
        if (!norm((ch.querySelector('.mh-why') || {}).textContent)) add(ch, 'mh-why', `${q}번 ${n}번 선지에 해설(.mh-why)이 없다`);
        const list = evs(ch.dataset.ev);
        if (!list.length) add(ch, 'mh-ev', `${q}번 ${n}번 선지에 근거(data-ev="문단|구절")가 없다`);
        list.forEach(({ para, phrase }) => {
          const p = parasOf(ch.closest('.mh-judge').dataset.src).find((x) => x.dataset.para === para);
          if (!p) add(ch, 'mh-ev', `${q}번 ${n}번 선지 근거의 문단 "${para}"가 지문에 없다`);
          else if (phrase && !locate(bare(p), phrase)) add(ch, 'mh-ev', `${q}번 ${n}번 선지 근거 구절 "${phrase}"이(가) ${labelOf(p)}에 글자 그대로 없다`);
        });
      });
      const quiz = document.querySelector(`.quiz[data-q="${CSS.escape(q)}"]`);
      if (quiz && ans) {
        const okAt = $$('.opt', quiz).findIndex((o) => o.hasAttribute('data-ok')) + 1;
        if (okAt !== ans) add(quiz, 'mh-quiz-key', `${q}번 응답 문제의 정답(${okAt}번)이 판정 장의 data-answer(${ans}번)와 다르다`);
      }
    });
    $$('.mh-flow').forEach((f) => { if (!f.querySelector('.blank')) add(f, 'mh-flow', '포인트 흐름도에 빈칸(.blank)이 없다'); });
    // 그림: 파일 안에 들었는지, 열리는지, 설명(alt)이 있는지, 너무 늘어나 흐리지 않은지(장마다 한 번)
    const imgs = $$('img').filter((im) => im.closest('section.slide') || im.closest('.mh-view'));
    $$('template.mh-src').forEach((t) => $$('img', t.content).forEach((im) => imgs.push(im)));
    const seenImg = new Set();
    imgs.forEach((im) => {
      const src = im.getAttribute('src') || '';
      const name = (im.getAttribute('alt') || src.replace(/^data:.*/, '(파일 안 그림)')).slice(0, 24);
      const key = src.slice(0, 200) + '|' + (im.closest('section.slide') ? slideNo(im) : 't');
      if (seenImg.has(key)) return;
      seenImg.add(key);
      const el = im.isConnected ? im : null;
      if (!src) { add(el, 'mh-img', `그림에 src가 없다`); return; }
      if (/^https?:/i.test(src)) add(el, 'mh-img', `그림 「${name}」이(가) 외부 주소다. 시험지에서 잘라 그림/ 폴더에 두고 묶는다`);
      if (!(im.getAttribute('alt') || '').trim()) add(el, 'mh-img-alt', `그림에 무엇을 잘라 넣었는지 적은 alt가 없다(시험지 쪽과 자리, 예: "13번 〈보기〉 그래프, 6쪽")`);
      if (!el || !im.complete) return;
      if (!im.naturalWidth) add(el, 'mh-img-broken', `그림 「${name}」이(가) 열리지 않는다(파일 이름이나 묶기를 확인)`);
      // 흐림(늘어남)은 장을 하나씩 보여 가며 재야 해서 화면 점검 Munhang.layout()이 맡는다
    });
    return out;
  }

  // 그림 목록: 장 번호, 설명, 원래 크기. 시험지 쪽과 하나씩 눈으로 대 보는 데 쓴다
  function figures() {
    return $$('section.slide img').map((im) => ({ slide: slideNo(im), alt: im.getAttribute('alt') || '', w: im.naturalWidth, h: im.naturalHeight, ok: im.complete && im.naturalWidth > 0 }));
  }

  // 점검 결과가 있으면 화면 위에 작은 단추를 띄운다(장 밖이라 수업 화면에는 남지 않는다)
  function badge(list) {
    if (!list.length || new URLSearchParams(location.search).has('nocheck')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mh-badge';
    b.textContent = `문항 점검 ${list.length}`;
    b.addEventListener('click', () => {
      const text = '문항 수업 파일 점검 결과다. 이 항목만 고쳐 파일 전체를 다시 줘.\n' +
        list.map((x) => `- [${x.code}]${x.slide ? ' ' + x.slide + '쪽' : ''} ${x.msg}`).join('\n');
      const d = document.createElement('dialog');
      d.className = 'mh-dlg';
      const pre = document.createElement('pre');
      pre.textContent = text;
      const copy = document.createElement('button');
      copy.type = 'button'; copy.textContent = 'AI에게 보낼 말 복사';
      copy.onclick = () => navigator.clipboard && navigator.clipboard.writeText(text).then(() => { copy.textContent = '복사했다'; });
      const close = document.createElement('button');
      close.type = 'button'; close.textContent = '닫기';
      close.onclick = () => d.close();
      d.append(pre, copy, close);
      document.body.appendChild(d);
      d.showModal();
    });
    document.body.appendChild(b);
  }

  // 화면 점검(겹침·카드 밖)과 타이머·쓸어넘기기는 kit.js가 맡는다(모든 exploragram 수업 공용)
  window.Munhang = { check, figures, layout: (o) => (window.MhKit ? window.MhKit.layout(o) : []), highlight, clearMarks, locate };
  // 그림이 다 열린 뒤(load) 점검해야 「열리지 않는 그림」을 잡는다
  const run = () => { const list = check(); window.Munhang.issues = list; badge(list); };
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);

})();
