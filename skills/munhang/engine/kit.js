/*! kit.js — exploragram 수업 공용 교실 도구
 * 떠 있는 타이머(툴바 「타이머」), 휴대폰 쓸어넘기기(장 바깥 여백 포함), 화면 점검 MhKit.layout()(글자 겹침·카드 밖, 그림 잘림·덮음).
 * 어느 exploragram 수업에도 붙인다. 엔진(exploragram.js)보다 먼저 불러도 되고 뒤에 불러도 된다.
 * 짝: kit.css(툴바에서 쓰지 않는 단추 숨김, 타이머 모양).
 */
(() => {
  'use strict';
  if (window.MhKit) return;
  const slides = () => [...document.querySelectorAll('section.slide')];
  window.MhKit = {};

  // ---------- 화면 점검: 글자가 제 칸을 벗어나 겹치는지, 장(카드) 밖으로 나가는지 ----------
  // 장마다 잠깐 보이게 하고 단계(.step)를 모두 연 채로 잰다. 끝나면 원래 장으로 돌아간다.
  // 결과: [{slide, code: 'mh-spill'|'mh-out', msg}]  (mh-spill: 칸을 벗어난 글자 → 옆 글과 겹침)
  function layout({ margin = 26 } = {}) {
    const all = slides();
    const cur = all.find((s) => s.classList.contains('is-active'));
    const st = document.createElement('style');
    st.textContent = '.step, .mh-gloss { visibility: visible !important; opacity: 1 !important; }';
    document.head.appendChild(st);
    const out = [];
    const BLOCK = /^(block|flex|grid|table-cell|list-item|flow-root|inline-block|table-caption)$/;
    all.forEach((s, si) => {
      all.forEach((x) => x.classList.toggle('is-active', x === s));
      const sr = s.getBoundingClientRect();
      if (!sr.width) return;
      const k = sr.width / 1280;
      const seen = new Set();
      const tw = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (!n.data.trim() || n.parentElement.closest('svg, .ch-tb, [hidden]')) continue;
        let box = n.parentElement;
        while (box !== s && !BLOCK.test(getComputedStyle(box).display)) box = box.parentElement;
        const r = document.createRange();
        r.selectNodeContents(n);
        const t = r.getBoundingClientRect();
        if (!t.width) continue;
        const b = box.getBoundingClientRect();
        const word = n.data.trim().slice(0, 14);
        // 글자가 제 상자 오른쪽·아래로 3px 넘게 나가면 옆 칸 글과 겹친다
        if ((t.right - b.right) / k > 3 || (t.bottom - b.bottom) / k > 3) {
          const key = 'spill' + box.tagName + word;
          if (!seen.has(key)) { seen.add(key); out.push({ slide: si + 1, code: 'mh-spill', msg: `${si + 1}장: 「${word}」 글자가 제 칸(${box.tagName.toLowerCase()}${box.className ? '.' + String(box.className).split(' ')[0] : ''})을 벗어나 옆 글과 겹친다` }); }
        }
        // 흰 카드 밖(장 가장자리에서 margin 안쪽)으로 나가면 잘려 보인다
        if ((t.bottom - sr.top) / k > 720 - margin || (t.right - sr.left) / k > 1280 - margin) {
          const key = 'out' + word;
          if (!seen.has(key)) { seen.add(key); out.push({ slide: si + 1, code: 'mh-out', msg: `${si + 1}장: 「${word}」 글자가 카드 밖으로 나간다` }); }
        }
      }
      // 그림: 카드 밖으로 나가 잘리거나, 제 칸보다 커서 옆 글을 덮는지
      s.querySelectorAll('img').forEach((im) => {
        const t = im.getBoundingClientRect();
        if (!t.width || !t.height) return;
        const name = (im.getAttribute('alt') || '그림').slice(0, 14);
        if ((t.bottom - sr.top) / k > 720 - margin || (t.right - sr.left) / k > 1280 - margin) out.push({ slide: si + 1, code: 'mh-img-out', msg: `${si + 1}장: 그림 「${name}」이(가) 카드 밖으로 나가 잘린다(장을 나누거나 그림 높이를 줄인다)` });
        if (im.naturalWidth && t.width / k > im.naturalWidth * 1.5) out.push({ slide: si + 1, code: 'mh-img-blur', msg: `${si + 1}장: 그림 「${name}」이(가) 원래 크기(${im.naturalWidth}px)보다 1.5배 넘게 늘어나 흐리다(더 크게 다시 자른다)` });
        const box = im.parentElement.getBoundingClientRect();
        if ((t.right - box.right) / k > 3 || (t.bottom - box.bottom) / k > 3) out.push({ slide: si + 1, code: 'mh-img-spill', msg: `${si + 1}장: 그림 「${name}」이(가) 제 칸을 벗어나 옆 글을 덮는다` });
      });
    });
    all.forEach((x) => x.classList.toggle('is-active', x === cur));
    st.remove();
    return out;
  }

  window.MhKit.layout = layout;

  // ---------- 휴대폰: 장 바깥(검은 여백)에서 밀어도 넘긴다 ----------
  // 장 위에서 미는 것은 엔진이 처리한다(손 도구일 때). 세로로 든 폰은 장이 가는 띠라 바깥에서 미는 일이 많다.
  // 두 손가락 확대(pinch)는 그대로 둔다.
  const bindSwipe = (tries = 40) => {
    const vp = document.querySelector('.ch-viewport');
    if (!vp || !window.Exploragram) { if (tries > 0) setTimeout(() => bindSwipe(tries - 1), 150); return; }
    vp.style.touchAction = 'pinch-zoom';
    let st = null;
    const SKIP = '.ch-deck, .ch-toolbar, .ch-tb-handle, .ch-hud, .ch-panel, .ch-pop, button, input, textarea, select, a';
    vp.addEventListener('pointerdown', (e) => {
      st = e.isPrimary && e.pointerType === 'touch' && !(e.target.closest && e.target.closest(SKIP)) ? [e.clientX, e.clientY] : null;
    });
    vp.addEventListener('pointercancel', () => { st = null; });
    vp.addEventListener('pointerup', (e) => {
      if (!st || !e.isPrimary) return;
      const dx = e.clientX - st[0], dy = e.clientY - st[1];
      st = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? window.Exploragram.next() : window.Exploragram.prev());
    });
  };
  if (document.readyState === 'complete') bindSwipe(); else window.addEventListener('load', () => bindSwipe());

  // ---------- 떠 있는 타이머: 툴바 「타이머」로 열고 닫는다 ----------
  // 어느 장에서든 쓴다. 처음 시간은 <html data-mh-timer="초">(세트 권장 시간), 없으면 5분.
  // 창을 닫아도 계속 흐르고, 그동안 툴바 단추에 남은 시간이 보인다. 제목줄을 끌어 옮긴다.
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const timerUI = () => {
    const rec = +document.documentElement.dataset.mhTimer || 0;
    let total = rec || 300, left = total, endAt = 0, tick = null, beeped = false;
    const panel = document.createElement('div');
    panel.className = 'mh-ftimer';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '타이머');
    const presets = [60, 180, 300, 600];
    panel.innerHTML = `<div class="mh-ft-bar"><span>타이머</span><button type="button" class="mh-ft-x" aria-label="타이머 닫기">✕</button></div>
      <output class="mh-ft-face">${fmt(total)}</output>
      <div class="mh-ft-row"><button type="button" class="mh-ft-go">시작</button><button type="button" class="mh-ft-reset">다시</button><button type="button" data-d="-60">−1분</button><button type="button" data-d="60">+1분</button></div>
      <div class="mh-ft-row mh-ft-pre">${rec && !presets.includes(rec) ? `<button type="button" data-s="${rec}" class="rec">이 세트 ${fmt(rec).replace(/:00$/, '분').replace(':', '분 ') + (rec % 60 ? '초' : '')}</button>` : ''}${presets.map((s) => `<button type="button" data-s="${s}"${s === rec ? ' class="rec"' : ''}>${s / 60}분</button>`).join('')}</div>`;
    document.body.appendChild(panel);
    const face = panel.querySelector('.mh-ft-face'), go = panel.querySelector('.mh-ft-go');
    let btn = null;
    const beep = () => {
      try {
        const A = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.35, 0.7].forEach((t) => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(A.destination); o.start(A.currentTime + t); o.stop(A.currentTime + t + 0.2); });
      } catch (e) { /* 소리를 못 내도 화면 알림은 한다 */ }
    };
    const draw = () => {
      face.textContent = left > 0 ? fmt(Math.ceil(left)) : '끝!';
      panel.classList.toggle('is-end', left <= 0);
      panel.classList.toggle('is-run', !!tick);
      go.textContent = tick ? '멈춤' : '시작';
      if (btn) {
        const lab = btn.querySelector('span');
        lab.textContent = tick || left <= 0 || left < total ? (left > 0 ? fmt(Math.ceil(left)) : '끝!') : '타이머';
        btn.classList.toggle('mh-ft-on', !!tick || left <= 0);
      }
    };
    const stop = () => { clearInterval(tick); tick = null; };
    const step = () => {
      left = (endAt - Date.now()) / 1000;
      if (left <= 0) { left = 0; stop(); if (!beeped) { beeped = true; beep(); } }
      draw();
    };
    const set = (s) => { stop(); total = left = Math.max(10, s); beeped = false; draw(); };
    go.addEventListener('click', () => {
      if (tick) { stop(); draw(); return; }
      if (left <= 0) { left = total; beeped = false; }
      endAt = Date.now() + left * 1000;
      tick = setInterval(step, 250);
      draw();
    });
    panel.querySelector('.mh-ft-reset').addEventListener('click', () => set(total));
    panel.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      const d = +b.dataset.d;
      if (tick) { endAt += d * 1000; total = Math.max(10, total + d); step(); } else { total = Math.max(10, total + d); left = Math.max(10, left + d); beeped = false; draw(); }
    }));
    panel.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => set(+b.dataset.s)));
    panel.querySelector('.mh-ft-x').addEventListener('click', () => { panel.hidden = true; });
    // 제목줄을 끌어 옮긴다
    const bar = panel.querySelector('.mh-ft-bar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = panel.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        panel.style.left = Math.min(Math.max(0, ev.clientX - ox), innerWidth - r.width) + 'px';
        panel.style.top = Math.min(Math.max(0, ev.clientY - oy), innerHeight - r.height) + 'px';
        panel.style.right = 'auto';
      };
      const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); };
      bar.addEventListener('pointermove', mv);
      bar.addEventListener('pointerup', up);
    });
    // 툴바에 단추를 단다(목차 앞)
    const attach = (tries = 40) => {
      const misc = document.querySelector('.ch-toolbar .ch-tb-misc');
      if (!misc) { if (tries > 0) setTimeout(() => attach(tries - 1), 150); return; }
      btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ch-tb-btn mh-ft-btn'; btn.title = '타이머'; btn.setAttribute('aria-label', '타이머');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ch-icon"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M9 2.5h6"></path></svg><span>타이머</span>';
      btn.addEventListener('click', () => { panel.hidden = !panel.hidden; });
      const toc = misc.querySelector('[data-name="toc"]');
      misc.insertBefore(btn, toc || misc.firstChild);
      draw();
    };
    attach();
    window.MhKit.timer = { open: () => { panel.hidden = false; }, set, panel };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', timerUI); else timerUI();
})();
