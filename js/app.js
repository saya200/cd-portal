/* ══════════════════════════════════════════════════════════════════════════════════
   بوابة شعبة التحقيق – الدفاع المدني حائل
   app.js  |  Vanilla JS  |  Data-driven via data/content.json
   Design: Claude Design system (green theme, full-screen viewer)
   ══════════════════════════════════════════════════════════════════════════════════ */

'use strict';

// ───────────────────────────────────────────────────────
// الحالة العامة
// ───────────────────────────────────────────────────────
const state = {
  sections: [],
  index:    [],
  bookmarks: new Set(),

  viewer: {
    open:  false,
    items: [],
    idx:   0,
  },
};

const pdf = {
  doc:      null,
  page:     1,        // الصفحة الحالية (تتحدث مع التمرير)
  total:    0,
  zoom:     1,        // 1 = ملاءمة العرض
  fitW:     0,
  sizes:    [],       // أبعاد كل صفحة (pt)
  pages:    [],       // عناصر الصفحات في DOM
  rendered: new Map(),// رقم الصفحة → { canvas, key }
  near:     new Set(),
  io:       null,
  token:    0,        // يُبطل العمليات القديمة عند تغيير الملف
  pumping:  false,
  task:     null,
};

const BM_KEY = 'cd-portal-bm';
const VIEW_KEY = 'cd-portal-view';

// عرض الأقسام: شبكة (ثمبنيل) أو قائمة (نصي)
state.viewMode = 'grid';
state.currentSection = null;

// كاش الثمبنيل في الذاكرة (path → dataURL) + مرآة لـ IndexedDB
state.thumbs = new Map();

// ── طابور توليد الثمبنيل (حدّ تزامن) ──
const THUMB_CONCURRENCY = 2;
const THUMB_WIDTH = 480;            // عرض الرسم بالبكسل: بطاقة ~180-200px × كثافة 2 ≈ 400
const thumbQueue = [];
let thumbActive = 0;
let thumbObserver = null;

// ── IndexedDB لحفظ الثمبنيل بين الزيارات ──
const IDB_NAME = 'cd-portal-thumbs';
const IDB_STORE = 'thumbs';
let idbPromise = null;

function idbOpen() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        else req.transaction.objectStore(IDB_STORE).clear(); // v2: إبطال الثمبنيلات القديمة منخفضة الدقة
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return idbPromise;
}
async function idbGet(key) {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbPut(key, val) {
  const db = await idbOpen();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
  } catch {}
}

// ───────────────────────────────────────────────────────
// مراجع DOM
// ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const homeView       = $('homeView');
const sectionsGrid   = $('sectionsGrid');
const extrasArea     = $('extrasArea');
const searchResults  = $('searchResults');
const sectionScreen  = $('sectionScreen');
const bookmarksScreen= $('bookmarksScreen');
const pdfViewer      = $('pdfViewer');

// ───────────────────────────────────────────────────────
// أيقونات (SVG)
// ───────────────────────────────────────────────────────
const ICONS = {
  guides: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  circulars: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  forms: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
             <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  'fire-behavior': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  ext: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  bookmark: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
};
const ICON_BIG_BM = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
             <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const CHEV_R = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const CHEV_D = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const ICON_CLOSE = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_GRID = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
const ICON_LIST = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
const ICON_FILE_THUMB = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

