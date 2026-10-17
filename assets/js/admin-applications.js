/* =========================================================
   EventOps Admin · Organizer Applications (#19)
   GET   /api/admin/organizer-applications?status&page&limit
   PATCH /api/admin/organizer-applications/:id
   ========================================================= */

const LIMIT = 10;

const STATUS_BADGE = {
  pending: "badge-pending",
  approved: "badge-upcoming",
  rejected: "badge-cancelled",
};

const state = {
  status: "all",
  page: 1,
  search: "",
  applications: [],
  pagination: { total: 0, page: 1, limit: LIMIT, pages: 1 },
};

const els = {
  body: document.getElementById("appTableBody"),
  foot: document.getElementById("tableFoot"),
  pageInfo: document.getElementById("pageInfo"),
  prev: document.getElementById("prevBtn"),
  next: document.getElementById("nextBtn"),
  tabs: document.getElementById("statusTabs"),
  search: document.getElementById("searchInput"),
  drawer: document.getElementById("drawer"),
  overlay: document.getElementById("drawerOverlay"),
  drawerBody: document.getElementById("drawerBody"),
  drawerClose: document.getElementById("drawerClose"),
  content: document.getElementById("content"),
};

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value) {
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

function titleCase(status) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
}

function badge(status) {
  return `<span class="badge-soft ${STATUS_BADGE[status] || "badge-draft"}">${escapeHtml(titleCase(status))}</span>`;
}

/* ---------- toasts ---------- */
function toast(title, text = "", type = "error") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast-msg" + (type === "success" ? " toast-msg--success" : "");
  el.innerHTML = `
    <span class="toast-msg__icon"><i class="bi ${type === "success" ? "bi-check-lg" : "bi-exclamation-lg"}"></i></span>
    <div class="toast-msg__body">
      <div class="toast-msg__title">${escapeHtml(title)}</div>
      ${text ? `<div class="toast-msg__text">${escapeHtml(text)}</div>` : ""}
    </div>
    <button class="toast-msg__close" aria-label="Dismiss">&times;</button>`;

  const remove = () => el.remove();
  el.querySelector(".toast-msg__close").addEventListener("click", remove);
  stack.appendChild(el);
  setTimeout(remove, 4200);
}

/* ---------- errors ---------- */
function handleError(err) {
  if (err && err.status === 401) {
    API.logout();
    return;
  }
  if (err && err.status === 403) {
    toast("Admins only", "You do not have permission to review applications.");
    return;
  }
  if (err && err.status === undefined) {
    toast("Unable to connect", "Check your connection and try again.");
    return;
  }
  toast(err && err.message ? err.message : "Something went wrong", "Please try again.");
}

/* ---------- data ---------- */
async function loadApplications() {
  const params = new URLSearchParams();
  if (state.status !== "all") params.set("status", state.status);
  params.set("page", String(state.page));
  params.set("limit", String(LIMIT));
  const query = `?${params.toString()}`;

  els.body.innerHTML = `<tr><td colspan="6"><div class="empty-note">Loading applications…</div></td></tr>`;
  els.foot.style.display = "none";

  try {
    const body = await API.adminOrganizerApplications(query);
    state.applications = (body && body.data) || [];
    state.pagination = (body && body.pagination) || { total: state.applications.length, page: 1, limit: LIMIT, pages: 1 };
    renderTable();
    renderPagination();
  } catch (err) {
    els.body.innerHTML = `<tr><td colspan="6"><div class="empty-note">Could not load applications.</div></td></tr>`;
    handleError(err);
  }
}

/* ---------- render ---------- */
function filtered() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.applications;
  return state.applications.filter((a) => {
    const name = (a.user && a.user.name) || "";
    const email = (a.user && a.user.email) || "";
    const org = a.organizationName || "";
    return `${name} ${email} ${org}`.toLowerCase().includes(q);
  });
}

function actionsCell(a) {
  if (a.status === "pending") {
    return `<div class="app-actions">
      <button class="btn-approve" type="button" data-action="approve" data-id="${a._id}">Approve</button>
      <button class="btn-reject" type="button" data-action="reject" data-id="${a._id}">Reject</button>
    </div>`;
  }
  const reviewer = (a.reviewedBy && a.reviewedBy.name) || "—";
  return `<div class="app-reviewed">
    <div class="app-reviewed__name">${escapeHtml(reviewer)}</div>
    <div class="app-reviewed__date">${formatDate(a.reviewedAt)}</div>
  </div>`;
}

function renderTable() {
  const rows = filtered();

  if (!rows.length) {
    els.body.innerHTML = `<tr><td colspan="6"><div class="empty-note">No applications found.</div></td></tr>`;
    return;
  }

  els.body.innerHTML = rows.map((a) => {
    const name = (a.user && a.user.name) || "Unknown";
    const email = (a.user && a.user.email) || "—";
    return `
      <tr class="app-row" data-id="${a._id}">
        <td>
          <div class="app-user">
            <span class="app-avatar">${escapeHtml(initials(name))}</span>
            <span class="app-user__name">${escapeHtml(name)}</span>
          </div>
        </td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(a.organizationName || "—")}</td>
        <td>${formatDate(a.createdAt)}</td>
        <td>${badge(a.status)}</td>
        <td class="app-actions-col">${actionsCell(a)}</td>
      </tr>`;
  }).join("");
}

