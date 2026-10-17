/* =========================================================
   EventOps · Profile + Become Organizer
   Wired to the backend (no demo data):
     GET  /api/users/me                    (current user)
     PUT  /api/users/me                    (update name)
     GET  /api/organizer-applications/me   (my applications)
     POST /api/organizer-applications      (apply)
   ========================================================= */

/* ---------- status maps (backend → UI) ---------- */
const ROLE_LABEL = { user: "Participant", organizer: "Organizer", admin: "Admin" };
const ROLE_BADGE = { user: "badge-draft", organizer: "badge-upcoming", admin: "badge-upcoming" };

const ACCOUNT_STATUS = {
  pending: { label: "Pending", badge: "badge-pending" },
  approved: { label: "Approved", badge: "badge-upcoming" },
  rejected: { label: "Rejected", badge: "badge-cancelled" },
};

const APP_STATUS = {
  pending: { label: "Pending", badge: "badge-pending" },
  approved: { label: "Approved", badge: "badge-upcoming" },
  rejected: { label: "Rejected", badge: "badge-cancelled" },
};

/* ---------- helpers ---------- */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function showError(el, message) { el.textContent = message; el.hidden = false; }
function clearError(el) { el.textContent = ""; el.hidden = true; }

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

/* ---------- renderers ---------- */
function setTopbarName(name) {
  const el = document.querySelector(".profile__name");
  if (el && name) el.textContent = name;
}

function fillAccount(user) {
  const seed = encodeURIComponent(user.id || user.email || "user");
  document.getElementById("accountAvatar").src = `https://i.pravatar.cc/160?u=${seed}`;
  document.getElementById("accountName").textContent = user.name || "—";
  document.getElementById("accountEmail").textContent = user.email || "—";

  const roleEl = document.getElementById("roleBadge");
  roleEl.textContent = ROLE_LABEL[user.role] || user.role || "—";
  roleEl.className = "badge-soft " + (ROLE_BADGE[user.role] || "badge-draft");

  const st = ACCOUNT_STATUS[user.status] || { label: user.status || "—", badge: "badge-draft" };
  const statusEl = document.getElementById("statusBadge");
  statusEl.textContent = st.label;
  statusEl.className = "badge-soft " + st.badge;

  document.getElementById("nameInput").value = user.name || "";
}

function isApprovedOrganizer(user) {
  return user.role === "organizer" && user.status === "approved";
}

function renderApplyState(user) {
  const applyCard = document.getElementById("applyCard");
  const already = document.getElementById("alreadyOrganizer");
  const formWrap = document.getElementById("applyFormWrap");

  // Admins already manage the platform, so the "Become an organizer" card
  // (and its "you're already an organizer" note) is irrelevant to them.
  if (user.role === "admin") {
    applyCard.hidden = true;
    return;
  }

  applyCard.hidden = false;
  const approved = isApprovedOrganizer(user);
  already.hidden = !approved;
  formWrap.hidden = approved;
}

function applicationItem(app, prominent) {
  const st = APP_STATUS[app.status] || { label: app.status || "—", badge: "badge-draft" };
  const notes = app.reviewNotes
    ? `<p class="app-item__notes"><i class="bi bi-chat-left-text"></i>Review notes: ${escapeHtml(app.reviewNotes)}</p>`
    : "";
  return `
    <article class="app-item${prominent ? " app-item--latest" : ""}">
      <div class="app-item__head">
        <div>
          <div class="app-item__org">${escapeHtml(app.organizationName)}</div>
          <div class="app-item__date"><i class="bi bi-calendar3"></i>Submitted ${formatDate(app.createdAt)}</div>
        </div>
        <span class="badge-soft ${st.badge}">${st.label}</span>
      </div>
      ${notes}
    </article>`;
}

function renderApplications(list) {
  const el = document.getElementById("applicationsList");

  if (!list.length) {
    el.innerHTML = `<div class="empty-note">You haven't submitted an organizer application yet.</div>`;
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [latest, ...rest] = sorted;

  let html = applicationItem(latest, true);
  if (rest.length) {
    html += `
      <div class="app-history">
        <div class="app-history__title">History</div>
        ${rest.map((a) => applicationItem(a, false)).join("")}
      </div>`;
  }
  el.innerHTML = html;
}

/* ---------- data ---------- */
async function loadApplications() {
  try {
    const list = await API.myOrganizerApplications();
    renderApplications(Array.isArray(list) ? list : []);
  } catch (err) {
    if (err.status === 401) { API.logout(); return; }
    renderApplications([]);
  }
}

/* ===================== ACTIONS ===================== */
async function onSaveName(e) {
  e.preventDefault();
  const input = document.getElementById("nameInput");
  const errEl = document.getElementById("nameError");
  const name = input.value.trim();

  if (name.length < 3 || name.length > 30) {
    showError(errEl, "Name must be between 3 and 30 characters.");
    return;
  }
  clearError(errEl);

  const btn = document.getElementById("saveNameBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

  try {
    const user = await API.updateProfile({ name });
    toast("Profile updated", "Your display name has been saved.", "success");
    setTopbarName(name);
    if (user) fillAccount(user);
  } catch (err) {
    if (err.status === 401) {
      toast("Session expired", "Please login again.");
      setTimeout(() => API.logout(), 1200);
      return;
    }
    if (err.status === undefined) {
      showError(errEl, "Unable to connect. Check your connection and try again.");
      return;
    }
    showError(errEl, err.message || "Could not update your name.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function onApply(e) {
  e.preventDefault();
  const input = document.getElementById("orgNameInput");
  const errEl = document.getElementById("orgError");
  const organizationName = input.value.trim();

  if (organizationName.length < 2 || organizationName.length > 100) {
    showError(errEl, "Organization name must be between 2 and 100 characters.");
    return;
  }
  clearError(errEl);

  const btn = document.getElementById("applyBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Submitting...';

  try {
    const body = await API.applyOrganizer({ organizationName });
    toast("Application submitted", (body && body.message) || "We'll review your request shortly.", "success");
    input.value = "";
    await loadApplications();
  } catch (err) {
    if (err.status === 401) {
      toast("Session expired", "Please login again.");
      setTimeout(() => API.logout(), 1200);
      return;
    }
    if (err.status === undefined) {
      showError(errEl, "Unable to connect. Check your connection and try again.");
      return;
    }
    showError(errEl, err.message || "Application failed. Please try again.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

/* ===================== INIT ===================== */
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
    toast("Unable to load your profile", "Check your connection and try again.");
    return;
  }

  fillAccount(user);
  setTopbarName(user.name);
  renderApplyState(user);

  await loadApplications();

  document.getElementById("nameForm").addEventListener("submit", onSaveName);
  document.getElementById("applyForm").addEventListener("submit", onApply);
}

document.addEventListener("DOMContentLoaded", init);
