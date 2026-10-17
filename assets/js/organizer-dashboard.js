/* =========================================================
   EventOps · Organizer Dashboard / My events
     GET  /api/events
     GET  /api/events/:id/seats
     POST /api/events/:id/cancel   (organizer only)
   ========================================================= */

const STATUS_MAP = {
  scheduled: { label: "Scheduled", cls: "badge-upcoming" },
  cancelled: { label: "Cancelled", cls: "badge-cancelled" },
  completed: { label: "Completed", cls: "badge-completed" },
};

const NOTE_KEY = "eventops.hideBackendNote";
const SEAT_FETCH_CAP = 20;

/* ---------- helpers ---------- */
const num = (v) => Number(v || 0).toLocaleString("en-US");
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");

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

/* ---------- toasts ---------- */
function toast(title, text = "", type = "error") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
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

function reportError(err, fallback = "Something went wrong") {
  if (err && err.status === 401) { API.logout(); return; }
  const text = err && err.status === 403
    ? "Your organizer account must be approved before managing events."
    : "Please try again.";
  toast((err && err.message) || fallback, text);
}

/* ---------- auth guard ---------- */
function renderOrganizersOnly() {
  document.querySelector(".content").innerHTML = `
    <div class="organizer-only">
      <span class="organizer-only__icon"><i class="bi bi-shield-lock"></i></span>
      <h1 class="organizer-only__title">Organizers only</h1>
      <p class="organizer-only__text">This area is reserved for approved organizer accounts. You're signed in with a different role or your organizer account isn't approved yet.</p>
      <a class="btn-brand" href="dashboard.html"><i class="bi bi-house"></i> Back to dashboard</a>
    </div>`;
}

/* ---------- renderers ---------- */
function renderStats(stats) {
  document.getElementById("statCards").innerHTML = stats
    .map((s) => `
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-card__icon ${s.tint}"><i class="bi ${s.icon}"></i></div>
          <div class="stat-card__label">${s.label}</div>
          <div class="stat-card__value">${s.value}${s.hint ? `<span class="stat-card__hint">${s.hint}</span>` : ""}</div>
        </div>
      </div>`)
    .join("");
}

