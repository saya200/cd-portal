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
  doc:       null,
  page:      1,
  total:     0,
  scale:     1.5,
  rendering: false,
};

const BM_KEY = 'cd-portal-bm';

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
  setupLogoFallback();
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

function setupLogoFallback() {
  const img = $('headerLogo');
  const fallback = $('logoFallback');
  if (!img || !fallback) return;
  img.addEventListener('load', () => { img.classList.add('loaded'); fallback.classList.add('hidden'); });
  img.addEventListener('error', () => { img.style.display = 'none'; });
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
  if (sec.hasSubcategories) {
    sectionScreen.innerHTML = sectionShellHTML(sec, getCount(sec)) + `
      <div class="ss-body"><div class="accordion-list" id="ssAccordion"></div></div>`;
    renderAccordions(sec);
  } else {
    const items = sec.items || [];
    sectionScreen.innerHTML = sectionShellHTML(sec, items.length) + `
      <div class="ss-body">${
        items.length
          ? `<div class="ss-list">${items.map((it, i) => itemRowHTML(it, i)).join('')}</div>`
          : emptyHTML('لا توجد ملفات في هذا القسم بعد')
      }</div>`;
    bindItemRows(sectionScreen, items);
  }

  bindSectionClose(sectionScreen);
  showScreen(sectionScreen);
}

function sectionShellHTML(sec, count) {
  return `
    <div class="ss-header">
      <button class="ss-close" aria-label="رجوع">${ICON_CLOSE}</button>
      <div class="ss-icon">${ICONS[sec.id] || ICONS.forms}</div>
      <span class="ss-title">${escapeHtml(sec.title)}</span>
      <span class="ss-count">${arNum(count)} ملف</span>
    </div>`;
}

function renderAccordions(sec) {
  const wrap = $('ssAccordion');
  const cats = sec.subcategories || [];
  if (!cats.length) { wrap.innerHTML = emptyHTML('لا توجد فئات بعد'); return; }

  wrap.innerHTML = cats.map((cat, i) => `
    <div class="accordion ${i === 0 ? 'open' : ''}" style="animation-delay:${i * 50}ms">
      <button class="accordion-head">
        <span class="accordion-title">${escapeHtml(cat.title)}</span>
        <span class="accordion-right">
          <span class="accordion-count">${arNum(cat.items?.length || 0)}</span>
          <span class="accordion-chev">${CHEV_D}</span>
        </span>
      </button>
      <div class="accordion-body">
        ${(cat.items || []).length
          ? cat.items.map((it, ii) => itemRowHTML(it, ii)).join('')
          : emptyHTML('لا توجد ملفات')}
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.accordion').forEach((acc, ci) => {
    acc.querySelector('.accordion-head').addEventListener('click', () => acc.classList.toggle('open'));
    const cat = cats[ci];
    acc.querySelectorAll('.item-row').forEach((row, ii) => {
      row.addEventListener('click', () => openViewer(cat.items, ii));
    });
  });
}

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
    $('pvPrevPage').style.display = 'none';
    $('pvNextPage').style.display = 'none';
  } else {
    $('pvPrevPage').style.display = 'flex';
    $('pvNextPage').style.display = 'flex';
    loadPDF(url);
  }
}

async function loadPDF(url) {
  pdf.page = 1;
  pdf.scale = window.innerWidth < 480 ? 1.4 : 1.8;
  try {
    pdf.doc = await pdfjsLib.getDocument(url).promise;
    pdf.total = pdf.doc.numPages;
    await renderPage();
    showViewerPanel('canvas');
  } catch {
    showViewerPanel('noprev');
  }
}

async function renderPage() {
  if (!pdf.doc || pdf.rendering) return;
  pdf.rendering = true;
  try {
    const page = await pdf.doc.getPage(pdf.page);
    const viewport = page.getViewport({ scale: pdf.scale });
    const canvas = $('pvCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
  } finally {
    pdf.rendering = false;
  }
  updatePageControls();
}

function updatePageControls() {
  if (pdf.doc) {
    $('pvCounter').textContent = `${arNum(pdf.page)} من ${arNum(pdf.total)}`;
    $('pvPrevPage').disabled = pdf.page <= 1;
    $('pvNextPage').disabled = pdf.page >= pdf.total;
  } else {
    $('pvCounter').textContent = '—';
  }
}

async function changePage(delta) {
  const next = pdf.page + delta;
  if (!pdf.doc || next < 1 || next > pdf.total) return;
  pdf.page = next;
  await renderPage();
  const wrap = $('pvCanvasWrap');
  if (wrap) wrap.scrollTop = 0;
}

function destroyPDF() {
  if (pdf.doc) { try { pdf.doc.destroy(); } catch {} pdf.doc = null; }
  pdf.total = 0; pdf.page = 1;
  const canvas = $('pvCanvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  const img = $('pvImg');
  if (img) img.src = '';
}

function showViewerPanel(which) {
  $('pvCanvasWrap').style.display = which === 'canvas'  ? 'flex' : 'none';
  $('pvImgWrap').style.display    = which === 'image'   ? 'flex' : 'none';
  $('pvLoading').style.display    = which === 'loading' ? 'flex' : 'none';
  $('pvNoPrev').style.display     = which === 'noprev'  ? 'flex' : 'none';
  if (which !== 'canvas') updatePageControls();
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
  $('pvPrevPage').addEventListener('click', () => changePage(-1));
  $('pvNextPage').addEventListener('click', () => changePage(1));
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
        case 'Escape':     closeViewer(); break;
        case 'ArrowRight': pdf.doc ? changePage(-1) : navigateDoc(-1); break;
        case 'ArrowLeft':  pdf.doc ? changePage(1)  : navigateDoc(1);  break;
        case 'ArrowUp':    changePage(-1); break;
        case 'ArrowDown':  changePage(1);  break;
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
