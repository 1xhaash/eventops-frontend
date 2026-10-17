/* =========================================================
   EventOps · Support Tickets (#11)
   GET   /api/tickets            POST /api/tickets
   GET   /api/tickets/:id        PATCH /api/tickets/:id  { message }
   GET   /api/bookings/me        (for the related-booking dropdown)
   ========================================================= */

const TICKET_CLS = { open: "badge-open", in_progress: "badge-in_progress", resolved: "badge-resolved", closed: "badge-closed" };

const state = { tickets: [], active: null, status: "" };

const els = {
  list: document.getElementById("ticketList"),
  statusFilter: document.getElementById("statusFilter"),
  newPanel: document.getElementById("newTicketPanel"),
  newBtn: document.getElementById("newTicketBtn"),
  cancelBtn: document.getElementById("cancelTicket"),
  subject: document.getElementById("subject"),
  booking: document.getElementById("booking"),
  message: document.getElementById("message"),
  submit: document.getElementById("submitTicket"),
  detail: document.getElementById("detailBody"),
};

async function loadBookings() {
  try {
    const bookings = await API.myBookings();
    const opts = bookings
      .filter((b) => b.status === "confirmed" || b.status === "pending_payment")
      .map((b) => `<option value="${b._id}">${Views.escapeHtml(b.event?.title || "Booking")} · ${Views.titleCase(b.status)}</option>`)
      .join("");
    els.booking.innerHTML = `<option value="">None</option>${opts}`;
  } catch {
    /* optional */
  }
}

async function loadTickets(keepActive) {
  els.list.innerHTML = `<li>${Views.spinner("Loading tickets…")}</li>`;
  const params = new URLSearchParams();
  if (state.status) params.set("status", state.status);
  try {
    const body = await API.myTickets(params.toString() ? `?${params.toString()}` : "");
    state.tickets = (body && body.data) || [];
    renderList();
    if (keepActive && state.active) {
      const still = state.tickets.find((t) => t._id === state.active._id);
      if (still) renderDetail(still);
    }
  } catch (err) {
    els.list.innerHTML = `<li><div class="empty-note">Could not load tickets.</div></li>`;
    Views.handleError(err);
  }
}

function renderList() {
  if (!state.tickets.length) {
    els.list.innerHTML = `<li><div class="empty-note">No tickets yet. Create one to get help.</div></li>`;
    return;
  }
  els.list.innerHTML = state.tickets.map((t) => `
    <li class="ticket-list__item ${state.active?._id === t._id ? "is-active" : ""}" data-ticket="${t._id}">
      <div class="ticket-list__subject">${Views.escapeHtml(t.subject)}</div>
      <div class="ticket-list__sub">
        <span>${Views.formatDate(t.createdAt)}</span>
        <span class="badge-soft ${TICKET_CLS[t.status] || "badge-draft"}">${Views.titleCase(t.status)}</span>
      </div>
    </li>`).join("");
}

function renderDetail(t) {
  state.active = t;
  renderList();

  const thread = [
    `<div class="bubble bubble--in"><div>${Views.escapeHtml(t.message)}</div><div class="bubble__meta">You · ${Views.formatDateTime(t.createdAt)}</div></div>`,
    ...(t.replies || []).map((r) => {
      const admin = r.authorRole === "admin";
      return `<div class="bubble ${admin ? "bubble--out" : "bubble--in"}"><div>${Views.escapeHtml(r.message)}</div><div class="bubble__meta">${admin ? "Support" : "You"} · ${Views.formatDateTime(r.createdAt)}</div></div>`;
    }),
  ].join("");

  els.detail.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
      <h3 style="margin:0; font-size:16px;">${Views.escapeHtml(t.subject)}</h3>
      <span class="badge-soft ${TICKET_CLS[t.status] || "badge-draft"}">${Views.titleCase(t.status)}</span>
    </div>
    <div class="thread">${thread}</div>
    ${t.status === "closed"
      ? `<p class="muted" style="font-size:13px;">This ticket is closed. Open a new one if you need more help.</p>`
      : `<div class="field"><label class="field__label" for="replyBox">Add a message</label>
           <textarea class="textarea" id="replyBox" rows="3" placeholder="Type a follow-up…"></textarea></div>
         <button class="btn btn--primary" type="button" id="replyBtn"><i class="bi bi-send"></i> Send</button>`}`;

  const replyBtn = document.getElementById("replyBtn");
  if (replyBtn) replyBtn.addEventListener("click", () => sendReply(t._id));
}

async function sendReply(id) {
  const box = document.getElementById("replyBox");
  const message = box.value.trim();
  if (!message) { Views.toast("Type a message", "Your reply cannot be empty."); return; }
  const btn = document.getElementById("replyBtn");
  btn.disabled = true;
  try {
    const updated = await API.updateTicket(id, { message });
    Views.toast("Message sent", "Support will get back to you soon.", "success");
    renderDetail(updated);
    await loadTickets(true);
  } catch (err) {
    Views.handleError(err);
  } finally {
    btn.disabled = false;
  }
}

async function openTicket(id) {
  try {
    const t = await API.getTicket(id);
    renderDetail(t);
  } catch (err) {
    Views.handleError(err);
  }
}

async function submitTicket() {
  const subject = els.subject.value.trim();
  const message = els.message.value.trim();
  const relatedBooking = els.booking.value || null;

  if (subject.length < 3) { Views.toast("Subject too short", "Enter at least 3 characters."); return; }
  if (message.length < 5) { Views.toast("Message too short", "Enter at least 5 characters."); return; }

  els.submit.disabled = true;
  try {
    const ticket = await API.createTicket({ subject, message, relatedBooking });
    Views.toast("Ticket created", "We will get back to you shortly.", "success");
    els.subject.value = "";
    els.message.value = "";
    els.booking.value = "";
    els.newPanel.hidden = true;
    await loadTickets();
    renderDetail(ticket);
  } catch (err) {
    Views.handleError(err);
  } finally {
    els.submit.disabled = false;
  }
}

function bindEvents() {
  els.newBtn.addEventListener("click", () => {
    els.newPanel.hidden = false;
    els.subject.focus();
  });
  els.cancelBtn.addEventListener("click", () => { els.newPanel.hidden = true; });
  els.submit.addEventListener("click", submitTicket);
  els.statusFilter.addEventListener("change", () => { state.status = els.statusFilter.value; loadTickets(); });
  els.list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-ticket]");
    if (item) openTicket(item.dataset.ticket);
  });
}

async function init() {
  const user = await Views.requireUser();
  if (!user) return;
  bindEvents();
  loadBookings();
  loadTickets();
}

document.addEventListener("DOMContentLoaded", init);
