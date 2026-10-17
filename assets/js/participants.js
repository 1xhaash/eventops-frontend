/* =========================================================
   EventOps Organizer · Participants (#15)
   GET   /api/events/:id/participants
   PATCH /api/organizer/bookings/:id/cancel
   ========================================================= */

const state = {
  eventId: Views.eventId(),
  event: null,
  participants: [],
  filter: "all",
  search: "",
  pendingCancel: null,
};

const els = {
  picker: document.getElementById("eventPicker"),
  sub: document.getElementById("pageSub"),
  stats: document.getElementById("statGrid"),
  body: document.getElementById("tableBody"),
  tabs: document.getElementById("statusTabs"),
  search: document.getElementById("searchInput"),
  modal: document.getElementById("cancelModal"),
  modalText: document.getElementById("cancelModalText"),
  modalConfirm: document.getElementById("cancelModalConfirm"),
  modalClose: document.getElementById("cancelModalClose"),
};

function checkInBadge(p) {
  if (p.ticketStatus === "not_issued") return `<span class="badge-soft badge-draft">No ticket</span>`;
  if (p.ticketStatus === "used") return `<span class="badge-soft badge-used">Checked in</span>`;
  if (p.ticketStatus === "revoked") return `<span class="badge-soft badge-revoked">Revoked</span>`;
  return `<span class="badge-soft badge-valid">Not checked in</span>`;
}

function renderStats() {
  const p = state.participants;
  const capacity = state.event?.capacity || 0;
  const checkedIn = p.filter((x) => x.ticketStatus === "used").length;
  const pct = capacity ? Math.round((p.length / capacity) * 100) : 0;

  const card = (icon, tint, label, value) => `
    <div class="stat-card">
      <div class="stat-card__icon ${tint}"><i class="bi ${icon}"></i></div>
      <div class="stat-card__label">${label}</div>
      <div class="stat-card__value">${value}</div>
    </div>`;

  els.stats.innerHTML = `
    ${card("bi-people", "tint-purple", "Confirmed", p.length)}
    ${card("bi-person-check", "tint-green", "Checked in", checkedIn)}
    ${card("bi-hourglass-split", "tint-amber", "Not checked in", p.length - checkedIn)}
    <div class="stat-card">
      <div class="stat-card__icon tint-purple"><i class="bi bi-bar-chart"></i></div>
      <div class="stat-card__label">Capacity filled</div>
      <div class="stat-card__value">${pct}%</div>
      <div class="progress"><div class="progress__bar progress__bar--green" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
}

function filtered() {
  let rows = state.participants;
  if (state.filter === "checkedIn") rows = rows.filter((p) => p.ticketStatus === "used");
  if (state.filter === "notCheckedIn") rows = rows.filter((p) => p.ticketStatus !== "used");

  const q = state.search.trim().toLowerCase();
  if (q) {
    rows = rows.filter((p) => {
      const name = p.user?.name || "";
      const email = p.user?.email || "";
      const seat = p.seat || "";
      return `${name} ${email} ${seat}`.toLowerCase().includes(q);
    });
  }
  return rows;
}

function renderTable() {
  const rows = filtered();
  if (!rows.length) {
    els.body.innerHTML = Views.emptyRow(7, "No participants match your filters.");
    return;
  }

  els.body.innerHTML = rows.map((p) => {
    const name = p.user?.name || "Unknown";
    const email = p.user?.email || "—";
    return `
      <tr>
        <td>
          <div class="app-user">
            <span class="app-avatar">${Views.escapeHtml(Views.initials(name))}</span>
            <span class="app-user__name">${Views.escapeHtml(name)}</span>
          </div>
        </td>
        <td>${Views.escapeHtml(email)}</td>
        <td>${p.seat ? `<strong>${Views.escapeHtml(p.seat)}</strong>` : "—"}</td>
        <td><span class="badge-soft badge-upcoming">Confirmed</span></td>
        <td><span class="badge-soft badge-paid">Paid</span></td>
        <td>${checkInBadge(p)}</td>
        <td class="app-actions-col">
          <button class="btn btn--danger btn--sm" type="button" data-cancel="${p.booking}" data-name="${Views.escapeHtml(name)}">Cancel</button>
        </td>
      </tr>`;
  }).join("");
}

async function load() {
  if (!state.eventId) {
    els.body.innerHTML = Views.emptyRow(7, "Choose an event to see its participants.");
    els.stats.innerHTML = "";
    els.sub.textContent = "Select an event from the dropdown to view its participants.";
    return;
  }

  els.body.innerHTML = `<tr><td colspan="7">${Views.spinner("Loading participants…")}</td></tr>`;
  try {
    const data = await API.getParticipants(state.eventId);
    state.event = data.event || null;
    state.participants = data.participants || [];
    els.sub.textContent = state.event
      ? `${state.event.title} · ${Views.formatDate(state.event.startsAt)}`
      : "Confirmed attendees for your event.";
    renderStats();
    renderTable();
  } catch (err) {
    els.body.innerHTML = Views.emptyRow(7, "Could not load participants.");
    Views.handleError(err);
  }
}

/* ---------- cancel booking ---------- */
function openCancel(bookingId, name) {
  state.pendingCancel = bookingId;
  els.modalText.textContent = `The confirmed booking for ${name} will be cancelled and their seat released.`;
  els.modal.classList.add("is-open");
}

function closeCancel() {
  state.pendingCancel = null;
  els.modal.classList.remove("is-open");
}

async function confirmCancel() {
  if (!state.pendingCancel) return;
  const id = state.pendingCancel;
  els.modalConfirm.disabled = true;
  try {
    await API.request(API.endpoints.cancelBooking(id), { method: "PATCH", auth: true });
    Views.toast("Booking cancelled", "The seat has been released.", "success");
    closeCancel();
    await load();
  } catch (err) {
    Views.handleError(err);
  } finally {
    els.modalConfirm.disabled = false;
  }
}

/* ---------- events ---------- */
function bindEvents() {
  els.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    els.tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    state.filter = tab.dataset.filter;
    renderTable();
  });

  els.search.addEventListener("input", () => {
    state.search = els.search.value;
    renderTable();
  });

  els.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cancel]");
    if (btn) openCancel(btn.dataset.cancel, btn.dataset.name);
  });

  els.modalClose.addEventListener("click", closeCancel);
  els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeCancel(); });
  els.modalConfirm.addEventListener("click", confirmCancel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCancel(); });
}

async function init() {
  const user = await Views.requireUser("organizer");
  if (!user) return;
  bindEvents();
  await Views.bindEventPicker(els.picker);
  load();
}

document.addEventListener("DOMContentLoaded", init);
