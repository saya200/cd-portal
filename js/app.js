/* ══════════════════════════════════════════════════════════════
   بوابة شعبة التحقيق – الدفاع المدني حائل
   app.js  |  HTML/CSS/JS  |  Data-driven via data/content.json
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────────────────
// الحالة العامة
// ──────────────────────────────────────────────────────────────
const state = {
  sections: [],          // مصفوفة الأقسام المحمّلة من JSON

  focus: {
    sectionId:  null,    // معرّف القسم النشط في Focus Mode
    subcatId:   null,    // معرّف الفئة الفرعية المعروضة
  },

  modal: {
    open:       false,
    sectionIdx: -1,      // فهرس القسم الحالي
    subcatIdx:  -1,      // فهرس الفئة الفرعية (-1 إذا لا توجد)
    itemIdx:    -1,      // فهرس العنصر الحالي
  },
};

// ──────────────────────────────────────────────────────────────
// مراجع DOM
// ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const sectionsGrid     = $('sectionsGrid');
const previewModal     = $('previewModal');
const modalCloseBtn    = $('modalCloseBtn');
const pdfFrame         = $('pdfFrame');
const imgViewer        = $('imgViewer');
const imgScrollWrap    = $('imgScrollWrap');
const noPreview        = $('noPreview');
const viewerLoading    = $('viewerLoading');
const downloadLink     = $('downloadLink');
const modalBreadcrumb  = $('modalBreadcrumb');
const itemNavLabel     = $('itemNavLabel');
const sectionNavLabel  = $('sectionNavLabel');
const prevItemBtn      = $('prevItemBtn');
const nextItemBtn      = $('nextItemBtn');
const prevSectionBtn   = $('prevSectionBtn');
const nextSectionBtn   = $('nextSectionBtn');

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

  // فتح القسم
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

  // رابط خارجي
  if (section.isExternalLink) {
    const hasURL = !!section.url;
    const tag    = hasURL ? 'a' : 'span';
    const attrs  = hasURL
      ? `href="${escapeAttr(section.url)}" target="_blank" rel="noopener noreferrer"`
      : '';
    return `
      ${back}
      <div class="ext-link-body">
        ${hasURL
          ? ''
          : `<p class="ext-link-note">الرابط سيُضاف قريباً</p>`}
        <${tag} class="ext-link-btn ${hasURL ? '' : 'link-disabled'}" ${attrs}>
          ${SECTION_ICONS['incident-platform']}
          ${hasURL ? 'فتح المنصة' : 'غير متاح حالياً'}
        </${tag}>
      </div>`;
  }

  // أقسام فرعية
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

  // عناصر مباشرة
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

  // زر الرجوع للقائمة الرئيسية
  body.addEventListener('click', e => {
    if (e.target.closest('.js-back-main')) {
      e.stopPropagation();
      defocusSection();
    }
  });

  // أزرار الفئات الفرعية
  body.addEventListener('click', e => {
    const btn = e.target.closest('.js-subcat-btn');
    if (btn) {
      e.stopPropagation();
      showSubcatItems(section, sectionIdx, btn.dataset.subcatId, body);
    }
  });

  // صفوف العناصر
  body.addEventListener('click', e => {
    const row = e.target.closest('.js-item-row');
    if (row) {
      e.stopPropagation();
      openModal(
        sectionIdx,
        parseInt(row.dataset.subcatIdx),
        parseInt(row.dataset.itemIdx)
      );
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

  // رجوع للفئات الفرعية
  body.querySelector('.js-back-subcats').addEventListener('click', e => {
    e.stopPropagation();
    state.focus.subcatId = null;
    body.innerHTML = buildCardBodyHTML(section, sectionIdx);
    bindCardBodyOnly(body, section, sectionIdx);
  });

  // فتح عنصر
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
  // إيقاف التحميل
  pdfFrame.src     = 'about:blank';
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

  // ── Breadcrumb ────────────────────────────────────────────
  const crumbs = [{ text: section.title }];
  if (subcatIdx >= 0) {
    crumbs.push({ text: section.subcategories[subcatIdx].title });
  }
  if (item) crumbs.push({ text: item.title, current: true });

  modalBreadcrumb.innerHTML = crumbs.map((c, i) => `
    ${i > 0 ? `<span class="breadcrumb-sep">›</span>` : ''}
    <span class="breadcrumb-item ${c.current ? 'bc-current' : ''}">${c.text}</span>
  `).join('');

  // ── عارض الملف ───────────────────────────────────────────
  loadViewer(item);

  // ── تنقل بين العناصر ─────────────────────────────────────
  const total = items.length;
  itemNavLabel.textContent = total > 0 ? `${itemIdx + 1} / ${total}` : '—';
  prevItemBtn.disabled = itemIdx <= 0;
  nextItemBtn.disabled = itemIdx >= total - 1;

  // ── تنقل بين الفئات / الأقسام ────────────────────────────
  renderSectionNav(section, sectionIdx, subcatIdx);
}

function loadViewer(item) {
  // إخفاء كل شيء وإظهار التحميل
  pdfFrame.style.display    = 'none';
  imgScrollWrap.style.display = 'none';
  noPreview.style.display   = 'none';
  viewerLoading.style.display = 'flex';

  if (!item || !item.path) {
    viewerLoading.style.display = 'none';
    noPreview.style.display     = 'flex';
    return;
  }

  if (item.type === 'image') {
    imgViewer.onload = () => {
      viewerLoading.style.display  = 'none';
      imgScrollWrap.style.display  = 'flex';
    };
    imgViewer.onerror = () => {
      viewerLoading.style.display = 'none';
      noPreview.style.display     = 'flex';
      downloadLink.href = item.path;
    };
    imgViewer.src = item.path;
  } else {
    // PDF عبر iframe
    let timerID = setTimeout(() => {
      viewerLoading.style.display = 'none';
      pdfFrame.style.display      = 'block';
    }, 1800);

    pdfFrame.onload = () => {
      clearTimeout(timerID);
      viewerLoading.style.display = 'none';
      pdfFrame.style.display      = 'block';
    };

    pdfFrame.onerror = () => {
      clearTimeout(timerID);
      viewerLoading.style.display = 'none';
      noPreview.style.display     = 'flex';
      downloadLink.href = item.path;
    };

    // #toolbar=1 يُظهر شريط الأدوات المدمج في المتصفح
    pdfFrame.src = `${item.path}#toolbar=1&navpanes=0&view=FitH`;
  }
}

// ── تنقل مستوى الفئات / الأقسام ───────────────────────────────
function renderSectionNav(section, sectionIdx, subcatIdx) {
  if (section.hasSubcategories && subcatIdx >= 0) {
    // التنقل بين الفئات الفرعية
    const subs     = section.subcategories || [];
    const hasPrev  = subcatIdx > 0;
    const hasNext  = subcatIdx < subs.length - 1;

    sectionNavLabel.textContent = 'الفئات الفرعية';
    prevSectionBtn.disabled = !hasPrev;
    nextSectionBtn.disabled = !hasNext;

    $('prevSectionLabel').textContent = hasPrev ? subs[subcatIdx - 1].title : 'السابقة';
    $('nextSectionLabel').textContent = hasNext ? subs[subcatIdx + 1].title : 'التالية';

    prevSectionBtn.onclick = () => jumpToSubcat(sectionIdx, subcatIdx - 1);
    nextSectionBtn.onclick = () => jumpToSubcat(sectionIdx, subcatIdx + 1);
  } else {
    // التنقل بين الأقسام (غير الروابط الخارجية)
    const navigable = state.sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !s.isExternalLink);

    const pos      = navigable.findIndex(({ i }) => i === sectionIdx);
    const hasPrev  = pos > 0;
    const hasNext  = pos < navigable.length - 1;

    sectionNavLabel.textContent = 'الأقسام';
    prevSectionBtn.disabled = !hasPrev;
    nextSectionBtn.disabled = !hasNext;

    $('prevSectionLabel').textContent = hasPrev ? navigable[pos - 1].s.title : 'السابق';
    $('nextSectionLabel').textContent = hasNext ? navigable[pos + 1].s.title : 'التالي';

    prevSectionBtn.onclick = () => {
      if (!hasPrev) return;
      jumpToSection(navigable[pos - 1].i);
    };
    nextSectionBtn.onclick = () => {
      if (!hasNext) return;
      jumpToSection(navigable[pos + 1].i);
    };
  }
}

function jumpToSubcat(sectionIdx, subcatIdx) {
  state.modal.sectionIdx = sectionIdx;
  state.modal.subcatIdx  = subcatIdx;
  state.modal.itemIdx    = 0;
  renderModal();
}

function jumpToSection(sectionIdx) {
  const sec = state.sections[sectionIdx];
  if (!sec) return;
  state.modal.sectionIdx = sectionIdx;
  state.modal.subcatIdx  = sec.hasSubcategories ? 0 : -1;
  state.modal.itemIdx    = 0;
  renderModal();
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
  modalCloseBtn.addEventListener('click', closeModal);

  // إغلاق بالضغط خارج الصندوق
  previewModal.addEventListener('click', e => {
    if (e.target === previewModal) closeModal();
  });

  prevItemBtn.addEventListener('click', () => navigateItem(-1));
  nextItemBtn.addEventListener('click', () => navigateItem(1));
}

// ── لوحة المفاتيح ──────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (!state.modal.open) return;

    switch (e.key) {
      case 'Escape':      closeModal();       break;
      // RTL: السهم الأيمن = السابق (في العربية)
      case 'ArrowRight':  navigateItem(-1);   break;
      case 'ArrowLeft':   navigateItem(1);    break;
      case 'ArrowUp':     navigateItem(-1);   break;
      case 'ArrowDown':   navigateItem(1);    break;
    }
  });
}

// ──────────────────────────────────────────────────────────────
// البحث (جاهز للتفعيل)
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
  const q = query.toLowerCase();
  const hits = [];

  state.sections.forEach((sec, si) => {
    if (sec.isExternalLink) return;

    const searchInItems = (items, subcatIdx, subcatTitle) => {
      items.forEach((item, ii) => {
        if (item.title.toLowerCase().includes(q)) {
          hits.push({
            sectionIdx: si,
            subcatIdx,
            itemIdx: ii,
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
      openModal(
        parseInt(el.dataset.si),
        parseInt(el.dataset.sub),
        parseInt(el.dataset.ii)
      );
    });
  });
}

// ──────────────────────────────────────────────────────────────
// أداة مساعدة
// ──────────────────────────────────────────────────────────────
function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────────────────────
// الإطلاق
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
