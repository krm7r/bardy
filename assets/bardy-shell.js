/* Bardy shell: sidebar, rotating Egyptian backgrounds, Quran radio, small utilities. Runs on every page. */
(() => {
  if (window.__bardyShell) return;
  window.__bardyShell = true;
  const KEY = 'bardy:shell:v1';
  const DEFAULTS = { bgShow: true, bgAuto: true, bgInterval: 30, bgIndex: -1, radioShow: true, volume: 0.8, playing: false };
  let st = { ...DEFAULTS };
  try { st = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;

  /* Image results: a card whose image fails to load is removed (instead of showing the placeholder). */
  window.bardyImgFail = img => {
    const card = img.closest('.image-grid-card');
    if (!card) { img.src = '/assets/site-placeholder.svg'; return; }
    const grid = card.parentElement;
    card.remove();
    const left = grid ? grid.querySelectorAll('.image-grid-card').length : 0;
    const count = grid?.closest('.result-section')?.querySelector('.section-heading span');
    if (count) count.textContent = left + ' صورة';
    if (grid && !left) grid.innerHTML = '<div class="empty">تعذر تحميل الصور من مصادرها. جرّب عبارة بحث أخرى.</div>';
  };

  let BACKGROUNDS = [
    { type: 'photo', src: '/assets/bg/photos/giza-1.webp', title: 'أهرامات الجيزة' },
    { type: 'photo', src: '/assets/bg/photos/sphinx-1.webp', title: 'أبو الهول' },
    { type: 'photo', src: '/assets/bg/photos/karnak-1.webp', title: 'معبد الكرنك' },
    { type: 'photo', src: '/assets/bg/photos/abu-simbel-1.webp', title: 'معبد أبو سمبل' },
    { type: 'photo', src: '/assets/bg/photos/nile-1.webp', title: 'النيل وفلوكة أسوان' },
    { type: 'photo', src: '/assets/bg/photos/luxor-1.webp', title: 'معبد الأقصر' },
    { type: 'photo', src: '/assets/bg/photos/philae-1.webp', title: 'معبد فيلة' },
  ];
  const bad = new Set();
  async function loadBackgrounds() {
    try {
      const res = await Promise.race([fetch('/assets/bg/backgrounds.json', { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(rej, 1800))]);
      const json = await res.json();
      const list = (Array.isArray(json) ? json : json.backgrounds || []).filter(b => b && b.type === 'photo' && typeof b.src === 'string' && b.src.startsWith('/assets/bg/photos/'));
      if (list.length) BACKGROUNDS = list;
    } catch {}
  }
  const PAGES = [
    ['/', 'الرئيسية', '⌂'], ['/web.html', 'الويب', '🔎'], ['/ai.html', 'الإجابات الذكية', '✨'], ['/images.html', 'الصور', '🖼'],
    ['/videos.html', 'الفيديو', '▶'], ['/news.html', 'مدونة الأخبار', '📰'], ['/local.html', 'أنشطة محلية', '📍'], ['/events.html', 'الأحداث', '🎭'],
  ];
  const INFO = [['/about', 'عن بردي'], ['/contact', 'تواصل معنا'], ['/privacy', 'سياسة الخصوصية'], ['/terms', 'شروط الاستخدام'], ['/help', 'المساعدة والأسئلة الشائعة'], ['/sitemap', 'خريطة الموقع']];
  const STREAM = 'https://stream.radiojar.com/8s5u5tpdtwzuv';

  const norm = p => (p || '/').replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
  const here = norm(location.pathname);
  let toastTimer;
  const toast = msg => {
    let t = $('.bs-toast'); if (!t) { t = el('div', 'bs-toast'); t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
  };

  /* ---------- Backgrounds ---------- */
  const bg = el('div', 'bs-bg', '<div class="bs-bg-layer"></div><div class="bs-bg-layer"></div>');
  bg.setAttribute('aria-hidden', 'true');
  let active = 1, bgTimer = null, current = 0;
  function showBg(i, tries = 0) {
    const n = BACKGROUNDS.length;
    current = ((i % n) + n) % n;
    if (bad.has(current) && tries < n) return showBg(current + 1, tries + 1);
    st.bgIndex = current; save();
    const item = BACKGROUNDS[current], layers = bg.children, next = layers[1 - active], prev = layers[active];
    const img = new Image();
    img.onload = () => {
      next.style.backgroundImage = `url("${item.src}")`;
      next.classList.add('on'); prev.classList.remove('on'); active = 1 - active;
      const label = $('[data-bs-bgtitle]'); if (label) label.textContent = item.title || '';
      const cr = $('[data-bs-credit]');
      if (cr) cr.innerHTML = item.credit ? `تصوير: ${/^https:\/\//.test(item.creditUrl || '') ? `<a href="${esc(item.creditUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.credit)}</a>` : esc(item.credit)}${item.license ? ` · ${esc(item.license)}` : ''}` : '';
    };
    img.onerror = () => { bad.add(current); if (tries < n) showBg(current + 1, tries + 1); };
    img.src = item.src;
  }
  function restartBgTimer() {
    clearInterval(bgTimer); bgTimer = null;
    if (st.bgShow && st.bgAuto && !matchMedia('(prefers-reduced-motion: reduce)').matches) bgTimer = setInterval(() => { if (!document.hidden) showBg(current + 1); }, Math.max(8, st.bgInterval) * 1000);
  }
  function applyBgVisibility() { root.classList.toggle('bs-nobg', !st.bgShow); }

  /* ---------- Radio ---------- */
  const audio = new Audio(); audio.preload = 'none'; audio.src = STREAM;
  audio.volume = Math.min(1, Math.max(0, Number(st.volume) || 0.8));
  let popupOpen = false, retries = 0;
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('bardy-radio') : null;
  const radio = el('div', 'bs-radio', `<button class="bs-radio-btn" type="button" data-r-toggle aria-label="تشغيل إذاعة القرآن الكريم" title="اضغط للتشغيل أو الإيقاف · اضغط مطولًا لفتح صفحة الإذاعة"><span class="bs-radio-ico" data-r-ico>▶</span><span data-r-label>إذاعة القرآن</span></button>`);
  const playing = () => !audio.paused && !audio.ended;
  function setStatus(t) { document.querySelectorAll('[data-r-status]').forEach(n => n.textContent = t); }
  function syncRadio() {
    const on = playing();
    radio.classList.toggle('is-playing', on || (popupOpen && st.playing));
    $('[data-r-ico]', radio).textContent = on ? 'Ⅱ' : '▶';
    $('[data-r-label]', radio).textContent = on ? 'إيقاف الإذاعة' : 'إذاعة القرآن';
    $('[data-r-toggle]', radio).setAttribute('aria-label', on ? 'إيقاف إذاعة القرآن الكريم' : 'تشغيل إذاعة القرآن الكريم');
    document.querySelectorAll('[data-r-sidetoggle]').forEach(b => b.textContent = on ? 'إيقاف الإذاعة' : 'تشغيل الإذاعة');
    if (on) setStatus('يعمل الآن — يستمر مع التنقل بين الصفحات'); else if (!popupOpen) setStatus('متوقف — اضغط للتشغيل');
  }
  async function play() {
    if (popupOpen) { chan?.postMessage({ t: 'cmd', play: true }); return; }
    st.playing = true; save();
    try { await audio.play(); retries = 0; } catch (e) { setStatus('تعذر تشغيل البث — اضغط مرة أخرى'); }
    syncRadio(); mediaSession();
  }
  function pause() { if (popupOpen) { chan?.postMessage({ t: 'cmd', play: false }); return; } st.playing = false; save(); audio.pause(); syncRadio(); }
  const toggle = () => (playing() ? pause() : play());
  function setVolume(v) { st.volume = v; save(); audio.volume = v; chan?.postMessage({ t: 'cmd', volume: v }); document.querySelectorAll('[data-r-vol]').forEach(i => { if (Number(i.value) !== v) i.value = v; }); }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'إذاعة القرآن الكريم', artist: 'بردي' }); navigator.mediaSession.setActionHandler('play', play); navigator.mediaSession.setActionHandler('pause', pause); } catch {}
  }
  audio.addEventListener('play', syncRadio); audio.addEventListener('pause', syncRadio);
  audio.addEventListener('error', () => {
    if (st.playing && retries < 3) { retries++; setStatus('إعادة الاتصال بالبث…'); setTimeout(() => { audio.src = STREAM; play(); }, 2500); }
    else { setStatus('تعذر الوصول إلى البث حاليًا'); syncRadio(); }
  });
  function resumeIfNeeded() {
    if (!st.playing || popupOpen) return;
    audio.play().then(syncRadio).catch(() => {
      setStatus('اضغط في أي مكان لاستكمال الإذاعة');
      const go = () => { ['pointerdown', 'keydown', 'touchstart'].forEach(ev => removeEventListener(ev, go, true)); if (st.playing && !popupOpen) play(); };
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, go, true));
      toast('اضغط في أي مكان لاستكمال الإذاعة');
    });
  }
  function openPopout() {
    const w = open('/radio.html', 'bardy-radio', 'width=340,height=260,menubar=no,toolbar=no,location=no');
    if (!w) { toast('المتصفح منع النافذة المنفصلة — اسمح بالنوافذ المنبثقة'); return; }
    if (playing()) { audio.pause(); }
    popupOpen = true; syncRadio(); setStatus('جارٍ التشغيل في النافذة المنفصلة…');
  }
  chan && (chan.onmessage = ({ data }) => {
    if (!data || data.t !== 'state') return;
    popupOpen = !!data.open;
    if (popupOpen && playing()) audio.pause();
    st.playing = popupOpen && !!data.playing; save();
    syncRadio();
    if (popupOpen) setStatus(data.playing ? 'تعمل في النافذة المنفصلة' : 'النافذة المنفصلة متوقفة');
  });
  chan?.postMessage({ t: 'ping' });

  /* ---------- Sidebar ---------- */
  const tab = el('button', 'bs-tab', '<b aria-hidden="true">☰</b><span>الأقسام والإعدادات</span>'); tab.type = 'button'; tab.setAttribute('aria-label', 'فتح قائمة بردي'); tab.setAttribute('aria-haspopup', 'dialog');
  const backdrop = el('div', 'bs-backdrop');
  const side = el('aside', 'bs-side'); side.setAttribute('aria-hidden', 'true'); side.setAttribute('aria-label', 'قائمة بردي');
  const nav = PAGES.map(([href, label, ico]) => `<a href="${href}" ${norm(href) === here ? 'aria-current="page"' : ''}><i aria-hidden="true">${ico}</i>${esc(label)}</a>`).join('');
  const info = INFO.map(([href, label]) => `<a href="${href}" ${norm(href) === here ? 'aria-current="page"' : ''}><i aria-hidden="true">•</i>${esc(label)}</a>`).join('');
  side.innerHTML = `<div class="bs-side-head"><img src="/assets/bardy-logo.webp" alt="بردي"><button class="bs-close" type="button" data-bs-close aria-label="إغلاق القائمة">×</button></div><div class="bs-side-body">
    <div class="bs-date" data-bs-date></div>
    <div class="bs-h">الأقسام الرئيسية</div><nav class="bs-nav" aria-label="الأقسام الرئيسية">${nav}</nav>
    <div class="bs-h">إذاعة القرآن الكريم</div><div class="bs-card">
      <label class="bs-row">إظهار زر الإذاعة<span class="bs-switch"><input type="checkbox" data-bs="radioShow"><span></span></span></label>
      <div class="bs-btns"><button class="bs-btn primary" type="button" data-r-sidetoggle>تشغيل الإذاعة</button><button class="bs-btn" type="button" data-r-popout>نافذة منفصلة</button></div>
      <input type="range" min="0" max="1" step="0.05" data-r-vol aria-label="مستوى صوت الإذاعة"><p class="bs-note" data-r-status>متوقف — اضغط للتشغيل</p><a class="bs-link" href="/radio">صفحة الإذاعة والمشاركة</a><p class="bs-note">زر الإذاعة العائم: اضغط للتشغيل/الإيقاف، اضغط مطولًا لفتح صفحتها، واسحبه لتحريكه.</p></div>
    <div class="bs-h">الخلفيات المصرية</div><div class="bs-card">
      <label class="bs-row">عرض الخلفيات<span class="bs-switch"><input type="checkbox" data-bs="bgShow"><span></span></span></label>
      <label class="bs-row">تغيير تلقائي<span class="bs-switch"><input type="checkbox" data-bs="bgAuto"><span></span></span></label>
      <label class="bs-row">كل<select data-bs="bgInterval" aria-label="مدة تغيير الخلفية"><option value="15">15 ثانية</option><option value="30">30 ثانية</option><option value="60">دقيقة</option><option value="180">3 دقائق</option></select></label>
      <p class="bs-bg-title" data-bs-bgtitle></p><p class="bs-bg-credit" data-bs-credit></p>
      <div class="bs-btns"><button class="bs-btn" type="button" data-bs-prev>السابقة</button><button class="bs-btn" type="button" data-bs-next>التالية</button></div></div>
    <div class="bs-h">أدوات</div><div class="bs-card"><div class="bs-btns"><button class="bs-btn" type="button" data-bs-clear>مسح سجل البحث</button></div><p class="bs-note">اختصار: اضغط <kbd>/</kbd> للانتقال إلى مربع البحث.</p></div>
    <div class="bs-h">معلومات الموقع</div><nav class="bs-nav" aria-label="معلومات الموقع">${info}</nav></div>`;

  let lastFocus = null;
  function openSide() {
    lastFocus = document.activeElement; side.classList.add('open'); backdrop.classList.add('open'); side.setAttribute('aria-hidden', 'false');
    const d = $('[data-bs-date]', side), now = new Date();
    try { d.innerHTML = `<strong>${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}</strong>${new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)}`; } catch { d.hidden = true; }
    $('[data-bs-close]', side).focus();
  }
  function closeSide() { side.classList.remove('open'); backdrop.classList.remove('open'); side.setAttribute('aria-hidden', 'true'); lastFocus?.focus?.(); }
  tab.addEventListener('click', openSide); backdrop.addEventListener('click', closeSide);
  side.addEventListener('click', e => {
    if (e.target.closest('[data-bs-close]')) return closeSide();
    if (e.target.closest('[data-bs-prev]')) { showBg(current - 1); return restartBgTimer(); }
    if (e.target.closest('[data-bs-next]')) { showBg(current + 1); return restartBgTimer(); }
    if (e.target.closest('[data-r-sidetoggle]')) return toggle();
    if (e.target.closest('[data-bs-clear]')) { try { ['bardy:search-history:v1', 'bardy:search-counts:v1'].forEach(k => localStorage.removeItem(k)); } catch {} toast('تم مسح سجل البحث'); }
  });
  side.addEventListener('change', e => {
    const k = e.target.dataset.bs; if (!k) return;
    st[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value); save();
    if (k === 'radioShow') radio.hidden = !st.radioShow;
    if (k === 'bgShow') { applyBgVisibility(); restartBgTimer(); }
    if (k === 'bgAuto' || k === 'bgInterval') restartBgTimer();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && side.classList.contains('open')) closeSide();
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
      const box = $('.search-wrap input') || $('input[type=search]') || $('input[name=q]');
      if (box) { e.preventDefault(); box.focus(); box.select?.(); }
    }
  });
  // Existing page hamburgers open the new sidebar instead of the old drawer.
  document.addEventListener('click', e => { if (e.target.closest('[data-menu-open]')) { e.stopImmediatePropagation(); e.preventDefault(); openSide(); } }, true);

  /* draggable floating button (mouse, touch, or Alt+arrows); position is remembered */
  const POS_KEY = 'bardy:radio-pos:v1';
  let dragMoved = false, longFired = false;
  const clampPos = (x, y) => [Math.min(Math.max(6, x), Math.max(6, innerWidth - radio.offsetWidth - 6)), Math.min(Math.max(6, y), Math.max(6, innerHeight - radio.offsetHeight - 6))];
  function placeRadio(x, y, persist) {
    [x, y] = clampPos(x, y); radio.style.left = x + 'px'; radio.style.top = y + 'px'; radio.style.bottom = 'auto';
    if (persist) { try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch {} }
  }
  function loadRadioPos() { try { const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) placeRadio(p.x, p.y, false); } catch {} }
  (() => {
    const handle = $('[data-r-toggle]', radio); let sx = 0, sy = 0, ox = 0, oy = 0, down = false, holdTimer = 0;
    const LONG_MS = 650;
    const stopHold = () => { clearTimeout(holdTimer); handle.classList.remove('pressing'); };
    handle.addEventListener('contextmenu', e => e.preventDefault());
    handle.addEventListener('pointerdown', e => {
      if (e.button > 0) return; down = true; dragMoved = false; longFired = false; sx = e.clientX; sy = e.clientY;
      const r = radio.getBoundingClientRect(); ox = r.left; oy = r.top; handle.setPointerCapture?.(e.pointerId);
      handle.classList.add('pressing');
      holdTimer = setTimeout(() => { if (down && !dragMoved) { longFired = true; down = false; stopHold(); navigator.vibrate?.(25); location.href = '/radio'; } }, LONG_MS);
    });
    handle.addEventListener('pointermove', e => {
      if (!down) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragMoved && Math.hypot(dx, dy) < 6) return;
      dragMoved = true; stopHold(); placeRadio(ox + dx, oy + dy, false);
    });
    const end = () => { stopHold(); if (!down) return; down = false; if (dragMoved) { const r = radio.getBoundingClientRect(); placeRadio(r.left, r.top, true); setTimeout(() => { dragMoved = false; }, 0); } };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', e => {
      if (!e.altKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return; e.preventDefault();
      const r = radio.getBoundingClientRect(), step = 24;
      placeRadio(r.left + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), r.top + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0), true);
    });
    addEventListener('resize', () => { const r = radio.getBoundingClientRect(); if (radio.style.left) placeRadio(r.left, r.top, false); });
  })();

  radio.addEventListener('click', e => {
    if (dragMoved || longFired) { e.preventDefault(); longFired = false; return; }
    if (e.target.closest('[data-r-toggle]')) toggle();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-r-popout]')) openPopout(); });
  document.addEventListener('input', e => { if (e.target.matches('[data-r-vol]')) setVolume(Number(e.target.value)); });

  function init() {
    root.classList.toggle('bs-has-burger', !!$('.mobile-menu-button'));
    document.body.prepend(bg);
    document.body.append(backdrop, side, tab, radio);
    side.querySelectorAll('[data-bs]').forEach(i => { const v = st[i.dataset.bs]; if (i.type === 'checkbox') i.checked = !!v; else i.value = String(v); });
    document.querySelectorAll('[data-r-vol]').forEach(i => i.value = audio.volume);
    radio.hidden = !st.radioShow;
    loadRadioPos();
    applyBgVisibility();
    loadBackgrounds().then(() => {
      const start = st.bgIndex < 0 ? Math.floor(Math.random() * BACKGROUNDS.length) : st.bgIndex + 1;
      showBg(start); restartBgTimer();
    });
    syncRadio(); mediaSession(); resumeIfNeeded();
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
