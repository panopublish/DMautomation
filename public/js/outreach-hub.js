/**
 * public/js/outreach-hub.js
 * Outreach Hub — all logic for the creator outreach command center.
 * Loads creators, renders cards with contact links, handles DM sending modal.
 */

/* -------- STATE -------- */
let allCreators = [];
let activeFilter = 'ALL';
let currentDmTarget = null;
let hubVisibleLimit = 60;

/* -------- INIT -------- */
async function loadOutreachHub() {
  const grid = document.getElementById('hub-grid');
  grid.innerHTML = `<div class="hub-loading"><div class="spinner"></div><p>Loading 500+ Indian creators...</p></div>`;
  try {
    const res = await fetch('/api/outreach-hub');
    const data = await res.json();
    allCreators = data.creators || [];
    updateHubStats();
    renderHubGrid(allCreators);
    updateOverviewHubStats();
  } catch (err) {
    grid.innerHTML = `<div class="hub-loading"><p style="color:#f43f5e">Failed to load creators: ${err.message}</p></div>`;
  }
}

/* -------- STATS -------- */
function updateHubStats() {
  const total = allCreators.length;
  const waCount = allCreators.filter(c => c.hasVerifiedWhatsApp).length;
  const igCount = allCreators.filter(c => c.hasVerifiedInstagram).length;
  const messaged = allCreators.filter(c => c.status === 'MESSAGED' || c.status === 'REPLIED').length;
  const active = allCreators.filter(c => c.status === 'ACTIVE').length;

  setEl('hub-total', total);
  setEl('hub-wa-count', waCount);
  setEl('hub-ig-count', igCount);
  setEl('hub-messaged', messaged);
  setEl('hub-active', active);
}

function updateOverviewHubStats() {
  const total = allCreators.length;
  const messaged = allCreators.filter(c => c.status === 'MESSAGED' || c.status === 'REPLIED').length;
  const el1 = document.getElementById('stat-hub-creators');
  const el2 = document.getElementById('stat-hub-messaged');
  if (el1) el1.textContent = total;
  if (el2) el2.textContent = messaged;
}

/* -------- FILTER -------- */
function setHubFilter(filter, btn) {
  activeFilter = filter;
  hubVisibleLimit = 60;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterHub(true);
}

function filterHub(resetLimit = true) {
  if (resetLimit) hubVisibleLimit = 60;
  const searchText = (document.getElementById('hub-search')?.value || '').toLowerCase();
  let filtered = allCreators;

  if (activeFilter !== 'ALL') {
    filtered = filtered.filter(c => {
      if (activeFilter === 'ACTIVE') return c.status === 'ACTIVE';
      if (activeFilter === 'MESSAGED') return c.status === 'MESSAGED' || c.status === 'REPLIED';
      if (activeFilter === 'HAS_WHATSAPP') return Boolean(c.hasVerifiedWhatsApp);
      if (activeFilter === 'HAS_INSTAGRAM') return Boolean(c.hasVerifiedInstagram);
      return c.category === activeFilter;
    });
  }

  if (searchText) {
    filtered = filtered.filter(c =>
      (c.username || '').toLowerCase().includes(searchText) ||
      (c.displayName || '').toLowerCase().includes(searchText) ||
      (c.city || '').toLowerCase().includes(searchText) ||
      (c.bio || '').toLowerCase().includes(searchText) ||
      (c.category || '').toLowerCase().includes(searchText) ||
      (c.whatsappPhone || '').toLowerCase().includes(searchText) ||
      (c.tags || []).some(t => t.includes(searchText))
    );
  }

  renderHubGrid(filtered);
}

