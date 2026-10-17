/* =========================================================
   EventOps Admin · Users / Events / Support (#20)
   GET   /api/admin/users          PATCH /api/admin/users/:id/status
   GET   /api/admin/events
   GET   /api/tickets              PATCH /api/tickets/:id
   ========================================================= */

const ROLE_CLS = { admin: "badge-pending", organizer: "badge-paid", participant: "badge-draft", user: "badge-draft" };
const STATUS_CLS = { active: "badge-active", blocked: "badge-blocked", pending: "badge-pending", approved: "badge-upcoming", rejected: "badge-cancelled" };
const TICKET_CLS = { open: "badge-open", in_progress: "badge-in_progress", resolved: "badge-resolved", closed: "badge-closed" };

const state = {
  users: { list: [], page: 1, pagination: { pages: 1, page: 1 } },
  role: "",
  search: "",
  events: [],
  eventSearch: "",
  tickets: [],
  ticketStatus: "",
  activeTicket: null,
};

const els = {
  tabs: document.getElementById("tabs"),
  panels: {
    users: document.getElementById("panel-users"),
    events: document.getElementById("panel-events"),
    support: document.getElementById("panel-support"),
  },
  roleTabs: document.getElementById("roleTabs"),
  userSearch: document.getElementById("userSearch"),
  userBody: document.getElementById("userBody"),
  userFoot: document.getElementById("userFoot"),
  userPageInfo: document.getElementById("userPageInfo"),
  userPrev: document.getElementById("userPrev"),
  userNext: document.getElementById("userNext"),
  eventSearch: document.getElementById("eventSearch"),
  eventBody: document.getElementById("eventBody"),
  ticketStatusFilter: document.getElementById("ticketStatusFilter"),
  ticketList: document.getElementById("ticketList"),
  ticketDetail: document.getElementById("ticketDetail"),
};

/* ---------------- USERS ---------------- */
async function loadUsers() {
  els.userBody.innerHTML = Views.emptyRow(5, "Loading users…");
  const params = new URLSearchParams();
  if (state.role) params.set("role", state.role);
  if (state.search) params.set("search", state.search);
  params.set("page", String(state.users.page));
  params.set("limit", "10");

  try {
    const body = await API.adminUsers(`?${params.toString()}`);
    state.users.list = (body && body.data) || [];
    state.users.pagination = (body && body.pagination) || { pages: 1, page: 1 };
    renderUsers();
    renderUserFoot();
  } catch (err) {
    els.userBody.innerHTML = Views.emptyRow(5, "Could not load users.");
    Views.handleError(err);
  }
}

function renderUsers() {
  if (!state.users.list.length) {
    els.userBody.innerHTML = Views.emptyRow(5, "No users match your filters.");
    return;
  }
  els.userBody.innerHTML = state.users.list.map((u) => `
    <tr>
      <td>
        <div class="app-user">
          <span class="app-avatar">${Views.escapeHtml(Views.initials(u.name))}</span>
          <span class="app-user__name">${Views.escapeHtml(u.name)}</span>
        </div>
      </td>
      <td>${Views.escapeHtml(u.email)}</td>
      <td><span class="badge-soft ${ROLE_CLS[u.role] || "badge-draft"}">${Views.titleCase(u.role)}</span></td>
      <td><span class="badge-soft ${STATUS_CLS[u.status] || "badge-draft"}">${Views.titleCase(u.status)}</span></td>
      <td class="app-actions-col">
        ${u.role === "admin"
          ? `<span class="muted">Protected</span>`
          : u.status === "blocked"
            ? `<button class="btn btn--sm" type="button" data-unblock="${u._id}">Unblock</button>`
            : `<button class="btn btn--danger btn--sm" type="button" data-block="${u._id}">Block</button>`}
      </td>
    </tr>`).join("");
}

function renderUserFoot() {
  const p = state.users.pagination;
  els.userFoot.style.display = "";
  els.userPageInfo.textContent = `Page ${p.page || 1} of ${p.pages || 1} · ${p.total ?? state.users.list.length} users`;
  els.userPrev.disabled = (p.page || 1) <= 1;
  els.userNext.disabled = (p.page || 1) >= (p.pages || 1);
}

