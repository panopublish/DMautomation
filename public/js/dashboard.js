/**
 * public/js/dashboard.js
 * Client-side dynamic controller for PanoPublish Analytics & Management Dashboard.
 */

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.content-panel').forEach(panel => panel.classList.remove('active'));

  const activeBtn = document.getElementById(`tab-${tabId}`);
  const activePanel = document.getElementById(`panel-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');

  if (tabId === 'approvals') loadApprovals();
  if (tabId === 'discovery') loadLeads();
  if (tabId === 'conversations') loadConversations();
  if (tabId === 'outreach' && typeof loadOutreachHub === 'function') loadOutreachHub();
}

// Toast notification helper
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderColor = isError ? 'var(--accent-rose)' : 'var(--accent-cyan)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// 1. Fetch & Render Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('stat-dms-sent').textContent = data.dmsSent;
    document.getElementById('stat-replies-received').textContent = data.repliesReceived;
    document.getElementById('stat-reply-rate').textContent = `${data.replyRatePercent}%`;
    document.getElementById('reply-rate-bar').style.width = `${Math.min(100, data.replyRatePercent)}%`;
    document.getElementById('stat-pending-approvals').textContent = data.pendingApprovals;
    document.getElementById('pending-badge-count').textContent = data.pendingApprovals;
    const ilEl = document.getElementById('stat-indian-leads');
    const slEl = document.getElementById('stat-streetview-leads');
    if (ilEl) ilEl.textContent = data.indianLeadsDiscovered;
    if (slEl) slEl.textContent = Math.round(data.indianLeadsDiscovered * 0.6);

    // Update CDP status pill
    const cdpPill = document.getElementById('cdp-status-pill');
    const cdpLabel = document.getElementById('cdp-status-label');
    if (data.braveCdpConnected) {
      cdpLabel.textContent = `Brave CDP: Connected`;
      cdpPill.querySelector('.status-dot').className = 'status-dot green pulse';
    } else {
      cdpLabel.textContent = `Brave CDP: Disconnected`;
      cdpPill.querySelector('.status-dot').className = 'status-dot yellow';
    }

    // Update Mode
    const modeBadge = document.getElementById('mode-badge');
    modeBadge.textContent = data.operatingMode;
    if (data.operatingMode === 'LIVE') {
      modeBadge.style.color = 'var(--accent-emerald)';
      modeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      modeBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    } else {
      modeBadge.style.color = 'var(--accent-amber)';
      modeBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      modeBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    }
  } catch (e) {
    console.warn('Failed loading stats:', e);
  }
}

// 2. Fetch & Render Approvals
async function loadApprovals() {
  const container = document.getElementById('approvals-container');
  try {
    const res = await fetch('/api/approvals');
    const data = await res.json();
    const approvals = data.approvals || [];

    document.getElementById('pending-badge-count').textContent = approvals.length;

    if (approvals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>✓ Approval Queue is Clean</h3>
          <p class="section-desc" style="margin-top: 8px;">No pending DM replies or outbound pitches awaiting review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = approvals.map(item => `
      <div class="approval-card" id="card-${item.dmTurnId}">
        <div class="approval-card-top">
          <div class="user-badge">@${item.username}</div>
          <div class="intent-pill">${item.intent || 'INQUIRY'}</div>
        </div>

        <div class="incoming-box">
          <strong>Context / Message:</strong> "${escapeHtml(item.incomingText)}"
        </div>

        <div class="proposed-box">
          <label>Proposed AI Response (Editable before sending):</label>
          <textarea class="editable-reply-input" id="reply-text-${item.dmTurnId}">${escapeHtml(item.proposedReply)}</textarea>
        </div>

        <div class="approval-actions">
          <button class="btn btn-danger btn-sm" onclick="handleApprovalAction('${item.dmTurnId}', 'reject')">
            Reject
          </button>
          <button class="btn btn-primary" onclick="handleApprovalAction('${item.dmTurnId}', 'approve')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Approve & Send
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error loading approvals: ${err.message}</div>`;
  }
}

async function handleApprovalAction(dmTurnId, action) {
  const textarea = document.getElementById(`reply-text-${dmTurnId}`);
  const editedText = textarea ? textarea.value.trim() : null;

  try {
    const res = await fetch('/api/approvals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dmTurnId, action, editedText })
    });

    const result = await res.json();
    if (result.success) {
      showToast(action === 'approve' ? '✓ Message approved & queued for sending!' : 'Message rejected.');
      loadApprovals();
      loadStats();
    } else {
      showToast(`Action failed: ${result.error || 'Unknown error'}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

// 3. Fetch & Render Indian Leads
async function loadLeads() {
  const tbody = document.getElementById('leads-table-body');
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    const leads = data.leads || [];

    document.getElementById('stat-indian-leads').textContent = leads.length;

    if (leads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No leads discovered yet. Click "Run Discovery Scan" above.</td></tr>`;
      return;
    }

    tbody.innerHTML = leads.map(lead => `
      <tr>
        <td><strong>@${lead.username}</strong><br><span style="color:var(--text-faint); font-size:11px;">${escapeHtml(lead.displayName || '')}</span></td>
        <td><span class="intent-pill">${lead.category.replace(/_/g, ' ')}</span></td>
        <td style="max-width:250px; font-size:12px; color:var(--text-muted);">${escapeHtml(lead.bio || '')}</td>
        <td style="max-width:320px; font-size:12px; color:#38bdf8;">"${escapeHtml(lead.proposedPitch.slice(0, 110))}..."</td>
        <td><span class="status-dot green" style="display:inline-block; margin-right:4px;"></span>${lead.status || 'QUALIFIED'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="switchTab('approvals')">Review Pitch</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Error loading leads: ${err.message}</td></tr>`;
  }
}

async function triggerDiscovery() {
  const btn = document.getElementById('btn-trigger-discovery');
  btn.disabled = true;
  btn.textContent = 'Scanning Instagram...';

  try {
    const res = await fetch('/api/discovery/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: '360virtualtourindia', maxProfiles: 5 })
    });
    const result = await res.json();
    showToast(`Discovered ${result.count || 0} qualified Indian 360 creators!`);
    loadLeads();
    loadStats();
    loadApprovals();
  } catch (err) {
    showToast(`Discovery error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run Discovery Scan`;
  }
}

// 4. Fetch & Render Conversations
async function loadConversations() {
  const grid = document.getElementById('conversations-grid');
  const miniFeed = document.getElementById('mini-conversation-feed');

  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    const convs = data.conversations || [];

    if (convs.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No active conversation threads tracked yet.</div>`;
      if (miniFeed) miniFeed.innerHTML = `<div class="empty-state">No conversation turns recorded yet.</div>`;
      return;
    }

    grid.innerHTML = convs.map(c => `
      <div class="conversation-card">
        <div class="approval-card-top">
          <strong style="color:var(--accent-cyan); font-size:15px;">@${c.username}</strong>
          <span class="intent-pill">${c.conversationStage}</span>
        </div>

        ${c.lastIncomingText ? `<div class="chat-bubble bubble-incoming">"${escapeHtml(c.lastIncomingText)}"</div>` : ''}
        ${c.lastOutgoingText ? `<div class="chat-bubble bubble-outgoing">"${escapeHtml(c.lastOutgoingText)}"</div>` : ''}

        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-faint); margin-top:6px;">
          <span>In: ${c.incomingCount} | Out: ${c.outgoingCount}</span>
          <span>Lead: ${c.leadTemperature}</span>
        </div>
      </div>
    `).join('');

    if (miniFeed) {
      miniFeed.innerHTML = convs.slice(0, 3).map(c => `
        <div style="padding:10px; border-bottom:1px solid var(--border-color); font-size:13px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="color:var(--accent-cyan);">@${c.username}</strong>
            <span style="color:var(--text-faint); font-size:11px;">${c.conversationStage}</span>
          </div>
          <div style="color:var(--text-muted); font-size:12px;">"${escapeHtml((c.lastIncomingText || c.lastOutgoingText || '').slice(0, 70))}..."</div>
        </div>
      `).join('');
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error loading conversations: ${err.message}</div>`;
  }
}

// 5. Auth status check
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const pill = document.getElementById('auth-status-pill');
    const label = document.getElementById('auth-status-label');

    if (data.authenticated) {
      label.textContent = `Instagram: @${data.handle || 'Connected'}`;
      pill.querySelector('.status-dot').className = 'status-dot green pulse';
    } else {
      label.textContent = `Instagram: Manual Login Required`;
      pill.querySelector('.status-dot').className = 'status-dot yellow';
    }
  } catch (e) {}
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialization and polling
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadApprovals();
  loadLeads();
  loadConversations();
  checkAuthStatus();

  // Load Outreach Hub
  if (typeof loadOutreachHub === 'function') {
    loadOutreachHub();
  }

  // Poll stats every 5 seconds
  setInterval(loadStats, 5000);
  setInterval(() => { if (typeof updateHubStats === 'function') updateHubStats(); }, 10000);
});