function renderEvents(events) {
  const el = document.getElementById("eventsWrap");

  if (!events.length) {
    el.innerHTML = `
      <div class="empty-note">
        <div class="empty-note__title">No events yet</div>
        <p class="empty-note__text">You haven't created any events yet.</p>
        <a class="btn-brand" href="create-event.html"><i class="bi bi-plus-lg"></i> Create Event</a>
      </div>`;
    return;
  }

  const rows = events.map((e) => {
    const st = STATUS_MAP[e.status] || { label: e.status || "—", cls: "badge-draft" };
    return `
      <tr>
        <td class="cell-title">${escapeHtml(e.title)}</td>
        <td>${formatDate(e.startsAt)}</td>
        <td>${capacityCell(e)}</td>
        <td><span class="badge-soft ${st.cls}">${escapeHtml(st.label)}</span></td>
        <td class="cell-actions">
          <button class="act-btn" type="button" data-act="edit" data-id="${e._id}"><i class="bi bi-pencil"></i> Edit</button>
          <button class="act-btn" type="button" data-act="participants" data-id="${e._id}"><i class="bi bi-people"></i> Participants</button>
          <button class="act-btn" type="button" data-act="reports" data-id="${e._id}"><i class="bi bi-bar-chart"></i> Reports</button>
          ${e.status === "scheduled"
            ? `<button class="act-btn act-btn--danger" type="button" data-act="cancel" data-id="${e._id}"><i class="bi bi-x-circle"></i> Cancel</button>`
            : ""}
        </td>
      </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="panel table-panel">
      <div class="table-wrap">
        <table class="events-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Capacity filled</th>
              <th>Status</th>
              <th class="ta-r">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function capacityCell(e) {
  const total = Number(e._total) || Number(e.capacity) || 0;
  const filled = e._filled;

  if (filled == null) {
    return `<span class="cap__na">—</span>`;
  }

  const pct = total ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  return `
    <div class="cap">
      <div class="cap__bar"><span style="width:${pct}%"></span></div>
      <span class="cap__text">${num(filled)} / ${num(total)}</span>
    </div>`;
}

/* ---------- derived view models ---------- */
function buildStats(events) {
  const tickets = events.reduce((sum, e) => sum + (Number(e._sold) || 0), 0);
  const revenue = events.reduce((sum, e) => sum + (Number(e._sold) || 0) * (Number(e.price) || 0), 0);

  return [
    { label: "Total events", value: num(events.length), icon: "bi-calendar3", tint: "tint-purple" },
    { label: "Tickets sold", value: num(tickets), icon: "bi-ticket-perforated", tint: "tint-green" },
    { label: "Revenue", value: money(revenue), icon: "bi-cash-stack", tint: "tint-amber" },
    { label: "Check-in rate", value: "—", icon: "bi-qr-code-scan", tint: "tint-purple", hint: "coming soon" },
  ];
}

/* ===================== DATA ===================== */
async function fetchMine() {
  return await API.listEvents("?organizer=me", { auth: true });
}

async function attachSeatCounts(events) {
  const head = events.slice(0, SEAT_FETCH_CAP);

  await Promise.allSettled(
    head.map(async (ev) => {
      try {
        const seats = await API.getSeats(ev._id);
        ev._total = seats.length || Number(ev.capacity) || 0;
        ev._filled = seats.filter((s) => s.status === "booked" || s.status === "held").length;
        ev._sold = seats.filter((s) => s.status === "booked").length;
      } catch {
        ev._total = Number(ev.capacity) || 0;
        ev._filled = 0;
        ev._sold = 0;
      }
    })
  );

  events.slice(SEAT_FETCH_CAP).forEach((ev) => {
    ev._total = Number(ev.capacity) || 0;
    ev._filled = null;
    ev._sold = null;
  });
}

/* ---------- interactions ---------- */
function initBackendNote() {
  const note = document.getElementById("backendNote");
  if (!note) return;
  if (localStorage.getItem(NOTE_KEY) === "1") { note.remove(); return; }
  note.querySelector(".info-note__close").addEventListener("click", () => {
    localStorage.setItem(NOTE_KEY, "1");
    note.remove();
  });
}

async function cancelEvent(id, btn) {
  if (!window.confirm("Cancel this event? This action cannot be undone.")) return;

  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cancelling';

  try {
    const body = await API.cancelEvent(id);
    toast("Event cancelled", (body && body.message) || "The event has been cancelled.", "success");
    await load();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    reportError(err, "Could not cancel the event");
  }
}

function initActions() {
  document.getElementById("eventsWrap").addEventListener("click", (e) => {
    const btn = e.target.closest(".act-btn");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === "edit") {
      window.location.href = `create-event.html?id=${encodeURIComponent(id)}`;
    } else if (act === "cancel") {
      cancelEvent(id, btn);
    } else {
      const name = act === "participants" ? "Participants" : "Reports";
      toast(`${name} not available yet`, "There's no backend endpoint for this yet.");
    }
  });
}

/* ===================== INIT ===================== */
async function load() {
  const wrap = document.getElementById("eventsWrap");
  wrap.innerHTML = `<div class="empty-note empty-note--plain">Loading events…</div>`;

  let events = [];
  try {
    events = await fetchMine();
  } catch (err) {
    if (err && err.status === 401) { API.logout(); return; }
    wrap.innerHTML = `<div class="empty-note">Couldn't load your events. Please refresh.</div>`;
    reportError(err, "Could not load events");
    return;
  }

  await attachSeatCounts(events);
  renderStats(buildStats(events));
  renderEvents(events);
}

async function init() {
  if (!window.API) return;

  if (!API.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = await API.me();
  } catch (err) {
    if (err && err.status === 401) { API.logout(); return; }
    reportError(err, "Could not verify your account");
    return;
  }
  if (!user || user.role !== "organizer" || user.status !== "approved") {
    renderOrganizersOnly();
    return;
  }

  const nameEl = document.querySelector(".profile__name");
  if (nameEl && user.name) nameEl.textContent = user.name;

  initBackendNote();
  initActions();

  await load();
}

document.addEventListener("DOMContentLoaded", init);