function renderPagination() {
  const p = state.pagination;
  const pages = p.pages || 1;
  els.foot.style.display = "";
  els.pageInfo.textContent = `Page ${p.page || state.page} of ${pages}`;
  els.prev.disabled = (p.page || state.page) <= 1;
  els.next.disabled = (p.page || state.page) >= pages;
}

/* ---------- drawer ---------- */
function openDrawer(app) {
  const user = app.user || {};
  const reviewedRow = app.reviewedBy
    ? `<div class="detail-row"><dt>Reviewed by</dt><dd>${escapeHtml(app.reviewedBy.name || "—")} · ${formatDate(app.reviewedAt)}</dd></div>`
    : "";

  const actions = app.status === "pending"
    ? `<div class="drawer__actions">
        <button class="btn-approve" type="button" data-action="approve" data-id="${app._id}">Approve</button>
        <button class="btn-reject" type="button" data-action="reject" data-id="${app._id}">Reject</button>
      </div>`
    : `<p class="drawer__hint">This application was already ${escapeHtml(app.status)}.</p>`;

  els.drawerBody.innerHTML = `
    <div class="drawer__applicant">
      <span class="drawer__avatar">${escapeHtml(initials(user.name))}</span>
      <div>
        <div class="drawer__name">${escapeHtml(user.name || "Unknown")}</div>
        <div class="drawer__email">${escapeHtml(user.email || "—")}</div>
      </div>
    </div>

    <dl class="detail-list">
      <div class="detail-row"><dt>Organization</dt><dd>${escapeHtml(app.organizationName || "—")}</dd></div>
      <div class="detail-row"><dt>User role</dt><dd>${escapeHtml(user.role || "—")}</dd></div>
      <div class="detail-row"><dt>User status</dt><dd>${escapeHtml(user.status || "—")}</dd></div>
      <div class="detail-row"><dt>Submitted</dt><dd>${formatDateTime(app.createdAt)}</dd></div>
      <div class="detail-row"><dt>Application status</dt><dd>${badge(app.status)}</dd></div>
      ${reviewedRow}
    </dl>

    <label class="drawer__label" for="reviewNotes">Review notes</label>
    <textarea id="reviewNotes" class="drawer__textarea" rows="4" maxlength="500" placeholder="Add a note for the applicant…">${escapeHtml(app.reviewNotes || "")}</textarea>

    ${actions}`;

  els.drawer.classList.add("is-open");
  els.overlay.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.drawer.classList.remove("is-open");
  els.overlay.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
}

/* ---------- review ---------- */
async function reviewApplication(id, status) {
  const app = state.applications.find((a) => a._id === id);
  if (!app) return;

  const notesEl = document.getElementById("reviewNotes");
  const reviewNotes = notesEl ? notesEl.value.trim() : "";
  const label = status === "approved" ? "Approve" : "Reject";
  const name = (app.user && app.user.name) || "this applicant";

  if (!window.confirm(`${label} ${name}'s application?`)) return;

  const btns = els.drawer.querySelectorAll("[data-action]");
  btns.forEach((b) => (b.disabled = true));

  try {
    await API.reviewOrganizerApplication(id, { status, reviewNotes });
    toast(`Application ${status}`, `${name}'s application has been ${status}.`, "success");
    closeDrawer();
    await loadApplications();
  } catch (err) {
    btns.forEach((b) => (b.disabled = false));
    handleError(err);
  }
}

/* ---------- access denied ---------- */
function renderAccessDenied() {
  els.content.innerHTML = `
    <div class="access-denied">
      <div class="access-denied__icon"><i class="bi bi-shield-lock"></i></div>
      <h2>Admins only</h2>
      <p>This area is restricted to administrators. Head back to your dashboard.</p>
      <a class="btn-brand" href="dashboard.html"><i class="bi bi-arrow-left"></i> Back to dashboard</a>
    </div>`;
}

/* ---------- events ---------- */
function bindEvents() {
  els.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    els.tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    state.status = tab.dataset.status;
    state.page = 1;
    loadApplications();
  });

  els.search.addEventListener("input", () => {
    state.search = els.search.value;
    renderTable();
  });

  els.prev.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadApplications();
  });

  els.next.addEventListener("click", () => {
    if (state.page >= (state.pagination.pages || 1)) return;
    state.page += 1;
    loadApplications();
  });

  els.body.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      e.stopPropagation();
      reviewApplication(actionBtn.dataset.id, actionBtn.dataset.action === "approve" ? "approved" : "rejected");
      return;
    }
    const row = e.target.closest(".app-row");
    if (!row) return;
    const app = state.applications.find((a) => a._id === row.dataset.id);
    if (app) openDrawer(app);
  });

  els.drawerBody.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;
    reviewApplication(actionBtn.dataset.id, actionBtn.dataset.action === "approve" ? "approved" : "rejected");
  });

  els.drawerClose.addEventListener("click", closeDrawer);
  els.overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

}

/* ---------- init ---------- */
async function init() {
  if (!API.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = await API.me();
  } catch (err) {
    if (err.status === 401) { API.logout(); return; }
    handleError(err);
    return;
  }

  if (!user || user.role !== "admin") {
    renderAccessDenied();
    return;
  }

  const nameEl = document.querySelector(".profile__name");
  if (nameEl && user.name) nameEl.textContent = user.name;

  bindEvents();
  loadApplications();
}

document.addEventListener("DOMContentLoaded", init);