// ───────────────────────────────────────────────────────
// أدوات
// ───────────────────────────────────────────────────────
const arNum = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function encodePath(path) {
  return path.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

function getCount(section) {
  if (section.isExternalLink) return 0;
  if (section.hasSubcategories) {
    return (section.subcategories || []).reduce((n, s) => n + (s.items?.length || 0), 0);
  }
  return section.items?.length || 0;
}
function countLabel(section) {
  const n = getCount(section);
  if (n === 0) return 'لا توجد ملفات بعد';
  if (n === 1) return 'ملف واحد';
  if (n === 2) return 'ملفان';
  if (n <= 10) return `${arNum(n)} ملفات`;
  return `${arNum(n)} ملفاً`;
}

// ───────────────────────────────────────────────────────
// التهيئة
// ───────────────────────────────────────────────────────
async function init() {
  initPDFJS();
  loadBookmarks();
  loadViewMode();
  setupSearch();
  setupViewerEvents();
  setupKeyboard();

  try {
    const res = await fetch('data/content.json');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.sections = data.sections || [];
    buildIndex();
    renderHome();
  } catch {
    sectionsGrid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <p class="empty-title">تعذّر تحميل البيانات</p>
        <p class="empty-sub">يرجى تحديث الصفحة.</p>
      </div>`;
  }
}

function initPDFJS() {
  if (typeof pdfjsLib === 'undefined') return;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function buildIndex() {
  const idx = [];
  state.sections.forEach(sec => {
    if (sec.isExternalLink) return;
    if (sec.hasSubcategories) {
      (sec.subcategories || []).forEach(cat => {
        (cat.items || []).forEach(item => {
          idx.push({ ...item, sectionTitle: sec.title, catTitle: cat.title, siblings: cat.items });
        });
      });
    } else {
      (sec.items || []).forEach(item => {
        idx.push({ ...item, sectionTitle: sec.title, catTitle: null, siblings: sec.items });
      });
    }
  });
  state.index = idx;
}

// ───────────────────────────────────────────────────────
// المحفوظات
// ───────────────────────────────────────────────────────
function loadBookmarks() {
  try { state.bookmarks = new Set(JSON.parse(localStorage.getItem(BM_KEY) || '[]')); }
  catch { state.bookmarks = new Set(); }
}
function saveBookmarks() {
  try { localStorage.setItem(BM_KEY, JSON.stringify([...state.bookmarks])); } catch {}
}
function isBookmarked(item) { return item && item.path && state.bookmarks.has(item.path); }
function toggleBookmark(item) {
  if (!item || !item.path) return;
  if (state.bookmarks.has(item.path)) state.bookmarks.delete(item.path);
  else state.bookmarks.add(item.path);
  saveBookmarks();
}

// ───────────────────────────────────────────────────────
// الصفحة الرئيسية
// ───────────────────────────────────────────────────────
function renderHome() {
  sectionsGrid.innerHTML = '';
  state.sections.filter(s => !s.isExternalLink).forEach(sec => {
    sectionsGrid.appendChild(buildSectionCard(sec));
  });

  extrasArea.innerHTML = '';
  const ext = state.sections.find(s => s.isExternalLink);
  if (ext) extrasArea.appendChild(buildExternalCard(ext));
  extrasArea.appendChild(buildBookmarksCard());
}

function buildSectionCard(sec) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.setAttribute('role', 'listitem');
  card.innerHTML = `
    <div class="card-row">
      <div class="card-info">
        <div class="card-title">${escapeHtml(sec.title)}</div>
        <div class="card-count">${countLabel(sec)}</div>
      </div>
      <div class="card-icon">${ICONS[sec.id] || ICONS.forms}</div>
    </div>`;
  card.addEventListener('click', () => openSection(sec));
  return card;
}

function buildExternalCard(sec) {
  const hasURL = !!sec.url;
  const el = document.createElement(hasURL ? 'a' : 'div');
  el.className = 'extra-card' + (hasURL ? '' : ' disabled');
  if (hasURL) { el.href = sec.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  el.innerHTML = `
    <div class="extra-inner">
      <div class="extra-icon">${ICONS.ext}</div>
      <div class="extra-text">
        <div class="extra-title">${escapeHtml(sec.title)}</div>
        <div class="extra-sub">${hasURL ? 'الانتقال إلى المنصة الإلكترونية' : 'الرابط سيُضاف قريباً'}</div>
      </div>
      <span class="extra-chev">${CHEV_R}</span>
    </div>`;
  return el;
}

function buildBookmarksCard() {
  const n = state.bookmarks.size;
  const el = document.createElement('div');
  el.className = 'extra-card';
  el.innerHTML = `
    <div class="extra-inner">
      <div class="extra-icon">${ICONS.bookmark}</div>
      <div class="extra-text">
        <div class="extra-title">المحفوظات</div>
        <div class="extra-sub">${n === 0 ? 'لا توجد ملفات محفوظة' : `${arNum(n)} ملف محفوظ`}</div>
      </div>
      ${n > 0 ? `<span class="extra-badge">${arNum(n)}</span>` : `<span class="extra-chev">${CHEV_R}</span>`}
    </div>`;
  el.addEventListener('click', openBookmarks);
  return el;
}

// ───────────────────────────────────────────────────────
// البحث
// ───────────────────────────────────────────────────────
function setupSearch() {
  const input = $('searchInput');
  const clear = $('searchClear');
  const box   = $('searchBox');
  if (!input) return;

  input.addEventListener('focus', () => box.classList.add('focused'));
  input.addEventListener('blur',  () => box.classList.remove('focused'));

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clear.style.display = q ? 'flex' : 'none';
    if (!q) {
      searchResults.style.display = 'none';
      sectionsGrid.style.display = 'grid';
      extrasArea.style.display = 'block';
      return;
    }
    sectionsGrid.style.display = 'none';
    extrasArea.style.display = 'none';
    searchResults.style.display = 'flex';
    renderSearch(q);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    searchResults.style.display = 'none';
    sectionsGrid.style.display = 'grid';
    extrasArea.style.display = 'block';
    input.focus();
  });
}

function renderSearch(query) {
  const q = query.toLowerCase();
  const hits = state.index.filter(it =>
    it.title.toLowerCase().includes(q) ||
    (it.sectionTitle || '').toLowerCase().includes(q) ||
    (it.catTitle || '').toLowerCase().includes(q)
  ).slice(0, 25);

  if (!hits.length) {
    searchResults.innerHTML = `<p class="search-no-results">لا توجد نتائج لـ «${escapeHtml(query)}»</p>`;
    return;
  }

  searchResults.innerHTML =
    `<div class="search-results-count">${arNum(hits.length)} نتيجة</div>` +
    hits.map((h, i) => `
      <div class="search-result-item" data-path="${escapeAttr(h.path)}" style="animation:fadeSlideUp .24s ease ${i * 22}ms both">
        <span class="pdf-badge">PDF</span>
        <div style="flex:1;min-width:0">
          <div class="search-result-title">${escapeHtml(h.title)}</div>
          <div class="search-result-path">${escapeHtml(h.sectionTitle)}${h.catTitle ? ' · ' + escapeHtml(h.catTitle) : ''}</div>
        </div>
        <span class="chev-muted">${CHEV_R}</span>
      </div>`).join('');

  searchResults.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const hit = state.index.find(it => it.path === el.dataset.path);
      if (hit) openViewer(hit.siblings, hit.siblings.findIndex(s => s.path === hit.path));
    });
  });
}

// ───────────────────────────────────────────────────────
// شاشة القسم (Full screen)
// ───────────────────────────────────────────────────────
function openSection(sec) {
  if (sec.isExternalLink) return;
  state.currentSection = sec;
  sectionScreen.innerHTML = sectionShellHTML(sec, getCount(sec), true) +
    `<div class="ss-body" id="ssBody"></div>`;
  renderSectionBody(sec);
  bindSectionClose(sectionScreen);
  bindViewToggle(sectionScreen);
  showScreen(sectionScreen);
}

function sectionShellHTML(sec, count, withToggle) {
  return `
    <div class="ss-header">
      <button class="ss-close" aria-label="رجوع">${ICON_CLOSE}</button>
      <div class="ss-icon">${ICONS[sec.id] || ICONS.forms}</div>
      <span class="ss-title">${escapeHtml(sec.title)}</span>
      ${withToggle ? viewToggleHTML() : `<span class="ss-count">${arNum(count)} ملف</span>`}
    </div>`;
}

function viewToggleHTML() {
  return `
    <div class="view-toggle" id="viewToggle" role="group" aria-label="طريقة العرض">
      <button class="vt-btn ${state.viewMode === 'grid' ? 'active' : ''}" data-mode="grid" aria-label="عرض شبكة">${ICON_GRID}</button>
      <button class="vt-btn ${state.viewMode === 'list' ? 'active' : ''}" data-mode="list" aria-label="عرض قائمة">${ICON_LIST}</button>
    </div>`;
}

function bindViewToggle(screen) {
  const tg = screen.querySelector('#viewToggle');
  if (!tg) return;
  tg.querySelectorAll('.vt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === state.viewMode) return;
      state.viewMode = mode;
      saveViewMode();
      tg.querySelectorAll('.vt-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      renderSectionBody(state.currentSection, captureOpenAccordions());
    });
  });
}

function captureOpenAccordions() {
  const set = new Set();
  sectionScreen.querySelectorAll('.accordion').forEach((a, i) => { if (a.classList.contains('open')) set.add(i); });
  return set;
}

// يبني جسم القسم حسب نمط العرض الحالي
function renderSectionBody(sec, openIdx) {
  const body = sectionScreen.querySelector('#ssBody');
  if (!body) return;

  if (sec.hasSubcategories) {
    const cats = sec.subcategories || [];
    if (!cats.length) { body.innerHTML = emptyHTML('لا توجد فئات بعد'); return; }
    body.innerHTML = `<div class="accordion-list" id="ssAccordion"></div>`;
    renderAccordions(sec, openIdx);
  } else {
    const items = sec.items || [];
    if (!items.length) { body.innerHTML = emptyHTML('لا توجد ملفات في هذا القسم بعد'); return; }
    body.innerHTML = '';
    const inner = document.createElement('div');
    body.appendChild(inner);
    renderItems(inner, items);
  }
}

function renderAccordions(sec, openIdx) {
  const wrap = $('ssAccordion');
  const cats = sec.subcategories || [];
  const openSet = openIdx && openIdx.size ? openIdx : new Set([0]);

  wrap.innerHTML = cats.map((cat, i) => `
    <div class="accordion ${openSet.has(i) ? 'open' : ''}" style="animation-delay:${i * 50}ms">
      <button class="accordion-head">
        <span class="accordion-title">${escapeHtml(cat.title)}</span>
        <span class="accordion-right">
          <span class="accordion-count">${arNum(cat.items?.length || 0)}</span>
          <span class="accordion-chev">${CHEV_D}</span>
        </span>
      </button>
      <div class="accordion-body"></div>
    </div>`).join('');

  wrap.querySelectorAll('.accordion').forEach((acc, ci) => {
    const cat = cats[ci];
    const bodyEl = acc.querySelector('.accordion-body');
    if ((cat.items || []).length) {
      const inner = document.createElement('div');
      bodyEl.appendChild(inner);
      renderItems(inner, cat.items);
    } else {
      bodyEl.innerHTML = emptyHTML('لا توجد ملفات');
    }
    acc.querySelector('.accordion-head').addEventListener('click', () => acc.classList.toggle('open'));
  });
}

// يرسم قائمة ملفات في عنصر حاوٍ حسب نمط العرض (شبكة/قائمة)
function renderItems(container, items) {
  if (state.viewMode === 'grid') {
    container.className = 'files-grid';
    container.innerHTML = items.map((it, i) => itemCardHTML(it, i)).join('');
    container.querySelectorAll('.file-card').forEach((el, i) => {
      el.addEventListener('click', () => openViewer(items, i));
      observeThumb(el);
    });
  } else {
    container.className = 'ss-list';
    container.innerHTML = items.map((it, i) => itemRowHTML(it, i)).join('');
    container.querySelectorAll('.item-row').forEach((el, i) => {
      el.addEventListener('click', () => openViewer(items, i));
    });
  }
}

function itemCardHTML(item, idx) {
  const isImg = item.type === 'image';
  return `
    <div class="file-card" data-path="${escapeAttr(item.path)}" style="animation-delay:${Math.min(idx, 8) * 38}ms">
      <div class="file-thumb"><span class="thumb-fallback">${ICON_FILE_THUMB}</span></div>
      <div class="file-card-foot">
        <span class="pdf-badge">${isImg ? 'صورة' : 'PDF'}</span>
        <span class="file-card-title">${escapeHtml(item.title)}</span>
      </div>
    </div>`;
}

// ───────────────────────────────────────────────────────
// محرّك الثمبنيل (كسول + طابور + IndexedDB)
// ───────────────────────────────────────────────────────
function observeThumb(cardEl) {
  if (!thumbObserver) {
    thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          thumbObserver.unobserve(e.target);
          fillThumb(e.target);
        }
      });
    }, { rootMargin: '150px' });
  }
  thumbObserver.observe(cardEl);
}

async function fillThumb(cardEl) {
  const path = cardEl.dataset.path;
  const item = state.index.find(it => it.path === path);
  const thumbBox = cardEl.querySelector('.file-thumb');
  if (!item || !thumbBox) return;

  if (item.type === 'image') { setThumbImg(thumbBox, encodePath(item.path)); return; }

  if (state.thumbs.has(path)) { setThumbImg(thumbBox, state.thumbs.get(path)); return; }

  const cached = await idbGet(path);
  if (cached) { state.thumbs.set(path, cached); setThumbImg(thumbBox, cached); return; }

  thumbBox.classList.add('loading');
  enqueueThumb(async () => {
    const url = await genThumb(item);
    thumbBox.classList.remove('loading');
    if (url) {
      state.thumbs.set(path, url);
      idbPut(path, url);
      setThumbImg(thumbBox, url);
    }
  });
}

function setThumbImg(thumbBox, src) {
  const img = new Image();
  img.className = 'thumb-img';
  img.alt = '';
  img.onload = () => {
    // صفحة أفقية: تُعرض كاملة (contain) بدل قصّها من الأعلى
    if (img.naturalWidth > img.naturalHeight * 1.05) img.classList.add('landscape');
    const old = thumbBox.querySelector('.thumb-img');
    if (old) old.remove();
    thumbBox.appendChild(img);
    thumbBox.classList.add('has-img');
  };
  img.src = src;
}

function enqueueThumb(task) { thumbQueue.push(task); pumpThumb(); }
function pumpThumb() {
  while (thumbActive < THUMB_CONCURRENCY && thumbQueue.length) {
    const task = thumbQueue.shift();
    thumbActive++;
    Promise.resolve().then(task).catch(() => {}).finally(() => { thumbActive--; pumpThumb(); });
  }
}

async function genThumb(item) {
  let doc = null;
  try {
    doc = await pdfjsLib.getDocument({ url: encodePath(item.path), disableAutoFetch: true, disableStream: false }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  } finally {
    if (doc) { try { doc.destroy(); } catch {} }
  }
}

function loadViewMode() {
  try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grid' || v === 'list') state.viewMode = v; } catch {}
}
function saveViewMode() { try { localStorage.setItem(VIEW_KEY, state.viewMode); } catch {} }

function itemRowHTML(item, idx) {
  return `
    <div class="item-row" data-idx="${idx}" style="animation-delay:${Math.min(idx, 8) * 38}ms">
      <span class="pdf-badge">${item.type === 'image' ? 'صورة' : 'PDF'}</span>
      <span class="item-title">${escapeHtml(item.title)}</span>
      <span class="chev-muted">${CHEV_R}</span>
    </div>`;
}

function bindItemRows(root, items) {
  root.querySelectorAll('.item-row').forEach((row, i) => {
    row.addEventListener('click', () => openViewer(items, i));
  });
}

function bindSectionClose(screen) {
  const btn = screen.querySelector('.ss-close');
  if (btn) btn.addEventListener('click', () => hideScreen(screen));
}

function emptyHTML(msg, sub) {
  return `
    <div class="empty-state">
      ${ICON_BIG_BM}
      <p class="empty-title">${escapeHtml(msg)}</p>
      ${sub ? `<p class="empty-sub">${escapeHtml(sub)}</p>` : ''}
    </div>`;
}

// ───────────────────────────────────────────────────────
// شاشة المحفوظات
// ───────────────────────────────────────────────────────
function openBookmarks() {
  const items = state.index.filter(it => state.bookmarks.has(it.path));
  bookmarksScreen.innerHTML = `
    <div class="ss-header">
      <button class="ss-close" aria-label="رجوع">${ICON_CLOSE}</button>
      <div class="ss-icon">${ICONS.bookmark}</div>
      <span class="ss-title">المحفوظات</span>
      ${items.length ? `<span class="ss-count">${arNum(items.length)} ملف</span>` : ''}
    </div>
    <div class="ss-body">${
      items.length
        ? `<div class="ss-list">${items.map((it, i) => itemRowHTML(it, i)).join('')}</div>`
        : emptyHTML('لا توجد ملفات محفوظة', 'افتح أي ملف واضغط أيقونة الحفظ لإضافته هنا')
    }</div>`;

  bindItemRows(bookmarksScreen, items);
  bindSectionClose(bookmarksScreen);
  showScreen(bookmarksScreen);
}

// ───────────────────────────────────────────────────────
// إظهار / إخفاء الشاشات
// ───────────────────────────────────────────────────────
function showScreen(el) {
  el.style.display = 'flex';
  document.body.classList.add('no-scroll');
}
function hideScreen(el) {
  el.style.display = 'none';
  if (!state.viewer.open && sectionScreen.style.display === 'none' && bookmarksScreen.style.display === 'none') {
    document.body.classList.remove('no-scroll');
  }
  refreshBookmarksCard();
}

function refreshBookmarksCard() {
  const old = extrasArea.querySelector('.extra-card:last-child');
  if (old) old.replaceWith(buildBookmarksCard());
}

// ───────────────────────────────────────────────────────
// عارض PDF
// ───────────────────────────────────────────────────────
function openViewer(items, idx) {
  state.viewer = { open: true, items: items.slice(), idx: Math.max(0, Math.min(idx, items.length - 1)) };
  pdfViewer.style.display = 'flex';
  document.body.classList.add('no-scroll');
  renderViewer();
}

function closeViewer() {
  pdfViewer.style.display = 'none';
  state.viewer.open = false;
  destroyPDF();
  if (sectionScreen.style.display === 'none' && bookmarksScreen.style.display === 'none') {
    document.body.classList.remove('no-scroll');
  }
  refreshBookmarksCard();
  if (bookmarksScreen.style.display === 'flex') openBookmarks();
}

function currentItem() { return state.viewer.items[state.viewer.idx]; }

function renderViewer() {
  const item = currentItem();
  if (!item) return;

  $('pvTitle').textContent = item.title;
  updateBookmarkBtn();

  const { items, idx } = state.viewer;
  const multi = items.length > 1;
  $('pvDocNav').style.display = multi ? 'flex' : 'none';
  if (multi) {
    const prev = $('pvPrevDoc'), next = $('pvNextDoc');
    prev.disabled = idx <= 0;
    next.disabled = idx >= items.length - 1;
    $('pvPrevDocTitle').textContent = idx > 0 ? items[idx - 1].title : '';
    $('pvNextDocTitle').textContent = idx < items.length - 1 ? items[idx + 1].title : '';
  }

  loadFile(item);
}

function updateBookmarkBtn() {
  const btn = $('pvBookmark');
  const icon = $('pvBookmarkIcon');
  const active = isBookmarked(currentItem());
  btn.classList.toggle('active', active);
  icon.setAttribute('fill', active ? 'currentColor' : 'none');
}

function loadFile(item) {
  showViewerPanel('loading');
  destroyPDF();

  const url = encodePath(item.path);
  $('pvDownload').href = url;
  $('pvDownload').setAttribute('download', item.path.split('/').pop());
  $('pvNoPrevDownload').href = url;

  if (!item.path) { showViewerPanel('noprev'); return; }

  if (item.type === 'image') {
    const img = $('pvImg');
    img.onload  = () => showViewerPanel('image');
    img.onerror = () => showViewerPanel('noprev');
    img.src = url;
  } else {
    loadPDF(url);
  }
}

// ── عارض PDF بتمرير عمودي متصل: كل الصفحات في عمود، وتُرسم القريبة من الشاشة فقط ──
const PV_PAD = 12;          // هامش العمود (px)
const PV_MIN_ZOOM = 0.25;   // 25% من عرض الشاشة (ملاءمة العرض = 100%)
const PV_MAX_ZOOM = 4;
const PV_NEAR_KEEP = 2;     // صفحات تبقى مرسومة خارج المنطقة القريبة قبل تحريرها

function pvSc() { return $('pvCanvasWrap'); }
function pvIsSmall() { return window.innerWidth < 768; }
function pvCssWidth() { return Math.round(pdf.fitW * pdf.zoom); }
function pvKey() { return `${pvCssWidth()}@${Math.min(window.devicePixelRatio || 1, 2)}`; }
function pvSize(n) { return pdf.sizes[n - 1] || pdf.sizes[0]; }

async function loadPDF(url) {
  const token = ++pdf.token;
  try {
    const doc = await pdfjsLib.getDocument(url).promise;
    if (token !== pdf.token) { try { doc.destroy(); } catch {} return; }
    pdf.doc = doc;
    pdf.total = doc.numPages;
    pdf.page = 1;
    pdf.zoom = 1;
    const first = await doc.getPage(1);
    if (token !== pdf.token) return;
    const v = first.getViewport({ scale: 1 });
    pdf.sizes = new Array(pdf.total).fill(null);
    pdf.sizes[0] = { w: v.width, h: v.height };
    try { first.cleanup(); } catch {}

    pvBuildPages();
    showViewerPanel('canvas');
    pvLayout();
    pvObserve();
    pvUpdateCounter();
    pvUpdateZoomUI();
    pvLoadSizes(token);
    pvSc().scrollTop = 0;
    try { pvSc().focus({ preventScroll: true }); } catch {}
  } catch {
    if (token === pdf.token) showViewerPanel('noprev');
  }
}

function pvBuildPages() {
  const host = $('pvPages');
  host.innerHTML = '';
  pdf.pages = [];
  const frag = document.createDocumentFragment();
  const s = pvSize(1);
  for (let n = 1; n <= pdf.total; n++) {
    const d = document.createElement('div');
    d.className = 'pv-page';
    d.style.aspectRatio = `${s.w} / ${s.h}`;
    frag.appendChild(d);
    pdf.pages.push(d);
  }
  host.appendChild(frag);
}

// عرض الصفحة = عرض الشاشة (بحدّ أقصى على الكمبيوتر) × التكبير
function pvLayout() {
  const sc = pvSc();
  const avail = sc.clientWidth - PV_PAD * 2;
  const maxW = window.innerWidth >= 1024 ? 920 : 900;
  pdf.fitW = Math.max(200, Math.min(avail, maxW));
  $('pvPages').style.setProperty('--pw', pvCssWidth() + 'px');
}

function pvSetSize(n, w, h) {
  pdf.sizes[n - 1] = { w, h };
  const el = pdf.pages[n - 1];
  if (!el) return;
  const sc = pvSc();
  const before = el.offsetHeight;
  el.style.aspectRatio = `${w} / ${h}`;
  const delta = el.offsetHeight - before;
  // صفحة فوق الشاشة تغيّر ارتفاعها: عوّض كي لا يقفز المحتوى
  if (delta && el.offsetTop + before <= sc.scrollTop) sc.scrollTop += delta;
}

// أحجام بقية الصفحات في الخلفية (للمستندات ذات الصفحات المختلفة)
async function pvLoadSizes(token) {
  const doc = pdf.doc;
  for (let n = 2; n <= pdf.total; n++) {
    if (token !== pdf.token) return;
    try {
      const page = await doc.getPage(n);
      const v = page.getViewport({ scale: 1 });
      const cur = pdf.sizes[0];
      if (Math.abs(v.width - cur.w) > 0.5 || Math.abs(v.height - cur.h) > 0.5) pvSetSize(n, v.width, v.height);
      else pdf.sizes[n - 1] = { w: cur.w, h: cur.h };
      page.cleanup();
    } catch {}
    if (n % 8 === 0) await new Promise(r => setTimeout(r, 0));
  }
}

function pvObserve() {
  if (pdf.io) pdf.io.disconnect();
  pdf.near.clear();
  pdf.io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const n = +e.target.dataset.n;
      if (e.isIntersecting) pdf.near.add(n); else pdf.near.delete(n);
    });
    pvEvict();
    pvPump();
  }, { root: pvSc(), rootMargin: '150% 0px' });
  pdf.pages.forEach((el, i) => { el.dataset.n = i + 1; pdf.io.observe(el); });
}

function pvFree(n) {
  const r = pdf.rendered.get(n);
  if (!r) return;
  r.canvas.width = r.canvas.height = 0;
  const el = pdf.pages[n - 1];
  if (el) el.replaceChildren();
  pdf.rendered.delete(n);
}

// حرّر الصفحات البعيدة عن الشاشة لتوفير الذاكرة
function pvEvict() {
  if (!pdf.near.size) return;
  const lo = Math.min(...pdf.near) - PV_NEAR_KEEP;
  const hi = Math.max(...pdf.near) + PV_NEAR_KEEP;
  for (const n of [...pdf.rendered.keys()]) if (n < lo || n > hi) pvFree(n);
}

function pvNext() {
  const sc = pvSc();
  const mid = sc.scrollTop + sc.clientHeight / 2;
  const key = pvKey();
  let best = 0, bestD = Infinity;
  for (const n of pdf.near) {
    const r = pdf.rendered.get(n);
    if (r && r.key === key) continue;
    const el = pdf.pages[n - 1];
    const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - mid);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function pvPump() {
  if (pdf.pumping || !pdf.doc) return;
  pdf.pumping = true;
  const token = pdf.token;
  (async () => {
    try {
      while (token === pdf.token && pdf.doc) {
        const n = pvNext();
        if (!n) break;
        await pvRender(n, token);
      }
    } catch {} finally { pdf.pumping = false; }
  })();
}

async function pvRender(n, token) {
  const key = pvKey();
  const page = await pdf.doc.getPage(n);
  if (token !== pdf.token || !pdf.near.has(n)) return;   // ابتعدت الصفحة أثناء الانتظار
  const s0 = page.getViewport({ scale: 1 });
  const known = pdf.sizes[n - 1];
  if (!known || Math.abs(known.w - s0.width) > 0.5 || Math.abs(known.h - s0.height) > 0.5) pvSetSize(n, s0.width, s0.height);

  let scale = (pvCssWidth() / s0.width) * Math.min(window.devicePixelRatio || 1, 2);
  const maxArea = pvIsSmall() ? 6e6 : 16e6;          // سقف الذاكرة لكل صفحة
  const area = s0.width * s0.height * scale * scale;
  if (area > maxArea) scale *= Math.sqrt(maxArea / area);
  scale = Math.min(scale, 4096 / Math.max(s0.width, s0.height));
  const vp = page.getViewport({ scale });

  // نرسم على canvas منفصل (اتجاهه LTR) ثم نستبدله، فلا وميض ولا تأثر بـ rtl
  const off = document.createElement('canvas');
  off.width = Math.floor(vp.width);
  off.height = Math.floor(vp.height);
  const ctx = off.getContext('2d');
  try { ctx.direction = 'ltr'; } catch {}
  const task = page.render({ canvasContext: ctx, viewport: vp });
  pdf.task = task;
  try { await task.promise; }
  catch (e) { if (e && e.name === 'RenderingCancelledException') return; throw e; }
  finally { pdf.task = null; }
  if (token !== pdf.token) return;

  const old = pdf.rendered.get(n);
  if (old) old.canvas.width = old.canvas.height = 0;
  const el = pdf.pages[n - 1];
  el.replaceChildren(off);
  pdf.rendered.set(n, { canvas: off, key });
  try { page.cleanup(); } catch {}
  pvEvict();   // قد تكون الشاشة ابتعدت أثناء الرسم
}

function pvCurrentPage() {
  const sc = pvSc();
  const y = sc.scrollTop + sc.clientHeight * 0.35;
  let n = Math.min(Math.max(pdf.page, 1), pdf.total);
  while (n > 1 && pdf.pages[n - 1].offsetTop > y) n--;
  while (n < pdf.total && pdf.pages[n].offsetTop <= y) n++;
  return n;
}

function pvUpdateCounter() {
  $('pvCounter').textContent = pdf.doc ? `${arNum(pdf.page)} من ${arNum(pdf.total)}` : '—';
}

function pvOnScroll() {
  if (pdf.scrollRaf || !pdf.doc) return;
  pdf.scrollRaf = requestAnimationFrame(() => {
    pdf.scrollRaf = 0;
    if (!pdf.doc) return;
    const n = pvCurrentPage();
    if (n !== pdf.page) { pdf.page = n; pvUpdateCounter(); }
  });
}

function pvGoTo(n) {
  if (!pdf.doc) return;
  n = Math.min(Math.max(1, n), pdf.total);
  pvSc().scrollTop = pdf.pages[n - 1].offsetTop - PV_PAD / 2;
}

function pvSetZoom(z, fx, fy) {
  if (!pdf.doc) return;
  z = Math.max(PV_MIN_ZOOM, Math.min(PV_MAX_ZOOM, z));
  if (Math.abs(z - pdf.zoom) < 0.005) return;
  const sc = pvSc();
  if (fx == null) fx = sc.clientWidth / 2;
  if (fy == null) fy = sc.clientHeight / 2;
  const rx = (sc.scrollLeft + fx) / sc.scrollWidth;
  const ry = (sc.scrollTop + fy) / sc.scrollHeight;
  pdf.zoom = z;
  pvLayout();
  sc.scrollLeft = rx * sc.scrollWidth - fx;
  sc.scrollTop = ry * sc.scrollHeight - fy;
  clearTimeout(pdf.zoomT);
  pdf.zoomT = setTimeout(pvPump, 160);   // أعد الرسم بالدقة الجديدة بعد استقرار الزوم
  pvUpdateZoomUI();
}

// ملاءمة الصفحة كاملة داخل الشاشة (الصفحة الحالية)
function pvFitPage() {
  if (!pdf.doc) return;
  const sc = pvSc();
  const s = pvSize(pdf.page);
  const pageH100 = pdf.fitW * s.h / s.w;               // ارتفاع الصفحة عند 100%
  const z = (sc.clientHeight - PV_PAD * 2) / pageH100;
  pvSetZoom(Math.min(1, z));
  const el = pdf.pages[pdf.page - 1];
  if (el) sc.scrollTop = el.offsetTop - PV_PAD;
}

function pvUpdateZoomUI() {
  const el = $('pvZoomLevel');
  if (el) el.textContent = arNum(Math.round(pdf.zoom * 100)) + '٪';
  $('pvZoomOut').disabled = pdf.zoom <= PV_MIN_ZOOM + 0.001;
  $('pvZoomIn').disabled = pdf.zoom >= PV_MAX_ZOOM - 0.001;
}

function destroyPDF() {
  pdf.token++;
  clearTimeout(pdf.zoomT);
  if (pdf.task) { try { pdf.task.cancel(); } catch {} pdf.task = null; }
  if (pdf.io) { pdf.io.disconnect(); pdf.io = null; }
  for (const n of [...pdf.rendered.keys()]) pvFree(n);
  pdf.rendered.clear();
  pdf.near.clear();
  pdf.pages = [];
  pdf.sizes = [];
  const host = $('pvPages');
  if (host) host.innerHTML = '';
  if (pdf.doc) { try { pdf.doc.destroy(); } catch {} pdf.doc = null; }
  pdf.total = 0; pdf.page = 1; pdf.zoom = 1; pdf.pumping = false;
  const img = $('pvImg');
  if (img) img.src = '';
}

function showViewerPanel(which) {
  $('pvCanvasWrap').style.display = which === 'canvas'  ? 'block' : 'none';
  $('pvImgWrap').style.display    = which === 'image'   ? 'flex'  : 'none';
  $('pvLoading').style.display    = which === 'loading' ? 'flex'  : 'none';
  $('pvNoPrev').style.display     = which === 'noprev'  ? 'flex'  : 'none';
  $('pvZoom').style.display       = which === 'canvas'  ? ''      : 'none';
  if (which !== 'canvas') pvUpdateCounter();
}

// ── مشاركة الملف نفسه (قائمة المشاركة في الجهاز، وإلا تحميل/نسخ رابط) ──
const shareCache = { path: null, file: null };

function pvToast(msg) {
  const t = $('pvToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(pvToast._t);
  pvToast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function pvCloseShareMenu() { $('pvShareMenu').style.display = 'none'; }

function pvOpenShareMenu(item, fileUrl, url) {
  const m = $('pvShareMenu');
  $('pvShareDownload').href = url;
  $('pvShareDownload').setAttribute('download', item.path.split('/').pop());
  $('pvShareCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(fileUrl); pvToast('تم نسخ رابط الملف'); }
    catch { window.prompt('انسخ رابط الملف:', fileUrl); }
    pvCloseShareMenu();
  };
  m.style.display = 'flex';
}

async function shareCurrent() {
  const item = currentItem();
  if (!item || !item.path) return;
  const url = encodePath(item.path);
  const fileUrl = new URL(url, location.href).href;
  const btn = $('pvShare');

  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    pvOpenShareMenu(item, fileUrl, url);
    return;
  }
  try {
    if (shareCache.path !== item.path) {
      btn.classList.add('busy');
      pvToast('جارٍ تجهيز الملف للمشاركة…');
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch');
      const blob = await res.blob();
      shareCache.path = item.path;
      shareCache.file = new File([blob], item.path.split('/').pop(), { type: 'application/pdf' });
      btn.classList.remove('busy');
    }
    if (!navigator.canShare({ files: [shareCache.file] })) { pvOpenShareMenu(item, fileUrl, url); return; }
    await navigator.share({ files: [shareCache.file], title: item.title });
  } catch (e) {
    btn.classList.remove('busy');
    if (e && e.name === 'AbortError') return;            // أغلق المستخدم القائمة
    if (e && e.name === 'NotAllowedError' && shareCache.path === item.path) {
      pvToast('الملف جاهز — اضغط مشاركة مرة أخرى');       // انتهت مهلة اللمس بعد التحميل
      return;
    }
    pvOpenShareMenu(item, fileUrl, url);
  }
}

function navigateDoc(delta) {
  const next = state.viewer.idx + delta;
  if (next < 0 || next >= state.viewer.items.length) return;
  state.viewer.idx = next;
  renderViewer();
}

// ───────────────────────────────────────────────────────
// أحداث العارض
// ───────────────────────────────────────────────────────
function setupViewerEvents() {
  $('pvClose').addEventListener('click', closeViewer);
  const sc = pvSc();
  sc.addEventListener('scroll', pvOnScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (!state.viewer.open || !pdf.doc) return;
    clearTimeout(pdf.resizeT);
    pdf.resizeT = setTimeout(() => { pvLayout(); pvPump(); }, 150);
  });
  // زوم: Ctrl+عجلة (كمبيوتر) وقرصة إصبعين (جوال)
  sc.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = sc.getBoundingClientRect();
    pvSetZoom(pdf.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  let pinch = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  sc.addEventListener('touchstart', e => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches[0], e.touches[1]), z: pdf.zoom };
  }, { passive: true });
  sc.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches, r = sc.getBoundingClientRect();
    pvSetZoom(pinch.z * dist(a, b) / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
  }, { passive: false });
  sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
  $('pvZoomIn').addEventListener('click', () => pvSetZoom(pdf.zoom * 1.25));
  $('pvZoomOut').addEventListener('click', () => pvSetZoom(pdf.zoom / 1.25));
  $('pvZoomLevel').addEventListener('click', () => pvSetZoom(1));   // ملاءمة العرض
  $('pvFitPage').addEventListener('click', pvFitPage);
  $('pvCounter').addEventListener('click', () => {
    if (!pdf.doc) return;
    const v = window.prompt('الانتقال إلى الصفحة (1-' + pdf.total + ')', String(pdf.page));
    const n = parseInt(String(v || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
    if (n) pvGoTo(n);
  });
  $('pvShare').addEventListener('click', e => { e.stopPropagation(); shareCurrent(); });
  document.addEventListener('click', e => { if (!e.target.closest('#pvShareMenu')) pvCloseShareMenu(); });
  $('pvPrevDoc').addEventListener('click', () => navigateDoc(-1));
  $('pvNextDoc').addEventListener('click', () => navigateDoc(1));
  $('pvBookmark').addEventListener('click', () => {
    toggleBookmark(currentItem());
    updateBookmarkBtn();
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (state.viewer.open) {
      switch (e.key) {
        case 'Escape':     if ($('pvShareMenu').style.display !== 'none') pvCloseShareMenu(); else closeViewer(); break;
        case 'ArrowRight': if (!pdf.doc) navigateDoc(-1); break;
        case 'ArrowLeft':  if (!pdf.doc) navigateDoc(1);  break;
        case '+': case '=': pvSetZoom(pdf.zoom * 1.25); break;
        case '-': pvSetZoom(pdf.zoom / 1.25); break;
        case '0': pvSetZoom(1); break;
        case '9': pvFitPage(); break;
      }
      return;
    }
    if (e.key === 'Escape') {
      if (sectionScreen.style.display === 'flex') hideScreen(sectionScreen);
      else if (bookmarksScreen.style.display === 'flex') hideScreen(bookmarksScreen);
    }
  });
}

// ───────────────────────────────────────────────────────
// الإطلاق
// ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