async function setUserStatus(id, status) {
  try {
    await API.updateUserStatus(id, status);
    Views.toast("User updated", `Account ${status === "blocked" ? "blocked" : "reactivated"}.`, "success");
    await loadUsers();
  } catch (err) {
    Views.handleError(err);
  }
}

/* ---------------- EVENTS ---------------- */
async function loadEvents() {
  els.eventBody.innerHTML = Views.emptyRow(6, "Loading events…");
  try {
    state.events = await API.adminEvents();
    renderEvents();
  } catch (err) {
    els.eventBody.innerHTML = Views.emptyRow(6, "Could not load events.");
    Views.handleError(err);
  }
}

function renderEvents() {
  const q = state.eventSearch.trim().toLowerCase();
  const rows = state.events.filter((e) =>
    !q || `${e.title} ${e.organizer?.name || ""} ${e.organizer?.email || ""}`.toLowerCase().includes(q));

  if (!rows.length) {
    els.eventBody.innerHTML = Views.emptyRow(6, "No events match your search.");
    return;
  }
  els.eventBody.innerHTML = rows.map((e) => `
    <tr>
      <td><span class="app-user__name">${Views.escapeHtml(e.title)}</span></td>
      <td>${Views.escapeHtml(e.organizer?.name || "—")}</td>
      <td>${Views.formatDate(e.startsAt)}</td>
      <td><span class="badge-soft ${e.visibility === "private" ? "badge-pending" : "badge-draft"}">${Views.titleCase(e.visibility)}</span></td>
      <td><span class="badge-soft ${e.status === "cancelled" ? "badge-cancelled" : e.status === "completed" ? "badge-completed" : "badge-upcoming"}">${Views.titleCase(e.status)}</span></td>
      <td style="text-align:right;">${Views.money(e.price)}</td>
    </tr>`).join("");
}

/* ---------------- SUPPORT ---------------- */
async function loadTickets() {
  els.ticketList.innerHTML = `<li>${Views.spinner("Loading tickets…")}</li>`;
  const params = new URLSearchParams();
  if (state.ticketStatus) params.set("status", state.ticketStatus);
  params.set("limit", "50");
  try {
    const body = await API.myTickets(`?${params.toString()}`);
    state.tickets = (body && body.data) || [];
    renderTickets();
  } catch (err) {
    els.ticketList.innerHTML = `<li><div class="empty-note">Could not load tickets.</div></li>`;
    Views.handleError(err);
  }
}

function renderTickets() {
  if (!state.tickets.length) {
    els.ticketList.innerHTML = `<li><div class="empty-note">No support tickets.</div></li>`;
    return;
  }
  els.ticketList.innerHTML = state.tickets.map((t) => `
    <li class="ticket-list__item ${state.activeTicket?._id === t._id ? "is-active" : ""}" data-ticket="${t._id}">
      <div class="ticket-list__subject">${Views.escapeHtml(t.subject)}</div>
      <div class="ticket-list__sub">
        <span>${Views.escapeHtml(t.user?.name || "User")} · ${Views.formatDate(t.createdAt)}</span>
        <span class="badge-soft ${TICKET_CLS[t.status] || "badge-draft"}">${Views.titleCase(t.status)}</span>
      </div>
    </li>`).join("");
}

