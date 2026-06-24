/* ══════════════════════════════════════════════════════════════
   بوابة شعبة التحقيق – الدفاع المدني حائل
   app.js  |  HTML/CSS/JS  |  Data-driven via data/content.json
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────────────────
// الحالة العامة
// ──────────────────────────────────────────────────────────────
const state = {
  sections: [],

  focus: {
    sectionId: null,
    subcatId:  null,
  },

  modal: {
    open:       false,
    sectionIdx: -1,
    subcatIdx:  -1,
    itemIdx:    -1,
  },
};

// حالة PDF.js
const pdf = {
  doc:            null,
  page:           1,
  total:          0,
  scale:          1.5,
  rendering:      false,
  toolbarVisible: true,
  hideTimer:      null,
};

// ──────────────────────────────────────────────────────────────
// مراجع DOM
// ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const sectionsGrid  = $('sectionsGrid');
const previewModal  = $('previewModal');
const imgViewer     = $('imgViewer');
const imgScrollWrap = $('imgScrollWrap');
const noPreview     = $('noPreview');
const viewerLoading = $('viewerLoading');
const downloadLink  = $('downloadLink');
const prevItemBtn   = $('prevItemBtn');
const nextItemBtn   = $('nextItemBtn');

// ──────────────────────────────────────────────────────────────
// أيقونات الأقسام (SVG)
// ──────────────────────────────────────────────────────────────
const SECTION_ICONS = {
  guides: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
             <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
           </svg>`,

  forms: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>`,

  circulars: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>`,

  'fire-behavior': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3
                               -1.072-2.143-.224-4.054 2-6
                               .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0
                               c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                    </svg>`,

  'incident-platform': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8
                                    a2 2 0 0 1 2-2h6"/>
                           <polyline points="15 3 21 3 21 9"/>
                           <line x1="10" y1="14" x2="21" y2="3"/>
                         </svg>`,
};

const CHEVRON_L = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                     <polyline points="15 18 9 12 15 6"/>
                   </svg>`;

const CHEVRON_R = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                     <polyline points="9 18 15 12 9 6"/>
                   </svg>`;

// ──────────────────────────────────────────────────────────────
// التهيئة
// ──────────────────────────────────────────────────────────────
async function init() {
  initPDFJS();
  setupLogoFallback();
  setupModalEvents();
  setupKeyboard();
  setupSearch();

  try {
    const res = await fetch('data/content.json');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.sections = data.sections || [];
    renderSections();
  } catch {
    sectionsGrid.innerHTML = `
      <div class="empty-state" style="padding:60px 20px">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.4" opacity=".4">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>تعذّر تحميل البيانات. يرجى تحديث الصفحة.</p>
      </div>`;
  }
}

// ── شعار الترويسة ──────────────────────────────────────────────
function setupLogoFallback() {
  const img      = $('headerLogo');
  const fallback = $('logoFallback');
  if (!img || !fallback) return;

  img.addEventListener('load', () => {
    img.classList.add('loaded');
    fallback.classList.add('hidden');
  });

  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────
// عرض الأقسام
// ──────────────────────────────────────────────────────────────
function renderSections() {
  sectionsGrid.innerHTML = '';
  state.sections.forEach((section, idx) => {
    sectionsGrid.appendChild(buildSectionCard(section, idx));
  });
}

function buildSectionCard(section, idx) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.dataset.id  = section.id;
  card.dataset.idx = idx;
  card.setAttribute('role', 'listitem');

  card.innerHTML = `
    <div class="card-head" role="button" tabindex="0"
         aria-label="فتح قسم ${section.title}">
      <div class="card-icon">
        ${SECTION_ICONS[section.id] || SECTION_ICONS.forms}
      </div>
      <div class="card-info">
        <div class="card-title">${section.title}</div>
        <div class="card-count">${getCountLabel(section)}</div>
      </div>
      <span class="card-arrow">${CHEVRON_L}</span>
    </div>
    <div class="card-body" id="body-${section.id}">
      ${buildCardBodyHTML(section, idx)}
    </div>
  `;

  const head = card.querySelector('.card-head');
  head.addEventListener('click', () => {
    if (!sectionsGrid.classList.contains('has-focus')) {
      focusSection(section.id, card);
    }
  });
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') head.click();
  });

  bindCardEvents(card, section, idx);
  return card;
}

function getCountLabel(section) {
  if (section.isExternalLink) return 'رابط خارجي';
  let n = 0;
  if (section.hasSubcategories) {
    (section.subcategories || []).forEach(s => n += s.items?.length || 0);
  } else {
    n = section.items?.length || 0;
  }
  if (n === 0) return 'لا توجد ملفات بعد';
  return `${n} ${n === 1 ? 'ملف' : 'ملفات'}`;
}

// ──────────────────────────────────────────────────────────────
// بناء HTML جسم البطاقة
// ──────────────────────────────────────────────────────────────
function buildCardBodyHTML(section, sectionIdx) {
  const back = `
    <button class="card-back-btn js-back-main" aria-label="العودة لجميع الأقسام">
      ${CHEVRON_L} العودة للأقسام
    </button>`;

  if (section.isExternalLink) {
    const hasURL = !!section.url;
    const tag    = hasURL ? 'a' : 'span';
    const attrs  = hasURL
      ? `href="${escapeAttr(section.url)}" target="_blank" rel="noopener noreferrer"`
      : '';
    return `
      ${back}
      <div class="ext-link-body">
        ${hasURL ? '' : `<p class="ext-link-note">الرابط سيُضاف قريباً</p>`}
        <${tag} class="ext-link-btn ${hasURL ? '' : 'link-disabled'}" ${attrs}>
          ${SECTION_ICONS['incident-platform']}
          ${hasURL ? 'فتح المنصة' : 'غير متاح حالياً'}
        </${tag}>
      </div>`;
  }

  if (section.hasSubcategories) {
    const subs = section.subcategories || [];
    return `
      ${back}
      ${subs.length === 0
        ? emptyStateHTML()
        : `<div class="subcats-list">
             ${subs.map(sub => `
               <button class="subcat-btn js-subcat-btn"
                       data-subcat-id="${escapeAttr(sub.id)}">
                 <span>${sub.title}</span>
                 <span class="subcat-btn-right">
                   <span class="subcat-count">${sub.items?.length || 0} ملفات</span>
                   <span class="subcat-chev">${CHEVRON_L}</span>
                 </span>
               </button>`).join('')}
           </div>`}`;
  }

  const items = section.items || [];
  return `
    ${back}
    ${items.length === 0
      ? emptyStateHTML()
      : `<div class="items-list">
           ${items.map((item, ii) => itemRowHTML(item, ii, -1)).join('')}
         </div>`}`;
}

function emptyStateHTML() {
  return `
    <div class="empty-state">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.4">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p>لا توجد ملفات في هذا القسم بعد</p>
    </div>`;
}

function itemRowHTML(item, itemIdx, subcatIdx) {
  const isImg = item.type === 'image';
  return `
    <div class="item-row js-item-row"
         data-item-idx="${itemIdx}"
         data-subcat-idx="${subcatIdx}"
         role="button" tabindex="0"
         aria-label="فتح ${item.title}">
      <span class="item-type-badge ${isImg ? 'badge-img' : ''}">
        ${isImg ? 'صورة' : 'PDF'}
      </span>
      <span class="item-title">${item.title}</span>
      <span class="item-arrow-icon">${CHEVRON_L}</span>
    </div>`;
}

// ── ربط الأحداث بعناصر البطاقة ────────────────────────────────
function bindCardEvents(card, section, sectionIdx) {
  const body = card.querySelector(`#body-${section.id}`);

  body.addEventListener('click', e => {
    if (e.target.closest('.js-back-main')) {
      e.stopPropagation();
      defocusSection();
    }
  });

  body.addEventListener('click', e => {
    const btn = e.target.closest('.js-subcat-btn');
    if (btn) {
      e.stopPropagation();
      showSubcatItems(section, sectionIdx, btn.dataset.subcatId, body);
    }
  });

  body.addEventListener('click', e => {
    const row = e.target.closest('.js-item-row');
    if (row) {
      e.stopPropagation();
      openModal(sectionIdx, parseInt(row.dataset.subcatIdx), parseInt(row.dataset.itemIdx));
    }
  });

  body.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const row = e.target.closest('.js-item-row');
      if (row) row.click();
    }
  });
}

// ── عرض عناصر فئة فرعية ──────────────────────────────────────
function showSubcatItems(section, sectionIdx, subcatId, body) {
  const subcatIdx = (section.subcategories || []).findIndex(s => s.id === subcatId);
  if (subcatIdx === -1) return;
  const subcat = section.subcategories[subcatIdx];

  state.focus.subcatId = subcatId;

  body.innerHTML = `
    <button class="back-to-subcats js-back-subcats">
      ${CHEVRON_L} ${section.title}
    </button>
    <div class="subcat-current-title">${subcat.title}</div>
    ${subcat.items?.length
      ? `<div class="items-list">
           ${subcat.items.map((item, ii) => itemRowHTML(item, ii, subcatIdx)).join('')}
         </div>`
      : emptyStateHTML()}`;

  body.querySelector('.js-back-subcats').addEventListener('click', e => {
    e.stopPropagation();
    state.focus.subcatId = null;
    body.innerHTML = buildCardBodyHTML(section, sectionIdx);
    bindCardBodyOnly(body, section, sectionIdx);
  });

  body.addEventListener('click', e => {
    const row = e.target.closest('.js-item-row');
    if (row) {
      e.stopPropagation();
      openModal(sectionIdx, subcatIdx, parseInt(row.dataset.itemIdx));
    }
  });
}

function bindCardBodyOnly(body, section, sectionIdx) {
  body.addEventListener('click', e => {
    if (e.target.closest('.js-back-main')) {
      e.stopPropagation(); defocusSection();
    }
    const btn = e.target.closest('.js-subcat-btn');
    if (btn) {
      e.stopPropagation();
      showSubcatItems(section, sectionIdx, btn.dataset.subcatId, body);
    }
    const row = e.target.closest('.js-item-row');
    if (row) {
      e.stopPropagation();
      openModal(sectionIdx, parseInt(row.dataset.subcatIdx), parseInt(row.dataset.itemIdx));
    }
  });
}

// ──────────────────────────────────────────────────────────────
// Focus Mode
// ──────────────────────────────────────────────────────────────
function focusSection(sectionId, card) {
  state.focus.sectionId = sectionId;
  state.focus.subcatId  = null;
  sectionsGrid.classList.add('has-focus');
  card.classList.add('active');
  card.setAttribute('aria-expanded', 'true');
}

function defocusSection() {
  state.focus.sectionId = null;
  state.focus.subcatId  = null;
  sectionsGrid.classList.remove('has-focus');
  sectionsGrid.querySelectorAll('.section-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-expanded', 'false');
  });
}

// ──────────────────────────────────────────────────────────────
// PDF.js – التهيئة والعرض
// ──────────────────────────────────────────────────────────────
function initPDFJS() {
  if (typeof pdfjsLib === 'undefined') return;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.js';
}

function calcInitialScale() {
  const w = window.innerWidth;
  if (w < 480) return 1.2;
  if (w < 768) return 1.5;
  return 2.0;
}

async function loadPDF(path) {
  const url = encodePath(path);
  showViewerPanel('loading');
  pdf.page  = 1;
  pdf.scale = calcInitialScale();
  if (pdf.doc) { try { pdf.doc.destroy(); } catch {} pdf.doc = null; }

  try {
    pdf.doc   = await pdfjsLib.getDocument(url).promise;
    pdf.total = pdf.doc.numPages;
    await renderCurrentPage();
    showViewerPanel('canvas');
    $('pdfDownloadBtn').href     = url;
    $('pdfDownloadBtn').download = path.split('/').pop();
    setToolbarVisible(true);
    resetHideTimer();
  } catch {
    showViewerPanel('noprev');
    downloadLink.href = url;
  }
}

async function renderCurrentPage() {
  if (!pdf.doc || pdf.rendering) return;
  pdf.rendering = true;
  try {
    const page     = await pdf.doc.getPage(pdf.page);
    const viewport = page.getViewport({ scale: pdf.scale });
    const canvas   = $('pdfCanvas');
    const ctx      = canvas.getContext('2d');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
  } finally {
    pdf.rendering = false;
  }
  updatePDFControls();
}

function updatePDFControls() {
  $('pdfPageInfo').textContent = pdf.doc ? `${pdf.page} / ${pdf.total}` : '— / —';
  $('pdfPrevPage').disabled    = pdf.page <= 1;
  $('pdfNextPage').disabled    = pdf.page >= pdf.total;
}

async function changePage(delta) {
  const next = pdf.page + delta;
  if (!pdf.doc || next < 1 || next > pdf.total) return;
  pdf.page = next;
  await renderCurrentPage();
  setToolbarVisible(true);
  resetHideTimer();
}

async function changeZoom(delta) {
  pdf.scale = Math.min(4, Math.max(0.5, pdf.scale + delta));
  await renderCurrentPage();
}

function setToolbarVisible(visible) {
  pdf.toolbarVisible = visible;
  const toolbar  = $('pdfToolbar');
  const prevPage = $('pdfPrevPage');
  const nextPage = $('pdfNextPage');
  if (visible) {
    toolbar.classList.remove('hidden');
    prevPage.classList.remove('hidden');
    nextPage.classList.remove('hidden');
  } else {
    toolbar.classList.add('hidden');
    prevPage.classList.add('hidden');
    nextPage.classList.add('hidden');
  }
}

function toggleToolbar() {
  setToolbarVisible(!pdf.toolbarVisible);
  if (pdf.toolbarVisible) resetHideTimer();
  else clearTimeout(pdf.hideTimer);
}

function resetHideTimer() {
  clearTimeout(pdf.hideTimer);
  pdf.hideTimer = setTimeout(() => setToolbarVisible(false), 3500);
}

function showViewerPanel(which) {
  $('pdfCanvasArea').style.display  = which === 'canvas'  ? 'flex'  : 'none';
  $('imgScrollWrap').style.display  = which === 'image'   ? 'flex'  : 'none';
  $('noPreview').style.display      = which === 'noprev'  ? 'flex'  : 'none';
  $('viewerLoading').style.display  = which === 'loading' ? 'flex'  : 'none';
}

// ──────────────────────────────────────────────────────────────
// المودال – الفتح والإغلاق
// ──────────────────────────────────────────────────────────────
function openModal(sectionIdx, subcatIdx, itemIdx) {
  state.modal = { open: true, sectionIdx, subcatIdx, itemIdx };
  renderModal();
  previewModal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  previewModal.classList.remove('open');
  document.body.classList.remove('modal-open');
  clearTimeout(pdf.hideTimer);
  if (pdf.doc) { try { pdf.doc.destroy(); } catch {} pdf.doc = null; }
  const canvas = $('pdfCanvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  imgViewer.src    = '';
  state.modal.open = false;
}

// ──────────────────────────────────────────────────────────────
// المودال – الرندر
// ──────────────────────────────────────────────────────────────
function getActiveItems() {
  const sec = state.sections[state.modal.sectionIdx];
  if (!sec) return [];
  if (state.modal.subcatIdx >= 0) {
    return sec.subcategories?.[state.modal.subcatIdx]?.items || [];
  }
  return sec.items || [];
}

function renderModal() {
  const { sectionIdx, subcatIdx, itemIdx } = state.modal;
  const section = state.sections[sectionIdx];
  if (!section) return;

  const items = getActiveItems();
  const item  = items[itemIdx];

  // تحديث اسم الفئة في الشريط السفلي
  let navLabel = section.title;
  if (subcatIdx >= 0 && section.subcategories?.[subcatIdx]) {
    navLabel = section.subcategories[subcatIdx].title;
  }
  $('pdfNavLabel').textContent = navLabel;

  // تفعيل/تعطيل أزرار التنقل بين الملفات
  const total = items.length;
  prevItemBtn.disabled = itemIdx <= 0;
  nextItemBtn.disabled = itemIdx >= total - 1;

  // تحميل الملف
  loadViewer(item);
}

function loadViewer(item) {
  if (!item || !item.path) {
    showViewerPanel('noprev');
    return;
  }

  if (item.type === 'image') {
    showViewerPanel('loading');
    imgViewer.onload = () => showViewerPanel('image');
    imgViewer.onerror = () => {
      showViewerPanel('noprev');
      downloadLink.href = encodePath(item.path);
    };
    imgViewer.src = encodePath(item.path);
  } else {
    loadPDF(item.path);
  }
}

// ──────────────────────────────────────────────────────────────
// التنقل بين العناصر
// ──────────────────────────────────────────────────────────────
function navigateItem(dir) {
  const items  = getActiveItems();
  const newIdx = state.modal.itemIdx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  state.modal.itemIdx = newIdx;
  renderModal();
}

// ──────────────────────────────────────────────────────────────
// إعداد أحداث المودال
// ──────────────────────────────────────────────────────────────
function setupModalEvents() {
  // إغلاق
  $('pdfCloseBtn').addEventListener('click', closeModal);
  previewModal.addEventListener('click', e => {
    if (e.target === previewModal) closeModal();
  });

  // تبديل الشريط بالنقر على منطقة Canvas
  $('pdfCanvasArea').addEventListener('click', e => {
    if (e.target.closest('button, a')) return;
    toggleToolbar();
  });

  // تصفح الصفحات
  $('pdfPrevPage').addEventListener('click', () => changePage(-1));
  $('pdfNextPage').addEventListener('click', () => changePage(1));

  // الزوم
  $('pdfZoomOut').addEventListener('click', () => changeZoom(-0.25));
  $('pdfZoomIn').addEventListener('click',  () => changeZoom(0.25));

  // التنقل بين الملفات
  prevItemBtn.addEventListener('click', () => navigateItem(-1));
  nextItemBtn.addEventListener('click', () => navigateItem(1));
}

// ── لوحة المفاتيح ──────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (!state.modal.open) return;

    switch (e.key) {
      case 'Escape':
        closeModal();
        break;
      case 'ArrowUp':
        if (pdf.doc) changePage(-1);
        else navigateItem(-1);
        break;
      case 'ArrowDown':
        if (pdf.doc) changePage(1);
        else navigateItem(1);
        break;
      case 'ArrowRight':
        navigateItem(-1);
        break;
      case 'ArrowLeft':
        navigateItem(1);
        break;
    }
  });
}

// ──────────────────────────────────────────────────────────────
// البحث
// ──────────────────────────────────────────────────────────────
function setupSearch() {
  const searchInput   = $('searchInput');
  const searchClear   = $('searchClear');
  const searchResults = $('searchResults');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClear.style.display = q ? 'flex' : 'none';
    if (!q) { searchResults.innerHTML = ''; return; }
    renderSearchResults(q, searchResults);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchResults.innerHTML = '';
    searchInput.focus();
  });
}

function renderSearchResults(query, container) {
  const q    = query.toLowerCase();
  const hits = [];

  state.sections.forEach((sec, si) => {
    if (sec.isExternalLink) return;

    const searchInItems = (items, subcatIdx, subcatTitle) => {
      items.forEach((item, ii) => {
        if (item.title.toLowerCase().includes(q)) {
          hits.push({
            sectionIdx: si, subcatIdx, itemIdx: ii,
            title: item.title,
            path: [sec.title, subcatTitle].filter(Boolean).join(' › '),
          });
        }
      });
    };

    if (sec.hasSubcategories) {
      (sec.subcategories || []).forEach((sub, subi) => {
        searchInItems(sub.items || [], subi, sub.title);
      });
    } else {
      searchInItems(sec.items || [], -1, null);
    }
  });

  if (hits.length === 0) {
    container.innerHTML = `<p class="search-no-results">لا توجد نتائج لـ "${query}"</p>`;
    return;
  }

  container.innerHTML = hits.slice(0, 12).map(h => `
    <div class="search-result-item"
         data-si="${h.sectionIdx}" data-sub="${h.subcatIdx}" data-ii="${h.itemIdx}"
         role="button" tabindex="0">
      <div>
        <div class="search-result-title">${h.title}</div>
        <div class="search-result-path">${h.path}</div>
      </div>
    </div>`).join('');

  container.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      openModal(parseInt(el.dataset.si), parseInt(el.dataset.sub), parseInt(el.dataset.ii));
    });
  });
}

// ──────────────────────────────────────────────────────────────
// أدوات مساعدة
// ──────────────────────────────────────────────────────────────
function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function encodePath(path) {
  return path.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

// ──────────────────────────────────────────────────────────────
// الإطلاق
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
