(() => {
  'use strict';

  // ---------- Ustawienia ----------
  const ROUNDS = 7;
  const WRITE_SECS = 45;
  const VOTE_SECS = 25;
  const REVEAL_STEP_MS = 4200;
  const MAX_FAKE = 80;
  const MAX_PLAYERS = 10;
  const CHANNEL_PREFIX = 'kamiennatwarz-v1-';
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const QR_URL = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js';

  const params = new URLSearchParams(location.search);
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];
  // Lokalnie (localhost): karty przeglądarki łączą się przez BroadcastChannel.
  // W sieci (GitHub Pages, adres IP w Wi-Fi albo ?online=1): telefony łączą się przez PeerJS.
  const ONLINE = params.get('online') === '1' ||
    (params.get('online') !== '0' && !LOCAL_HOSTS.includes(location.hostname));
  const app = document.getElementById('app');

  // ---------- Pomocnicze ----------
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const rid = () => Math.random().toString(36).slice(2, 10);
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const makeCode = () => Array.from({ length: 4 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const fmt = n => Number(n).toLocaleString('pl-PL');
  const fmtSecs = ms => String(Math.max(0, Math.ceil(ms / 1000)));
  const players = n => (n === 1 ? 'gracza' : 'graczy');
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* zablokowane */ } },
  };
  const keepOnline = () => (params.get('online') === '1' ? '&online=1' : '');
  const joinUrl = code => `${location.origin}${location.pathname}?join=${code}${keepOnline()}`;
  const modeNote = () => ONLINE
    ? 'Tryb online: każdy, kto ma link albo kod, może dołączyć ze swojego telefonu.'
    : 'Tryb demo na komputerze: gracze dołączają z innych kart tej przeglądarki. Żeby grać na telefonach, otwórz stronę przez adres IP w Wi-Fi albo z GitHub Pages.';

  // ---------- Wspólne kawałki widoków ----------
  const promptHTML = q => esc(q).replace('____', '<span class="blank">&nbsp;</span>');
  const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
  const avatarHTML = name => `<span class="av" style="--h:${hue(name)}" aria-hidden="true">${esc((String(name).trim()[0] || '?').toUpperCase())}</span>`;
  const codeTilesHTML = code => `<div class="roomcode" aria-label="Kod pokoju ${esc(code)}">${[...code].map(c => `<span>${esc(c)}</span>`).join('')}</div>`;
  const phaseTotal = phase => (phase === 'voting' ? VOTE_SECS : WRITE_SECS) * 1000;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paintTimer(el, leftMs, totalMs) {
    el.textContent = fmtSecs(leftMs);
    el.style.setProperty('--p', Math.max(0, Math.min(1, leftMs / totalMs)).toFixed(3));
    el.classList.toggle('low', leftMs > 0 && leftMs < 10000);
  }
  // Animacja wejścia nowego ekranu.
  function enter() {
    if (reducedMotion()) return;
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
  }
  function confetti() {
    if (reducedMotion()) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d'), dpr = devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const colors = ['#ffd23f', '#ff5a6a', '#4ce0b3', '#8fa2ff', '#f3f1ea'];
    const ps = Array.from({ length: 150 }, () => ({
      x: Math.random() * c.width, y: -Math.random() * c.height * 0.6,
      vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      s: (6 + Math.random() * 8) * dpr, col: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function tick(now) {
      const t = now - start;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalAlpha = Math.max(0, 1 - t / 3800);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.04 * dpr; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3800) requestAnimationFrame(tick); else c.remove();
    })(start);
  }
  const roundLabelHTML = (round, rounds) =>
    `<p class="eyebrow ${round === rounds ? 'double' : ''}">Runda ${round} z ${rounds}${round === rounds ? ' · ostatnia, podwójne punkty' : ''}</p>`;

  function chipsHTML(list, { showDone = false, removable = false, myId = null, hostId = null } = {}) {
    if (!list.length) return `<span class="chip empty">Czekamy na graczy…</span>`;
    return list.map(p => {
      const canRemove = removable && p.id !== hostId;
      return `<span class="chip ${showDone && p.done ? 'done' : ''} ${p.id === myId ? 'me' : ''}" ${canRemove ? `role="button" tabindex="0" data-remove="${esc(p.id)}" title="Usuń: ${esc(p.name)}"` : ''}>
        ${avatarHTML(p.name)}<span>${esc(p.name)}</span>${p.bot ? '<span class="bot">BOT</span>' : ''}${p.id === hostId ? '<span class="bot">HOST</span>' : ''}
      </span>`;
    }).join('');
  }

  function boardHTML(list, deltas, myId) {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    const top = Math.max(1, ...sorted.map(p => p.score));
    return `<div class="board">${sorted.map((p, i) => `
      <div class="board-row ${i === 0 && p.score > 0 ? 'first' : ''} ${p.id === myId ? 'me' : ''}">
        <span class="bar" style="--w:${Math.round((p.score / top) * 100)}%"></span>
        <span class="rank">${i + 1}</span>
        ${avatarHTML(p.name)}
        <span class="name">${esc(p.name)}</span>
        <span class="score">${fmt(p.score)}</span>
        <span class="delta">${deltas && deltas[p.id] ? '+' + fmt(deltas[p.id]) : ''}</span>
      </div>`).join('')}</div>`;
  }

  function revealHTML(R, prompt) {
    const names = R.pickers.map(n => `<b>${esc(n)}</b>`).join(', ');
    let body;
    if (R.truth) {
      const credit = R.pickers.length
        ? `<span class="pts">+${fmt(R.points)}</span> dla każdego, kto ją wskazał`
        : R.onlyTruth ? 'Nikt nie napisał fałszywej odpowiedzi.' : 'Wszyscy dali się nabrać!';
      const unpicked = R.unpicked.length
        ? `<p class="muted small">Nikt nie uwierzył w: ${R.unpicked.map(u => `${esc(u.text)} (${esc(u.by)})`).join(', ')}</p>` : '';
      body = `<p class="credit">${credit}</p>${unpicked}`;
    } else {
      body = `<p class="credit">Autor: <b>${esc(R.author)}</b> <span class="pts">+${fmt(R.points)}</span></p>`;
    }
    return `
      <p class="prompt small-prompt">${promptHTML(prompt)}</p>
      <div class="reveal">
        <div class="verdict ${R.truth ? 'is-truth' : 'is-lie'}">
          <div class="answer-big">${esc(R.text)}</div>
          ${R.truth ? '<div class="stamp truth">Prawda</div>' : '<div class="stamp lie">Kłamstwo</div>'}
        </div>
        <p class="pickers">${R.pickers.length ? `Kto wybrał: ${names}` : 'Nikt tego nie wybrał'}</p>
        ${body}
        <div class="dots">${Array.from({ length: R.total }, (_, i) => `<i class="${i <= R.step ? 'on' : ''}"></i>`).join('')}</div>
      </div>`;
  }

  function finalHeadHTML(list) {
    const top = Math.max(0, ...list.map(p => p.score));
    const winners = list.filter(p => p.score === top);
    return `<div class="winner">
      <p class="eyebrow">${winners.length > 1 ? 'Remis' : 'Wygrywa'}</p>
      <h2>${winners.map(w => esc(w.name)).join(' i ')}</h2>
      <p class="muted">${fmt(top)} pkt</p>
    </div>`;
  }

  function copyText(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = 'Skopiowano'; setTimeout(() => (btn.textContent = old), 1500); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(selectJoinUrl);
    } else selectJoinUrl();
  }
  function selectJoinUrl() {
    const el = document.getElementById('joinurl');
    if (!el) return;
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function shareLink(url, btn) {
    if (navigator.share) {
      navigator.share({ title: 'Kamienna Twarz', text: 'Dołącz do gry!', url }).catch(() => {});
    } else copyText(url, btn);
  }

  // Ekran nie gaśnie w trakcie gry (działa tylko przez https albo localhost).
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); } }
    catch { /* brak zgody albo brak wsparcia */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

  // Kod QR do dołączania (wymaga internetu; bez niego po prostu się nie pokaże).
  const qrCache = {};
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Nie udało się wczytać ' + src));
      document.head.appendChild(s);
    });
  }
  function fillQR(url) {
    const box = document.getElementById('qr');
    if (!box) return;
    if (qrCache[url]) { box.innerHTML = qrCache[url]; return; }
    const make = () => {
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      qrCache[url] = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      const b = document.getElementById('qr');
      if (b) b.innerHTML = qrCache[url];
    };
    if (window.qrcode) make();
    else loadScript(QR_URL).then(make).catch(() => { box.hidden = true; });
  }

  // ---------- Linia wykresu wariografu (dekoracja reagująca na ruch w grze) ----------
  const trace = (() => {
    const c = document.getElementById('trace');
    const ctx = c.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() || '#ffd23f';
    let energy = 0.15, t = 0, cur = 0;
    const pts = [];
    function size() {
      c.width = Math.round(innerWidth * devicePixelRatio);
      c.height = Math.round(70 * devicePixelRatio);
    }
    function draw() {
      const w = c.width, h = c.height, step = 3 * devicePixelRatio;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      if (!pts.length) { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
      pts.forEach((p, i) => {
        const x = w - (pts.length - 1 - i) * step, y = h / 2 + p;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    function frame() {
      t++;
      if (t % 2 === 0) {
        energy = Math.max(0.1, energy * 0.97);
        const target = (Math.sin(t * 0.09) * 0.4 + (Math.random() - 0.5) * 1.6) * energy * c.height * 0.45;
        cur = cur * 0.45 + target * 0.55;
        pts.push(cur);
        const maxPts = Math.ceil(c.width / (3 * devicePixelRatio)) + 2;
        while (pts.length > maxPts) pts.shift();
        draw();
      }
      requestAnimationFrame(frame);
    }
    addEventListener('resize', () => { size(); draw(); });
    size();
    if (reduce) draw(); else requestAnimationFrame(frame);
    return { spike(n = 1) { energy = Math.min(1, energy + 0.5 * n); } };
  })();

  // ---------- Pytania z Wikipedii (darmowe publiczne API, bez klucza) ----------
  // Bierzemy losowe hasła z kilku kategorii polskiej Wikipedii (dawne zawody, tańce,
  // naczynia…) i robimy z nich pytania „„X” (dawny zawód) to ____.”. Odpowiedź to
  // początek definicji z Wikipedii. Na grę idzie tylko kilka zapytań.
  const WIKI_BASE = 'https://pl.wikipedia.org/w/api.php?action=query&format=json&origin=*';
  const WIKI_CATEGORIES = [
    ['Zawody historyczne', 'dawny zawód'], ['Tańce', 'taniec'], ['Naczynia', 'naczynie'],
    ['Błędy poznawcze', 'błąd poznawczy'], ['Zwyczaje', 'zwyczaj'], ['Tkaniny', 'tkanina'],
    ['Neologizmy', 'nowe słowo'], ['Desery', 'deser'], ['Elementy ubioru', 'część ubioru'],
    ['Gry towarzyskie', 'gra'], ['Nakrycia głowy', 'nakrycie głowy'], ['Narzędzia', 'narzędzie'],
    ['Przesądy', 'przesąd'], ['Przyprawy', 'przyprawa'], ['Urządzenia', 'urządzenie'],
    ['Zespoły chorobowe', 'choroba'], ['Zjawiska optyczne', 'zjawisko'], ['Figury retoryczne', 'figura retoryczna'],
    ['Formy muzyczne', 'forma muzyczna'], ['Fryzury', 'fryzura'], ['Gatunki literackie', 'gatunek literacki'],
    ['Kuchnia polska', 'kuchnia polska'], ['Meble', 'mebel'], ['Sztuki walki', 'sztuka walki'], ['Rzemiosła', 'rzemiosło'],
  ];
  const WIKI_NOT_DEF = /^(mia[łl]|by[łl]|jest\b|to\b|zosta[łl]|s[ąa]\b|odby|le[żz]y|znajduje|wydan)/i;
  const WIKI_NATION = /^[a-ząćęłńóśźż-]+(ski|ska|skie|cki|cka|ckie|scy|ccy)\b/i;

  // Zwraca krótką definicję albo null, jeśli hasło nie nadaje się na pytanie.
  function wikiParse(title, extract) {
    if (/[\d(:/,]/.test(title) || title.length > 36) return null;
    if (/\((ur|zm)\.|może oznaczać|Osoby o tym|odnosi się do/.test(extract)) return null;
    let t = extract.replace(/\s+/g, ' ');
    for (let i = 0; i < 3; i++) t = t.replace(/\s*\([^()]*\)/g, '');
    const m = / [–—-] /.exec(t);
    if (!m || m.index > 60) return null;
    let d = t.slice(m.index + m[0].length).split(/;|\.(?:\s|$)/)[0].trim();
    // Krótko, żeby prawdziwa odpowiedź nie odstawała długością od wymyślonych.
    if (d.length > 70) {
      let cut = d.lastIndexOf(', ', 70);
      if (cut < 25) cut = d.lastIndexOf(' ', 70);
      if (cut < 25) return null;
      d = d.slice(0, cut);
      // Nie kończ na „z”, „na”, „i”… — urwane zdanie zdradza prawdziwą odpowiedź.
      while (/\s(?:z|ze|w|we|na|do|od|i|a|o|u|po|za|dla|oraz|lub|albo|przez|przy|pod|nad|jak|że|się|ich|jej|jego|który|która|które|czy|bez|ku|niż|tak|są|jest|to)$/i.test(d)) {
        d = d.replace(/\s\S+$/, '');
      }
    }
    d = d.replace(/[,:.\s]+$/, '');
    if (d.length < 12) return null;
    if (WIKI_NOT_DEF.test(d) || WIKI_NATION.test(d)) return null;
    // Odrzuć, jeśli definicja zdradza hasło.
    const low = d.toLowerCase();
    if ((title.toLowerCase().match(/[a-ząćęłńóśźż]{5,}/g) || []).some(w => low.includes(w.slice(0, 5)))) return null;
    return d;
  }

  async function wikiGet(params) {
    const r = await fetch(WIKI_BASE + '&' + new URLSearchParams(params));
    if (!r.ok) throw new Error('Wikipedia odpowiedziała błędem ' + r.status);
    return r.json();
  }

  async function fetchFromCategory([cat, hint]) {
    const list = await wikiGet({ list: 'categorymembers', cmtitle: 'Kategoria:' + cat, cmtype: 'page', cmnamespace: '0', cmlimit: '500' });
    const titles = shuffle(((list.query && list.query.categorymembers) || []).map(x => x.title)).slice(0, 20);
    if (!titles.length) return [];
    const ex = await wikiGet({ prop: 'extracts', exintro: '1', explaintext: '1', exchars: '400', exlimit: '20', titles: titles.join('|') });
    return Object.values((ex.query && ex.query.pages) || {})
      .map(pg => { const def = wikiParse(pg.title, pg.extract || ''); return def ? { title: pg.title, def, hint } : null; })
      .filter(Boolean);
  }

  // Pobiera co najmniej `want` haseł z losowych kategorii, przemieszanych między kategoriami.
  async function fetchWikiItems(want) {
    const cats = shuffle(WIKI_CATEGORIES);
    const groups = [];
    let anyOk = false, lastErr = null;
    for (let i = 0; i < 6 && groups.flat().length < want; i += 3) {
      const results = await Promise.allSettled(cats.slice(i, i + 3).map(fetchFromCategory));
      for (const r of results) {
        if (r.status === 'fulfilled') { anyOk = true; groups.push(shuffle(r.value)); }
        else lastErr = r.reason;
      }
      if (!anyOk) throw lastErr || new Error('Wikipedia nie odpowiada.');
    }
    const out = [];
    for (let k = 0; groups.some(g => g.length > k); k++) groups.forEach(g => g[k] && out.push(g[k]));
    return out;
  }

  function wikiQuestions(items, n) {
    const picked = items.slice(0, n);
    const spare = items.length - n >= 3 ? items.slice(n) : items;
    return picked.map(it => ({
      q: `„${it.title}” (${it.hint}) to ____.`,
      a: it.def, alt: [], src: 'wiki',
      url: 'https://pl.wikipedia.org/wiki/' + encodeURIComponent(it.title.replace(/ /g, '_')),
      // Boty kłamią definicjami innych haseł z tej samej kategorii, żeby brzmiały wiarygodnie.
      decoys: [
        ...shuffle(spare.filter(x => x !== it && x.hint === it.hint)),
        ...shuffle(spare.filter(x => x !== it && x.hint !== it.hint)),
      ].map(x => x.def).slice(0, 4),
    }));
  }

  const SOURCES = [
    ['mixed', 'Mieszane', 'Ciekawostki i hasła z Wikipedii'],
    ['builtin', 'Ciekawostki', 'Sprawdzone pytania, działają bez internetu'],
    ['wiki', 'Wikipedia', 'Losowe dziwne hasła, za każdym razem inne'],
  ];
  function sourcePickerHTML(current, editable) {
    if (!editable) {
      const s = SOURCES.find(x => x[0] === current) || SOURCES[0];
      return `<p class="muted small">Pytania: <b>${s[1]}</b> · ${s[2]}</p>`;
    }
    return `<div class="panel stack">
      <p class="eyebrow">Skąd pytania</p>
      <div class="seg" role="radiogroup" aria-label="Skąd pytania">${SOURCES.map(([id, label, desc]) => `
        <button class="seg-btn ${id === current ? 'on' : ''}" role="radio" aria-checked="${id === current}" data-source="${id}">
          <b>${label}</b><span>${desc}</span>
        </button>`).join('')}
      </div>
    </div>`;
  }
  function bindSource(root, fn) {
    const btns = root.querySelectorAll('[data-source]');
    btns.forEach(b => (b.onclick = () => {
      // Od razu zaznacz wybór, zanim gospodarz potwierdzi go przez sieć.
      btns.forEach(x => {
        const on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-checked', String(on));
      });
      fn(b.dataset.source);
    }));
  }
  const truthLinkHTML = url => (url ? ` <a href="${esc(url)}" target="_blank" rel="noopener">Hasło w Wikipedii</a>` : '');

  // ---------- Połączenia ----------
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    return loadScript(PEERJS_URL).catch(() => {
      throw new Error('Nie udało się wczytać PeerJS. Sprawdź połączenie z internetem.');
    });
  }

  async function createHostTransport(code, onMsg) {
    if (!ONLINE) {
      const ch = new BroadcastChannel(CHANNEL_PREFIX + code);
      ch.onmessage = e => { if (e.data && e.data.dir === 'p') onMsg(e.data); };
      return { send: m => ch.postMessage({ ...m, dir: 'h' }) };
    }
    await loadPeer();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(CHANNEL_PREFIX + code);
      const conns = new Map(); // id gracza -> połączenie
      let opened = false;
      peer.on('open', () => {
        opened = true;
        resolve({
          send(m) {
            const data = { ...m, dir: 'h' };
            if (m.to) { const c = conns.get(m.to); if (c && c.open) c.send(data); }
            else for (const c of conns.values()) if (c.open) c.send(data);
          },
        });
      });
      peer.on('connection', conn => {
        conn.on('data', m => {
          if (!m || m.dir !== 'p' || !m.id) return;
          conns.set(m.id, conn);
          onMsg(m);
        });
        conn.on('close', () => { for (const [k, v] of conns) if (v === conn) conns.delete(k); });
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', err => { if (!opened) reject(err); else console.warn('PeerJS:', err); });
    });
  }

  async function createPlayerTransport(code, myId, onMsg, onClose) {
    if (!ONLINE) {
      const ch = new BroadcastChannel(CHANNEL_PREFIX + code);
      ch.onmessage = e => {
        const m = e.data;
        if (m && m.dir === 'h' && (!m.to || m.to === myId)) onMsg(m);
      };
      return { send: m => ch.postMessage({ ...m, id: myId, dir: 'p' }) };
    }
    await loadPeer();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer();
      let opened = false;
      const notFound = () => new Error(`Nie ma gry z kodem ${code}.`);
      peer.on('error', err => {
        if (opened) { console.warn('PeerJS:', err); return; }
        reject(err.type === 'peer-unavailable' ? notFound() : err);
      });
      peer.on('open', () => {
        const conn = peer.connect(CHANNEL_PREFIX + code, { reliable: true });
        const timeout = setTimeout(() => reject(notFound()), 10000);
        conn.on('open', () => {
          opened = true;
          clearTimeout(timeout);
          resolve({ send: m => conn.send({ ...m, id: myId, dir: 'p' }) });
        });
        conn.on('data', m => { if (m && m.dir === 'h' && (!m.to || m.to === myId)) onMsg(m); });
        conn.on('close', () => onClose && onClose());
      });
    });
  }

  // ---------- Strona startowa ----------
  const logoHTML = (small) => `
    <header class="stack">
      <h1 class="logo" ${small ? 'style="font-size:40px"' : ''}>Kamienna <span>Twarz</span></h1>
      ${small ? '' : '<p class="tagline">Quiz, w którym dobre kłamstwo wygrywa z prawdą.</p>'}
    </header>`;

  function renderLanding() {
    app.className = 'phone';
    app.innerHTML = `
      ${logoHTML(false)}
      <form class="panel stack" id="hostform">
        <h3>Załóż grę</h3>
        <p class="muted">Twój telefon będzie gospodarzem. Grasz razem ze wszystkimi.</p>
        <label for="hostname">Twoje imię</label>
        <input type="text" id="hostname" maxlength="16" autocomplete="off" placeholder="Jak mówią na ciebie znajomi" value="${esc(store.get('sf-name') || '')}" required>
        <button class="btn big">Załóż grę</button>
      </form>
      <form class="panel stack" id="joinform">
        <h3>Dołącz do gry</h3>
        <label for="code">Kod pokoju</label>
        <input type="text" id="code" class="code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" required>
        <button class="btn big ghost">Dołącz</button>
      </form>
      <p class="mode">${esc(modeNote())}</p>
      <p class="small muted">Masz telewizor albo laptop, który widzą wszyscy? <a href="?host=tv${keepOnline()}">Pokaż grę na dużym ekranie</a>.</p>`;
    document.getElementById('hostform').onsubmit = e => {
      e.preventDefault();
      const name = document.getElementById('hostname').value.trim().slice(0, 16);
      if (!name) return;
      store.set('sf-name', name);
      startHost('phones', name);
    };
    document.getElementById('joinform').onsubmit = e => {
      e.preventDefault();
      const code = document.getElementById('code').value.trim().toUpperCase();
      if (code.length === 4) location.search = `?join=${code}${keepOnline()}`;
    };
  }

  // ---------- Gospodarz (logika gry) ----------
  // mode 'phones': gra działa na telefonie gospodarza, który też jest graczem.
  // mode 'tv': ta karta to duży ekran, gracze używają telefonów jak pilotów.
  async function startHost(mode, hostName) {
    const PH = mode === 'phones';
    app.className = PH ? 'phone' : '';
    app.innerHTML = `<p class="muted">Tworzę pokój…</p>`;

    const G = {
      phase: 'lobby', players: [], round: 0, qs: [], q: null, source: 'mixed', notice: '',
      fakes: {}, votes: {}, answers: [], deadline: 0,
      step: 0, revealOrder: [], pickers: {}, deltas: {}, unpicked: [],
    };
    const hostPid = PH ? 'host_' + rid() : null;
    let code, tx, revealTimer = null, localPlayer = null, tvScene = '';

    for (let attempt = 0; attempt < 3 && !tx; attempt++) {
      code = makeCode();
      try { tx = await createHostTransport(code, onMsg); }
      catch (err) {
        if (err && err.type === 'unavailable-id') continue;
        app.innerHTML = `<p class="error">Nie udało się utworzyć pokoju: ${esc(err.message || err)}</p>
          <button class="btn" id="retry">Spróbuj ponownie</button>`;
        document.getElementById('retry').onclick = () => location.reload();
        return;
      }
    }
    if (!tx) { app.innerHTML = `<p class="error">Nie znaleziono wolnego kodu pokoju. Odśwież stronę.</p>`; return; }

    const send = m => {
      tx.send(m);
      if (localPlayer && (!m.to || m.to === hostPid)) localPlayer.deliver(m);
    };

    const mult = () => (G.round === ROUNDS ? 2 : 1);
    const nameOf = id => (G.players.find(p => p.id === id) || { name: '?' }).name;
    const isTruth = n => [G.q.a, ...(G.q.alt || [])].some(x => norm(x) === n);

    function revealInfo() {
      const a = G.revealOrder[G.step];
      const picks = G.pickers[a.id] || [];
      const m = mult();
      const truth = a.by === null;
      return {
        step: G.step, total: G.revealOrder.length, text: a.text, truth,
        author: truth ? null : nameOf(a.by),
        pickers: picks.map(nameOf),
        points: truth ? 1000 * m : 500 * m * picks.length,
        unpicked: truth ? G.unpicked.map(u => ({ text: u.text, by: nameOf(u.by) })) : [],
        onlyTruth: G.answers.length === 1,
      };
    }

    function publicState() {
      const after = G.phase === 'scores' || G.phase === 'final';
      return {
        t: 'state', mode, hostId: hostPid, phase: G.phase, code, round: G.round, rounds: ROUNDS,
        double: G.round === ROUNDS,
        prompt: G.q ? G.q.q : null,
        remaining: Math.max(0, G.deadline - Date.now()),
        players: G.players.map(p => ({
          id: p.id, name: p.name, score: p.score, bot: p.bot,
          done: G.phase === 'writing' ? !!G.fakes[p.id] : G.phase === 'voting' ? !!G.votes[p.id] : false,
        })),
        answers: G.phase === 'voting' ? G.answers.map(a => ({ id: a.id, text: a.text })) : null,
        reveal: G.phase === 'reveal' ? revealInfo() : null,
        deltas: after ? G.deltas : null,
        truth: after && G.q ? G.q.a : null,
        truthUrl: after && G.q && G.q.url ? G.q.url : null,
        source: G.source, notice: G.notice,
      };
    }
    const broadcast = () => send(publicState());

    // --- wiadomości od graczy ---
    function onMsg(m) {
      const p = G.players.find(x => x.id === m.id);
      if (m.t === 'join') {
        let name = String(m.name || '').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Gracz';
        if (G.players.some(x => x.id !== m.id && x.name.toLowerCase() === name.toLowerCase())) {
          name = name.slice(0, 14) + ' ' + (G.players.length + 1);
        }
        if (p) p.name = name;
        else {
          if (G.players.length >= MAX_PLAYERS) { send({ t: 'full', to: m.id }); return; }
          G.players.push({ id: m.id, name, score: 0, bot: false });
          trace.spike();
        }
        refreshPlayers();
        broadcast();
        return;
      }
      if (!p) return;
      if (m.t === 'fake') submitFake(p, m.text);
      else if (m.t === 'vote') submitVote(p, m.answerId);
      else if (m.t === 'cmd' && PH && m.id === hostPid) hostCommand(m);
    }

    // Przyciski gospodarza na jego telefonie.
    function hostCommand(m) {
      switch (m.cmd) {
        case 'start': if (G.phase === 'lobby' && G.players.length >= 2) startGame(); break;
        case 'addbot': if (G.phase === 'lobby') addBot(); break;
        case 'source': if (G.phase === 'lobby' && SOURCES.some(x => x[0] === m.source)) { G.source = m.source; broadcast(); } break;
        case 'remove': if (G.phase === 'lobby' && m.target !== hostPid) removePlayer(m.target); break;
        case 'next':
          if (G.phase === 'reveal') advanceReveal();
          else if (G.phase === 'scores') (G.round >= ROUNDS ? finish() : nextRound());
          break;
        case 'skip':
          if (G.phase === 'writing') startVoting();
          else if (G.phase === 'voting') startReveal();
          break;
        case 'again': if (G.phase === 'final') startGame(); break;
        case 'lobby': if (G.phase === 'final') backToLobby(); break;
      }
    }

    function reject(p, reason) {
      if (!p.bot) send({ t: 'reject', to: p.id, reason, round: G.round });
    }

    // Zwraca true, jeśli odpowiedź została przyjęta.
    function submitFake(p, raw) {
      if (G.phase !== 'writing' || G.fakes[p.id]) return false;
      const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_FAKE);
      const n = norm(text);
      if (!n) return reject(p, 'Wpisz chociaż jedno prawdziwe słowo.');
      if (isTruth(n)) return reject(p, 'To jest prawdziwa odpowiedź! Zachowaj ją dla siebie i wymyśl fałszywą.');
      if (Object.values(G.fakes).some(f => norm(f) === n)) return reject(p, 'Ktoś już to wpisał. Wymyśl coś innego.');
      G.fakes[p.id] = text;
      trace.spike();
      setTimeout(() => { if (G.phase === 'writing' && G.players.every(x => G.fakes[x.id])) startVoting(); });
      refreshPlayers();
      broadcast();
      return true;
    }

    function submitVote(p, answerId) {
      if (G.phase !== 'voting' || G.votes[p.id]) return;
      const a = G.answers.find(x => x.id === answerId);
      if (!a || a.by === p.id) return;
      G.votes[p.id] = answerId;
      trace.spike();
      refreshPlayers();
      broadcast();
      if (G.players.every(x => G.votes[x.id])) startReveal();
    }

    // --- boty (żeby przetestować grę w pojedynkę) ---
    const BOT_NAMES = ['Robo Rysiek', 'Pan Piksel', 'Jednostka 42', 'Blaszak', 'Zgrzyt', 'Bajtek', 'Śrubka', 'Gadżet'];
    const GENERIC = ['spaghetti', 'kozę', 'nikt nie wie', 'Księżyc', 'ser żółty', 'malutki kapelusz'];
    function addBot() {
      if (G.players.length >= MAX_PLAYERS) return;
      const used = new Set(G.players.map(p => p.name));
      const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + (G.players.length + 1);
      G.players.push({ id: 'bot_' + rid(), name, score: 0, bot: true });
      trace.spike();
      refreshPlayers();
      broadcast();
    }
    function removePlayer(id) {
      G.players = G.players.filter(p => p.id !== id);
      refreshPlayers();
      broadcast();
    }
    function botsWrite() {
      const r = G.round;
      G.players.filter(p => p.bot).forEach(b => setTimeout(() => {
        if (G.phase !== 'writing' || G.round !== r || G.fakes[b.id]) return;
        // Próbuj kolejnych kłamstw, aż któreś zostanie przyjęte (np. gdy inny bot wziął to samo).
        for (const x of shuffle(G.q.decoys || []).concat(shuffle(GENERIC))) if (submitFake(b, x)) break;
      }, 2500 + Math.random() * 9000));
    }
    function botsVote() {
      const r = G.round;
      G.players.filter(p => p.bot).forEach(b => setTimeout(() => {
        if (G.phase !== 'voting' || G.round !== r || G.votes[b.id]) return;
        const options = G.answers.filter(a => a.by !== b.id);
        const real = options.find(a => a.by === null);
        const choice = Math.random() < 0.35 ? real : options[Math.floor(Math.random() * options.length)];
        submitVote(b, choice.id);
      }, 2000 + Math.random() * 7000));
    }

    // --- przebieg gry ---
    let loadingGame = false;
    const usedBuiltin = new Set(); // żeby wbudowane pytania nie powtarzały się w kolejnych grach
    async function startGame() {
      if (loadingGame) return;
      loadingGame = true;
      clearTimeout(revealTimer);
      G.phase = 'loading'; G.notice = ''; G.round = 0;
      render(); broadcast();

      let wiki = [];
      if (G.source !== 'builtin') {
        const need = G.source === 'wiki' ? ROUNDS : Math.ceil(ROUNDS / 2);
        try {
          wiki = wikiQuestions(await fetchWikiItems(need + 3), need);
          if (wiki.length < need) G.notice = 'Wikipedia dała za mało haseł, więc dokładamy wbudowane pytania.';
        } catch {
          G.notice = 'Nie udało się pobrać haseł z Wikipedii, więc gramy na wbudowanych pytaniach.';
        }
      }
      let fresh = window.QUESTIONS.filter(q => !usedBuiltin.has(q.q));
      if (fresh.length < ROUNDS - wiki.length) { usedBuiltin.clear(); fresh = [...window.QUESTIONS]; }
      const builtin = shuffle(fresh).slice(0, ROUNDS - wiki.length);
      builtin.forEach(q => usedBuiltin.add(q.q));
      G.qs = shuffle([...wiki, ...builtin]);

      loadingGame = false;
      G.players.forEach(p => (p.score = 0));
      nextRound();
    }
    function nextRound() {
      G.round++;
      G.q = G.qs[G.round - 1];
      G.fakes = {}; G.votes = {}; G.answers = []; G.deltas = {};
      G.phase = 'writing';
      G.deadline = Date.now() + WRITE_SECS * 1000;
      render(); broadcast(); botsWrite();
    }
    function startVoting() {
      if (G.phase !== 'writing') return;
      const real = { id: 'real', text: G.q.a, by: null };
      const fakes = Object.entries(G.fakes).map(([pid, text]) => ({ id: 'f_' + pid, text, by: pid }));
      G.answers = shuffle([real, ...fakes]);
      if (!fakes.length) return startReveal();
      G.phase = 'voting';
      G.deadline = Date.now() + VOTE_SECS * 1000;
      render(); broadcast(); botsVote();
    }
    function startReveal() {
      if (G.phase !== 'writing' && G.phase !== 'voting') return;
      if (!G.answers.length) G.answers = [{ id: 'real', text: G.q.a, by: null }];
      const m = mult();
      const deltas = {}; G.players.forEach(p => (deltas[p.id] = 0));
      const pickers = {}; G.answers.forEach(a => (pickers[a.id] = []));
      for (const [pid, aid] of Object.entries(G.votes)) {
        const a = G.answers.find(x => x.id === aid);
        if (!a) continue;
        pickers[aid].push(pid);
        if (a.by === null) deltas[pid] = (deltas[pid] || 0) + 1000 * m;
        else if (a.by in deltas) deltas[a.by] += 500 * m;
      }
      G.deltas = deltas; G.pickers = pickers;
      const fooled = G.answers.filter(a => a.by && pickers[a.id].length)
        .sort((x, y) => pickers[x.id].length - pickers[y.id].length);
      G.unpicked = G.answers.filter(a => a.by && !pickers[a.id].length);
      G.revealOrder = [...fooled, G.answers.find(a => a.by === null)];
      G.phase = 'reveal'; G.step = 0;
      render(); broadcast();
      scheduleReveal();
    }
    function scheduleReveal() {
      clearTimeout(revealTimer);
      const isLast = G.step === G.revealOrder.length - 1;
      revealTimer = setTimeout(advanceReveal, REVEAL_STEP_MS + (isLast ? 1500 : 0));
    }
    function advanceReveal() {
      clearTimeout(revealTimer);
      if (G.phase !== 'reveal') return;
      G.step++;
      if (G.step >= G.revealOrder.length) return showScores();
      render(); broadcast(); scheduleReveal();
    }
    function showScores() {
      G.players.forEach(p => (p.score += G.deltas[p.id] || 0));
      G.phase = 'scores';
      render(); broadcast();
    }
    function finish() { G.phase = 'final'; render(); broadcast(); }
    function backToLobby() {
      clearTimeout(revealTimer);
      G.phase = 'lobby'; G.round = 0; G.q = null;
      G.players.forEach(p => (p.score = 0));
      render(); broadcast();
    }

    // Zegar: odlicza czas i przechodzi dalej, gdy się skończy.
    setInterval(() => {
      const left = G.deadline - Date.now();
      if (!PH) {
        const el = document.getElementById('timer');
        if (el) paintTimer(el, left, phaseTotal(G.phase));
      }
      if (left <= 0) {
        if (G.phase === 'writing') startVoting();
        else if (G.phase === 'voting') startReveal();
      }
    }, 250);

    addEventListener('beforeunload', e => { if (G.players.length > (PH ? 1 : 0)) e.preventDefault(); });

    // --- widok dużego ekranu (tylko tryb 'tv') ---
    function refreshPlayers() {
      if (PH) return;
      if (G.phase === 'lobby') return render();
      const el = document.getElementById('chips');
      if (el) el.innerHTML = chipsHTML(publicState().players, { showDone: true });
    }

    function render() {
      if (PH) return;
      ({ lobby: tvLobby, loading: tvLoading, writing: tvWriting, voting: tvVoting, reveal: tvReveal, scores: tvScores, final: tvFinal })[G.phase]();
      const scene = `${G.phase}|${G.round}|${G.step}`;
      if (scene !== tvScene) { tvScene = scene; enter(); if (G.phase === 'final') confetti(); }
      const timer = document.getElementById('timer');
      if (timer) paintTimer(timer, G.deadline - Date.now(), phaseTotal(G.phase));
    }

    function tvLobby() {
      const url = joinUrl(code);
      const n = G.players.length;
      app.innerHTML = `
        ${logoHTML(false)}
        <section class="lobby">
          <div class="panel stack">
            <p class="eyebrow">Kod pokoju</p>
            ${codeTilesHTML(code)}
            <div class="qr" id="qr"></div>
            <p class="muted">Gracze dołączają tutaj</p>
            <div class="joinurl" id="joinurl">${esc(url)}</div>
            <div class="row">
              <button class="btn ghost" id="copy">Kopiuj link</button>
              <button class="btn ghost" id="opentab">Otwórz kartę gracza</button>
            </div>
            <p class="mode">${esc(modeNote())}</p>
          </div>
          <div class="stack">
            <div class="panel stack">
              <div class="spread">
                <p class="eyebrow">Gracze · ${n}/${MAX_PLAYERS}</p>
                <button class="btn ghost" id="addbot" ${n >= MAX_PLAYERS ? 'disabled' : ''}>Dodaj bota</button>
              </div>
              <div class="chips" id="chips">${chipsHTML(G.players, { removable: true })}</div>
              ${n ? '<p class="muted small">Kliknij imię, żeby usunąć gracza.</p>' : ''}
            </div>
            ${sourcePickerHTML(G.source, true)}
            <button class="btn big" id="start" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'Potrzeba co najmniej 2 graczy' : `Zacznij grę (${n} ${players(n)})`}</button>
            ${howToHTML()}
          </div>
        </section>`;
      fillQR(url);
      document.getElementById('copy').onclick = e => copyText(url, e.currentTarget);
      document.getElementById('opentab').onclick = () => window.open(url, '_blank');
      document.getElementById('addbot').onclick = addBot;
      document.getElementById('start').onclick = startGame;
      bindRemove(app, removePlayer);
      bindSource(app, src => { G.source = src; render(); });
    }
    function tvLoading() {
      app.innerHTML = `<p class="status-big">Losuję pytania…</p>
        <p class="muted">${G.source === 'builtin' ? 'Chwileczkę.' : 'Szukam dziwnych haseł w Wikipedii. To potrwa kilka sekund.'}</p>`;
    }
    function tvWriting() {
      app.innerHTML = `
        <div class="spread">${roundLabelHTML(G.round, ROUNDS)}<div class="timer" id="timer"></div></div>
        <h2 class="prompt">${promptHTML(G.q.q)}</h2>
        <p class="instruction">Wpisz na telefonie fałszywą odpowiedź. Niech brzmi wiarygodnie.</p>
        ${G.notice && G.round === 1 ? `<p class="muted small">${esc(G.notice)}</p>` : ''}
        <div class="chips" id="chips">${chipsHTML(publicState().players, { showDone: true })}</div>`;
    }
    function tvVoting() {
      app.innerHTML = `
        <div class="spread">${roundLabelHTML(G.round, ROUNDS)}<div class="timer" id="timer"></div></div>
        <h2 class="prompt small-prompt">${promptHTML(G.q.q)}</h2>
        <p class="instruction">Jedna z tych odpowiedzi jest prawdziwa. Głosuj na telefonie.</p>
        <div class="answers">${G.answers.map((a, i) => `
          <div class="answer-card"><span class="key">${String.fromCharCode(65 + i)}</span><span>${esc(a.text)}</span></div>`).join('')}
        </div>
        <div class="chips" id="chips">${chipsHTML(publicState().players, { showDone: true })}</div>`;
    }
    function tvReveal() {
      app.innerHTML = `${roundLabelHTML(G.round, ROUNDS)}${revealHTML(revealInfo(), G.q.q)}
        <div class="row center"><button class="btn ghost" id="next">Dalej</button></div>`;
      document.getElementById('next').onclick = advanceReveal;
    }
    function tvScores() {
      const last = G.round >= ROUNDS;
      app.innerHTML = `
        <div class="spread">
          <div class="stack"><p class="eyebrow">Po rundzie ${G.round} z ${ROUNDS}</p><h2>Wyniki</h2></div>
          <button class="btn big" id="next">${last ? 'Kto wygrał?' : 'Następne pytanie'}</button>
        </div>
        <p class="muted">Prawdziwa odpowiedź: <b class="truth-text">${esc(G.q.a)}</b>${truthLinkHTML(G.q.url)}</p>
        ${boardHTML(G.players, G.deltas)}`;
      document.getElementById('next').onclick = last ? finish : nextRound;
    }
    function tvFinal() {
      app.innerHTML = `${finalHeadHTML(G.players)}${boardHTML(G.players)}
        <div class="row center">
          <button class="btn big" id="again">Zagraj jeszcze raz</button>
          <button class="btn ghost" id="lobby">Wróć do poczekalni</button>
        </div>`;
      document.getElementById('again').onclick = startGame;
      document.getElementById('lobby').onclick = backToLobby;
    }

    // Spacja albo strzałka w prawo klika „Dalej” na dużym ekranie.
    if (!PH) addEventListener('keydown', e => {
      if ((e.key === ' ' || e.key === 'ArrowRight') && document.activeElement === document.body) {
        const b = document.getElementById('next');
        if (b) { e.preventDefault(); b.click(); }
      }
    });

    if (PH) {
      // Gospodarz to też gracz: jego widok gracza rozmawia z logiką gry bezpośrednio.
      localPlayer = startPlayer(code, {
        id: hostPid, name: hostName, isHost: true,
        transport: { send: m => queueMicrotask(() => onMsg({ ...m, id: hostPid, dir: 'p' })) },
      });
    } else render();
  }

  function howToHTML() {
    return `<div class="panel stack">
      <p class="eyebrow">Jak grać</p>
      <ol class="steps">
        <li><b>Wymyśl fałszywą odpowiedź</b>, która brzmi prawdziwie.</li>
        <li><b>Znajdź prawdziwą odpowiedź</b> wśród kłamstw znajomych.</li>
        <li><b>1000 pkt</b> za trafienie prawdy i <b>500 pkt</b> za każdą osobę, która uwierzy w twoje kłamstwo. Ostatnia runda liczy się podwójnie.</li>
      </ol>
    </div>`;
  }

  function bindRemove(root, fn) {
    root.querySelectorAll('[data-remove]').forEach(el => {
      const go = () => fn(el.dataset.remove);
      el.onclick = go;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
  }

  // ---------- Gracz (widok telefonu) ----------
  function startPlayer(code, opts = {}) {
    app.className = 'phone';
    const idKey = 'sf-id-' + code;
    const myId = opts.id || store.get(idKey) || rid();
    if (!opts.id) store.set(idKey, myId);
    const isHost = !!opts.isHost;
    let myName = opts.name || store.get('sf-name') || '';
    let tx = opts.transport || null;
    let S = null, viewKey = '', deadline = 0;
    let myFake = null;     // { round, text }
    let localVote = null;  // runda, w której już zagłosowaliśmy
    let error = '', draft = '';
    let joinTimer = null, lastScene = '';

    const me = () => S && S.players.find(p => p.id === myId);
    const cmd = (c, extra = {}) => tx.send({ t: 'cmd', cmd: c, ...extra });

    function header() {
      return `<div class="spread">
        <p class="eyebrow">Pokój ${esc(code)}${myName ? ' · ' + esc(myName) : ''}</p>
      </div>`;
    }

    function showNameForm(msg = '') {
      viewKey = '';
      app.innerHTML = `
        ${logoHTML(true)}
        <form class="panel stack" id="nameform">
          <p class="eyebrow">Dołączasz do pokoju ${esc(code)}</p>
          <label for="name">Twoje imię</label>
          <input type="text" id="name" maxlength="16" autocomplete="off" placeholder="Jak mówią na ciebie znajomi" value="${esc(myName)}" required>
          ${msg ? `<p class="error">${esc(msg)}</p>` : ''}
          <button class="btn big">Dołącz do gry</button>
        </form>
        <p class="mode">${esc(modeNote())}</p>`;
      const input = document.getElementById('name');
      input.focus();
      document.getElementById('nameform').onsubmit = e => {
        e.preventDefault();
        myName = input.value.trim().slice(0, 16);
        if (!myName) return;
        store.set('sf-name', myName);
        connect();
      };
    }

    function showMessage(text, retry) {
      viewKey = '';
      app.innerHTML = `${header()}<div class="panel stack"><p class="error">${esc(text)}</p>
        <button class="btn" id="retry">${retry ? 'Spróbuj ponownie' : 'Wróć'}</button></div>`;
      document.getElementById('retry').onclick = retry || (() => showNameForm());
    }

    async function connect() {
      keepAwake();
      app.innerHTML = `${header()}<p class="muted">Łączę…</p>`;
      viewKey = '';
      try {
        if (!tx) tx = await createPlayerTransport(code, myId, onMsg,
          () => showMessage('Utracono połączenie z gospodarzem.', () => location.reload()));
      } catch (err) {
        tx = null;
        return showMessage(err.message || String(err), connect);
      }
      tx.send({ t: 'join', name: myName });
      if (isHost) return;
      clearTimeout(joinTimer);
      joinTimer = setTimeout(() => {
        if (!S) showMessage(`Nie ma gry z kodem ${code}. Sprawdź, czy gospodarz nadal ma otwartą grę.`, connect);
      }, ONLINE ? 8000 : 2500);
    }

    function onMsg(m) {
      if (m.t === 'full') { clearTimeout(joinTimer); return showMessage('Ta gra jest już pełna (10 graczy).'); }
      if (m.t === 'reject') {
        if (myFake && myFake.round === m.round) myFake = null;
        error = m.reason;
        return render(true);
      }
      if (m.t === 'state') {
        clearTimeout(joinTimer);
        if (S && S.round !== m.round) { error = ''; draft = ''; }
        S = m;
        deadline = Date.now() + (m.remaining || 0);
        render();
      }
    }

    function render(force) {
      if (!S) return;
      const p = me();
      const done = !!p && (p.done ||
        (S.phase === 'voting' && localVote === S.round) ||
        (S.phase === 'writing' && myFake && myFake.round === S.round));
      const waiting = S.players.filter(x => !x.done).length;
      const typing = S.phase === 'writing' && !done;
      const sig = typing ? '' : JSON.stringify(S.players.map(x => [x.name, x.score, x.done]));
      const key = [S.phase, S.round, S.reveal ? S.reveal.step : '', !!p, done, error, S.source, S.notice, sig].join('|');
      if (!force && key === viewKey) return;
      viewKey = key;

      if (!p) {
        app.innerHTML = `${header()}<div class="panel stack"><p>Nie jesteś teraz w tej grze.</p>
          <button class="btn" id="rejoin">Dołącz ponownie</button></div>`;
        document.getElementById('rejoin').onclick = () => tx.send({ t: 'join', name: myName });
        return;
      }

      const phones = S.mode === 'phones';
      const hostName = (S.players.find(x => x.id === S.hostId) || {}).name;
      const roundLine = `<div class="spread">${roundLabelHTML(S.round, S.rounds)}<div class="timer" id="timer"></div></div>`;
      const sorted = [...S.players].sort((a, b) => b.score - a.score);
      const rank = sorted.findIndex(x => x.id === myId) + 1;
      const skipBtn = isHost ? `<button class="btn ghost" id="skip">Zakończ czas</button>` : '';
      const progress = `<div class="chips">${chipsHTML(S.players, { showDone: true, myId })}</div>`;

      switch (S.phase) {
        case 'lobby':
          if (isHost) {
            const url = joinUrl(code);
            const n = S.players.length;
            app.innerHTML = `
              ${header()}
              <div class="panel stack center-text">
                <p class="eyebrow">Kod pokoju</p>
                ${codeTilesHTML(code)}
                <div class="qr" id="qr"></div>
                <p class="muted small">Znajomi skanują kod QR albo wpisują kod na stronie gry.</p>
                <div class="joinurl" id="joinurl">${esc(url)}</div>
                <div class="row center">
                  <button class="btn ghost" id="share">Udostępnij link</button>
                  ${ONLINE ? '' : '<button class="btn ghost" id="opentab">Otwórz kartę gracza</button>'}
                </div>
              </div>
              <div class="panel stack">
                <div class="spread">
                  <p class="eyebrow">Gracze · ${n}/${MAX_PLAYERS}</p>
                  <button class="btn ghost" id="addbot" ${n >= MAX_PLAYERS ? 'disabled' : ''}>Dodaj bota</button>
                </div>
                <div class="chips">${chipsHTML(S.players, { removable: true, myId, hostId: S.hostId })}</div>
                ${n > 1 ? '<p class="muted small">Dotknij imienia, żeby usunąć gracza.</p>' : ''}
              </div>
              ${sourcePickerHTML(S.source, true)}
              <button class="btn big" id="start" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'Potrzeba co najmniej 2 graczy' : `Zacznij grę (${n} ${players(n)})`}</button>
              ${howToHTML()}
              <p class="mode">Gra działa na twoim telefonie. Nie zamykaj tej karty i nie wyłączaj ekranu, bo gra się skończy.</p>`;
            fillQR(url);
            document.getElementById('share').onclick = e => shareLink(url, e.currentTarget);
            const ot = document.getElementById('opentab');
            if (ot) ot.onclick = () => window.open(url, '_blank');
            document.getElementById('addbot').onclick = () => cmd('addbot');
            document.getElementById('start').onclick = () => cmd('start');
            bindRemove(app, id => cmd('remove', { target: id }));
            bindSource(app, src => cmd('source', { source: src }));
          } else {
            app.innerHTML = `${header()}
              <p class="status-big">Jesteś w grze, ${esc(p.name)}!</p>
              <p class="muted">${hostName ? `Czekamy, aż ${esc(hostName)} zacznie grę.` : 'Czekamy na start gry.'} Nie zamykaj tej strony.</p>
              <div class="chips">${chipsHTML(S.players, { myId, hostId: S.hostId })}</div>
              ${sourcePickerHTML(S.source, false)}
              ${howToHTML()}`;
          }
          break;

        case 'loading':
          app.innerHTML = `${header()}<p class="status-big">Losuję pytania…</p>
            <p class="muted">${S.source === 'builtin' ? 'Chwileczkę.' : 'Szukam dziwnych haseł w Wikipedii. To potrwa kilka sekund.'}</p>`;
          break;

        case 'writing':
          if (done) {
            app.innerHTML = `${roundLine}
              <h2 class="prompt small-prompt">${promptHTML(S.prompt)}</h2>
              <div class="locked stack"><p class="eyebrow">Twoja fałszywa odpowiedź</p><p class="quote">${esc(myFake ? myFake.text : '')}</p></div>
              <p class="muted">Czekamy jeszcze na ${waiting} ${players(waiting)}…</p>
              ${progress}${skipBtn}`;
          } else {
            app.innerHTML = `${roundLine}
              <h2 class="prompt">${promptHTML(S.prompt)}</h2>
              <form class="stack" id="fakeform">
                <label for="fake">Twoja fałszywa odpowiedź</label>
                <input type="text" id="fake" maxlength="${MAX_FAKE}" autocomplete="off" autocapitalize="off" placeholder="Coś, w co uwierzą">
                ${error ? `<p class="error">${esc(error)}</p>` : ''}
                <button class="btn big">Zatwierdź</button>
              </form>
              ${S.notice && S.round === 1 ? `<p class="muted small">${esc(S.notice)}</p>` : ''}
              ${skipBtn}`;
            const input = document.getElementById('fake');
            input.value = draft;
            input.oninput = () => (draft = input.value);
            input.focus();
            document.getElementById('fakeform').onsubmit = e => {
              e.preventDefault();
              const text = input.value.trim();
              if (!text) return;
              error = '';
              myFake = { round: S.round, text };
              tx.send({ t: 'fake', text });
              render(true);
            };
          }
          break;

        case 'voting': {
          if (done) {
            app.innerHTML = `${roundLine}
              <p class="status-big">Głos oddany.</p>
              <p class="muted">Czekamy jeszcze na ${waiting} ${players(waiting)}.</p>
              ${progress}${skipBtn}`;
            break;
          }
          const mine = myFake && myFake.round === S.round ? myFake.text.trim().replace(/\s+/g, ' ').slice(0, MAX_FAKE) : null;
          const options = S.answers.filter(a => a.text !== mine);
          app.innerHTML = `${roundLine}
            <p class="prompt small-prompt">${promptHTML(S.prompt)}</p>
            <p class="instruction">Która odpowiedź jest prawdziwa?</p>
            <div class="stack">${options.map((a, i) => `<button class="answer-btn" data-id="${esc(a.id)}"><span class="key">${String.fromCharCode(65 + i)}</span><span>${esc(a.text)}</span></button>`).join('')}</div>
            <p class="muted small">Twojej odpowiedzi tu nie ma.</p>
            ${skipBtn}`;
          app.querySelectorAll('.answer-btn').forEach(b => (b.onclick = () => {
            localVote = S.round;
            tx.send({ t: 'vote', answerId: b.dataset.id });
            render(true);
          }));
          break;
        }

        case 'reveal':
          if (phones && S.reveal) {
            app.innerHTML = `${roundLabelHTML(S.round, S.rounds)}${revealHTML(S.reveal, S.prompt)}
              ${isHost ? '<div class="row center"><button class="btn ghost" id="next">Dalej</button></div>' : ''}`;
          } else {
            app.innerHTML = `${header()}<p class="status-big">Patrz na duży ekran.</p>
              <p class="muted">Zaraz się okaże, kto kogo nabrał.</p>`;
          }
          break;

        case 'scores': {
          const d = (S.deltas && S.deltas[myId]) || 0;
          const last = S.round >= S.rounds;
          app.innerHTML = `${header()}
            <div class="spread"><div class="stack"><p class="eyebrow">Po rundzie ${S.round} z ${S.rounds}</p><h2>Wyniki</h2></div></div>
            <p>${d ? `<b class="truth-text">+${fmt(d)}</b> w tej rundzie.` : 'W tej rundzie bez punktów.'} Jesteś na <b>${rank}. miejscu</b>.</p>
            <p class="muted">Prawdziwa odpowiedź: <b class="truth-text">${esc(S.truth || '')}</b>${truthLinkHTML(S.truthUrl)}</p>
            ${phones ? boardHTML(S.players, S.deltas, myId) : ''}
            ${isHost ? `<button class="btn big" id="next">${last ? 'Kto wygrał?' : 'Następne pytanie'}</button>`
              : `<p class="muted small">${phones && hostName ? `${esc(hostName)} włączy następne pytanie.` : ''}</p>`}`;
          break;
        }

        case 'final':
          app.innerHTML = `${header()}
            ${finalHeadHTML(S.players)}
            <p class="center-text">${rank === 1 ? '<b>Wygrana!</b>' : `Twoje miejsce: <b>${rank}.</b>`}</p>
            ${boardHTML(S.players, null, myId)}
            ${isHost ? `<div class="row center">
                <button class="btn big" id="again">Zagraj jeszcze raz</button>
                <button class="btn ghost" id="lobby">Wróć do poczekalni</button>
              </div>` : '<p class="muted small center-text">Czekamy, aż gospodarz zacznie nową grę.</p>'}`;
          break;
      }

      const scene = [S.phase, S.round, S.reveal ? S.reveal.step : '', done].join('|');
      if (scene !== lastScene) {
        lastScene = scene;
        enter();
        if (S.phase === 'final') confetti();
      }
      const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
      if (isHost) {
        on('next', () => cmd('next'));
        on('skip', () => cmd('skip'));
        on('again', () => cmd('again'));
        on('lobby', () => cmd('lobby'));
      }
      const t = document.getElementById('timer');
      if (t) paintTimer(t, deadline - Date.now(), phaseTotal(S.phase));
    }

    setInterval(() => {
      const t = document.getElementById('timer');
      if (t && S) paintTimer(t, deadline - Date.now(), phaseTotal(S.phase));
    }, 250);

    if (isHost || myName) connect(); else showNameForm();
    return { deliver: onMsg };
  }

  // ---------- Wybór widoku ----------
  if (params.get('host') === 'tv') startHost('tv');
  else if (params.get('join')) startPlayer(params.get('join').trim().toUpperCase().slice(0, 4));
  else renderLanding();
})();