/* -------- RENDER CARDS -------- */
function renderHubGrid(creators) {
  const grid = document.getElementById('hub-grid');
  if (!creators || creators.length === 0) {
    grid.innerHTML = `<div class="hub-loading"><p style="color:var(--text-faint)">No creators found. Try adjusting the filter.</p></div>`;
    return;
  }

  const visible = creators.slice(0, hubVisibleLimit);
  let html = visible.map(c => renderCreatorCard(c)).join('');

  if (creators.length > hubVisibleLimit) {
    const remaining = creators.length - hubVisibleLimit;
    html += `
      <div class="hub-load-more-card" style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:28px; background:var(--bg-card); border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-top:14px;">
        <div style="font-size:14px; color:var(--text-secondary);">
          Showing <strong>${visible.length}</strong> of <strong>${creators.length}</strong> creators (${remaining} more ready to contact)
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="loadMoreCreators(60)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            Load Next 60 Creators
          </button>
          <button class="btn btn-primary" onclick="loadAllCreators()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Show All ${creators.length} Creators
          </button>
        </div>
      </div>
    `;
  }

  grid.innerHTML = html;
}

function loadMoreCreators(count = 60) {
  hubVisibleLimit += count;
  filterHub(false);
}

function loadAllCreators() {
  hubVisibleLimit = 999999;
  filterHub(false);
}

function getCategoryLabel(category) {
  const map = {
    'GOOGLE_STREET_VIEW_AGENCY': '📍 GSV Agency',
    '360_PHOTOGRAPHER': '📸 360° Photographer',
    'VIRTUAL_TOUR_AGENCY': '🌐 Virtual Tour Agency'
  };
  return map[category] || category;
}

function getScoreDots(score) {
  const maxDots = 5;
  const filled = Math.min(maxDots, Math.round((score || 80) / 25));
  let html = '<span class="score-dots">';
  for (let i = 0; i < maxDots; i++) {
    html += `<span class="score-dot${i < filled ? ' filled' : ''}"></span>`;
  }
  html += '</span>';
  return html;
}

function copyPitchText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Pitch copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy pitch.', true);
  });
}