function renderTicketDetail(t) {
  state.activeTicket = t;
  renderTickets();

  const thread = [
    `<div class="bubble bubble--in"><div>${Views.escapeHtml(t.message)}</div><div class="bubble__meta">${Views.escapeHtml(t.user?.name || "User")} · ${Views.formatDateTime(t.createdAt)}</div></div>`,
    ...(t.replies || []).map((r) => {
      const out = r.authorRole === "admin";
      return `<div class="bubble ${out ? "bubble--out" : "bubble--in"}"><div>${Views.escapeHtml(r.message)}</div><div class="bubble__meta">${Views.escapeHtml(r.author?.name || r.authorRole || (out ? "Support" : "User"))} · ${Views.formatDateTime(r.createdAt)}</div></div>`;
    }),
  ].join("");

  els.ticketDetail.innerHTML = `
    <div class="event-head" style="margin-bottom:12px;">
      <div>
        <h3 style="margin:0; font-size:16px;">${Views.escapeHtml(t.subject)}</h3>
        <div class="muted" style="font-size:12.5px;">${Views.escapeHtml(t.user?.email || "")}${t.relatedBooking ? " · linked to a booking" : ""}</div>
      </div>
      <span class="badge-soft ${TICKET_CLS[t.status] || "badge-draft"}">${Views.titleCase(t.status)}</span>
    </div>
    <div class="thread">${thread}</div>
    <div class="field">
      <label class="field__label" for="replyBox">Reply</label>
      <textarea class="textarea" id="replyBox" rows="3" placeholder="Type your reply…"></textarea>
    </div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <select class="select" id="statusSelect" style="width:auto;">
        ${["open", "in_progress", "resolved", "closed"].map((s) => `<option value="${s}"${s === t.status ? " selected" : ""}>${Views.titleCase(s)}</option>`).join("")}
      </select>
      <button class="btn btn--primary" type="button" id="replyBtn"><i class="bi bi-send"></i> Send reply</button>
    </div>`;

  document.getElementById("replyBtn").addEventListener("click", () => submitReply(t._id));
}

async function submitReply(id) {
  const message = document.getElementById("replyBox").value.trim();
  const status = document.getElementById("statusSelect").value;
  if (!message && status === state.activeTicket.status) {
    Views.toast("Nothing to send", "Type a reply or change the status.");
    return;
  }
  const payload = {};
  if (message) payload.message = message;
  if (status !== state.activeTicket.status) payload.status = status;

  const btn = document.getElementById("replyBtn");
  btn.disabled = true;
  try {
    const updated = await API.updateTicket(id, payload);
    Views.toast("Ticket updated", "The reply was saved.", "success");
    renderTicketDetail(updated);
    const idx = state.tickets.findIndex((t) => t._id === id);
    if (idx >= 0) state.tickets[idx] = updated;
  } catch (err) {
    Views.handleError(err);
  } finally {
    btn.disabled = false;
  }
}

async function openTicket(id) {
  try {
    const t = await API.getTicket(id);
    renderTicketDetail(t);
  } catch (err) {
    Views.handleError(err);
  }
}

/* ---------------- tabs ---------------- */
function showTab(tab) {
  els.tabs.querySelectorAll(".tabs__item").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  Object.entries(els.panels).forEach(([key, el]) => { el.hidden = key !== tab; });
  if (tab === "users" && !state.users.list.length) loadUsers();
  if (tab === "events" && !state.events.length) loadEvents();
  if (tab === "support" && !state.tickets.length) loadTickets();
}

function bindEvents() {
  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tabs__item");
    if (btn) showTab(btn.dataset.tab);
  });

  els.roleTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    els.roleTabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    state.role = tab.dataset.role;
    state.users.page = 1;
    loadUsers();
  });

  let searchTimer;
  els.userSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = els.userSearch.value; state.users.page = 1; loadUsers(); }, 300);
  });

  els.userPrev.addEventListener("click", () => { if (state.users.page > 1) { state.users.page--; loadUsers(); } });
  els.userNext.addEventListener("click", () => {
    if (state.users.page < (state.users.pagination.pages || 1)) { state.users.page++; loadUsers(); }
  });

  els.userBody.addEventListener("click", (e) => {
    const block = e.target.closest("[data-block]");
    const unblock = e.target.closest("[data-unblock]");
    if (block) setUserStatus(block.dataset.block, "blocked");
    if (unblock) setUserStatus(unblock.dataset.unblock, "active");
  });

  els.eventSearch.addEventListener("input", () => { state.eventSearch = els.eventSearch.value; renderEvents(); });

  els.ticketStatusFilter.addEventListener("change", () => { state.ticketStatus = els.ticketStatusFilter.value; loadTickets(); });

  els.ticketList.addEventListener("click", (e) => {
    const item = e.target.closest("[data-ticket]");
    if (item) openTicket(item.dataset.ticket);
  });
}

async function init() {
  const user = await Views.requireUser("admin");
  if (!user) return;
  bindEvents();
  loadUsers();
}

document.addEventListener("DOMContentLoaded", init);