function renderCreatorCard(c) {
  const initial = (c.displayName || c.username || '?')[0].toUpperCase();
  const statusClass = c.status === 'MESSAGED' ? 'status-messaged' : c.status === 'REPLIED' ? 'status-replied' : 'status-active';
  const cardClass = c.status === 'MESSAGED' || c.status === 'REPLIED' ? 'creator-card messaged' : 'creator-card';
  const statusLabel = c.status === 'MESSAGED' ? '✅ Contacted' : c.status === 'REPLIED' ? '💬 Replied' : '○ Ready';
  
  const hasIG = Boolean(c.hasVerifiedInstagram && c.username);
  const hasWA = Boolean(c.hasVerifiedWhatsApp && c.whatsapp);

  const igProfileUrl = c.instagram || (hasIG ? `https://www.instagram.com/${c.username}/` : null);
  const igDmUrl = c.instagram_dm || igProfileUrl;
  const waUrl = c.whatsapp || null;
  const liUrl = c.linkedin || null;
  const siteUrl = c.website || null;

  const pitch = c.proposedPitch || `Hey! 👋\n\nAre you using any software to publish your 360° tours to Google Street View?\n\nCheck out PanoPublish — you can create, connect & publish your tours in one place.\n\n🎁 Free trial:\nhttps://panopublish.com\n\nWould love to hear your feedback!`;

  return `
    <div class="${cardClass}" id="card-${c.id || c.username}">
      <div class="creator-card-top">
        <div class="creator-avatar">${initial}</div>
        <div class="creator-info">
          <div class="creator-name">${escapeHtml(c.displayName || c.username)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px;">
            ${hasIG ? `<span class="badge-verified-ig" title="Verified Instagram account">📸 @${c.username}</span>` : ''}
            ${hasWA ? `<span class="badge-verified-wa" title="Verified WhatsApp Number">🟢 ${escapeHtml(c.whatsappPhone)}</span>` : ''}
          </div>
          ${c.city ? `<div class="creator-city" style="margin-top:4px;">📍 ${escapeHtml(c.city)}</div>` : ''}
        </div>
        <span class="creator-status-badge ${statusClass}">${statusLabel}</span>
      </div>

      <div class="creator-meta-row">
        <span class="creator-category">${getCategoryLabel(c.category)}</span>
        <span class="creator-score">
          Priority: ${getScoreDots(c.score || 80)}
        </span>
      </div>

      ${c.bio ? `<div class="creator-bio">${escapeHtml(c.bio)}</div>` : ''}

      <div class="creator-pitch-preview">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <div class="creator-pitch-label" style="margin-bottom:0;">💬 Outreach Pitch</div>
          <button class="btn-copy-pitch" onclick="copyPitchText(\`${escapeJs(pitch)}\`)" style="padding:2px 8px;font-size:10px;">
            📋 Copy
          </button>
        </div>
        <div class="creator-pitch-text">${escapeHtml(pitch)}</div>
      </div>

      <!-- Contact Links -->
      <div class="creator-links">
        ${hasIG ? `
          <a href="https://ig.me/m/${c.username}" target="_blank" class="contact-link link-instagram" title="Open Direct DM on Instagram" onclick="copyPitchText(\`${escapeJs(pitch)}\`); markAsMessaged('${c.id || c.username}');">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            Direct DM Link
          </a>
          <a href="${igProfileUrl}" target="_blank" class="contact-link link-instagram" title="View Verified Instagram Profile">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
            IG Profile
          </a>
        ` : ''}
        ${hasWA ? `
          <a href="${waUrl}" target="_blank" class="contact-link link-whatsapp" title="Chat on WhatsApp (Pre-filled)" onclick="markAsMessaged('${c.id || c.username}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            ${escapeHtml(c.whatsappPhone)}
          </a>
        ` : ''}
        ${siteUrl ? `
          <a href="${siteUrl}" target="_blank" class="contact-link link-website" title="Website">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Website
          </a>
        ` : ''}
        ${liUrl ? `
          <a href="${liUrl}" target="_blank" class="contact-link link-linkedin" title="LinkedIn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </a>
        ` : ''}
      </div>

      <!-- Action Buttons -->
      <div class="creator-actions">
        ${hasWA ? `
          <a href="${waUrl}" target="_blank" class="btn-whatsapp-send" onclick="markAsMessaged('${c.id || c.username}')" title="Open WhatsApp with pre-filled pitch">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        ` : ''}
        ${hasIG ? `
          <button class="btn-dm-send" onclick="openDirectInstagramDm('${c.username}', \`${escapeJs(pitch)}\`, '${c.id || c.username}')" title="Copies pitch and opens Instagram DM in new tab">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy & Open DM
          </button>
          <button class="btn-copy-pitch" onclick="openDmModal('${c.username}', '${escapeHtml(c.displayName)}', \`${escapeJs(pitch)}\`)" title="Edit message before opening DM" style="padding:6px 10px; font-size:11px;">
            ✏️
          </button>
        ` : ''}
        <button class="btn-mark-done" onclick="markAsMessaged('${c.id || c.username}')" title="Toggle contacted">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Done
        </button>
      </div>
    </div>
  `;
}

/* -------- DIRECT INSTAGRAM DM (MANUAL SAFE MODE) -------- */
async function openDirectInstagramDm(username, pitch, idOrUsername) {
  try {
    if (pitch && navigator.clipboard) {
      await navigator.clipboard.writeText(pitch);
    }
  } catch (err) {
    console.warn('Clipboard write failed, will open link anyway', err);
  }

  // ig.me/m/<username> opens the chat thread directly in Instagram Web or App!
  const dmUrl = `https://ig.me/m/${username}`;
  window.open(dmUrl, '_blank');

  showToast(`📋 Pitch copied! Opened @${username} DM in new tab. Press Ctrl+V to paste & send!`);

  // Update status in backend
  await markAsMessaged(idOrUsername);
}

/* -------- DM MODAL (MANUAL SAFE MODE) -------- */
function openDmModal(username, displayName, pitch) {
  currentDmTarget = { username, displayName };
  document.getElementById('dm-modal-title').textContent = `Direct DM: ${displayName}`;
  document.getElementById('dm-modal-subtitle').textContent = `@${username} · Direct Safe Link (Zero Bot Detection)`;
  const textarea = document.getElementById('dm-modal-message');
  textarea.value = pitch || '';
  updateCharCount();
  document.getElementById('dm-modal').style.display = 'flex';
  setTimeout(() => textarea.focus(), 100);
}

function closeDmModal() {
  document.getElementById('dm-modal').style.display = 'none';
  currentDmTarget = null;
}

function updateCharCount() {
  const val = document.getElementById('dm-modal-message')?.value || '';
  const el = document.getElementById('dm-char-count');
  if (el) el.textContent = val.length;
}

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('dm-modal-message');
  if (ta) ta.addEventListener('input', updateCharCount);
});

async function sendDmFromModal() {
  if (!currentDmTarget) return;
  const message = document.getElementById('dm-modal-message').value.trim();
  if (!message) {
    showToast('Please write a message before sending.', true);
    return;
  }

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(message);
    }
  } catch (err) {
    console.warn('Clipboard write failed', err);
  }

  // Open direct DM in new tab
  const dmUrl = `https://ig.me/m/${currentDmTarget.username}`;
  window.open(dmUrl, '_blank');

  showToast(`📋 Message copied! Opened @${currentDmTarget.username} DM. Press Ctrl+V to send.`);

  // Mark as messaged
  const creator = allCreators.find(c => c.username === currentDmTarget.username);
  const idOrUsername = creator?.id || currentDmTarget.username;
  if (creator) {
    creator.lastMessageSent = message;
  }
  await markAsMessaged(idOrUsername);

  closeDmModal();
}

/* -------- MARK AS DONE (manual or WhatsApp click) -------- */
async function markAsMessaged(idOrUsername) {
  try {
    await fetch('/api/outreach-hub/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idOrUsername, username: idOrUsername, status: 'MESSAGED' })
    });
    const creator = allCreators.find(c => c.id === idOrUsername || c.username === idOrUsername);
    if (creator) {
      creator.status = 'MESSAGED';
      creator.lastContactedAt = new Date().toISOString();
    }
    updateHubStats();
    filterHub();
    showToast(`✅ Contacted ${creator ? creator.displayName : idOrUsername}`);
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

/* -------- ADD CREATOR MODAL -------- */
function openAddCreatorModal() {
  document.getElementById('add-creator-modal').style.display = 'flex';
}

function closeAddCreatorModal() {
  document.getElementById('add-creator-modal').style.display = 'none';
  ['ac-username','ac-displayname','ac-city','ac-bio','ac-pitch','ac-whatsapp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

async function submitAddCreator() {
  const username = document.getElementById('ac-username').value.replace(/^@/,'').trim();
  const displayName = document.getElementById('ac-displayname').value.trim();
  const city = document.getElementById('ac-city').value.trim();
  const category = document.getElementById('ac-category').value;
  const bio = document.getElementById('ac-bio').value.trim();
  const pitch = document.getElementById('ac-pitch').value.trim();
  const waPhone = document.getElementById('ac-whatsapp').value.trim();

  if (!username || !displayName) {
    showToast('Username and Display Name are required.', true);
    return;
  }

  const payload = {
    username,
    displayName,
    city,
    category,
    bio,
    proposedPitch: pitch || `Hi ${displayName}! Saw your 360° virtual tour work and wanted to share PanoPublish — we make it easy to publish tours to Google Maps with ₹100 Pay-As-You-Go credits. Want to see a demo?`,
    status: 'ACTIVE',
    instagram: `https://www.instagram.com/${username}/`,
    instagram_dm: `https://www.instagram.com/${username}/`,
    whatsapp: waPhone ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent('Hi! I wanted to share something about PanoPublish...')}` : null,
    tags: [category.toLowerCase().replace(/_/g, '-'), 'india']
  };

  try {
    const res = await fetch('/api/outreach-hub/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast(`✅ @${username} added to Outreach Hub!`);
      closeAddCreatorModal();
      loadOutreachHub();
    } else {
      showToast(`Failed to add: ${result.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

/* -------- UTILITY -------- */
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeJs(str) {
  return String(str || '').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
}

/* Close modals on overlay click */
document.addEventListener('DOMContentLoaded', () => {
  ['dm-modal', 'add-creator-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.style.display = 'none';
          if (id === 'dm-modal') currentDmTarget = null;
        }
      });
    }
  });
});

/* Escape key closes modals */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('dm-modal').style.display = 'none';
    document.getElementById('add-creator-modal').style.display = 'none';
    currentDmTarget = null;
  }
});
