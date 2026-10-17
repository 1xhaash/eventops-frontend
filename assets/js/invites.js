/* =========================================================
   EventOps Organizer · Private event invites (#14)
   GET   /api/events/:id           (read current invitedEmails / visibility)
   POST  /api/events/:id/invites   { invitedEmails: [] }
   PATCH /api/events/:id           { removeInvitedEmails: [] }  (remove one)
   GET   /api/events/:id/participants  (to mark invitees who joined)
   ========================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const state = { eventId: Views.eventId(), event: null, joined: new Set() };

const els = {
  picker: document.getElementById("eventPicker"),
  sub: document.getElementById("pageSub"),
  notice: document.getElementById("notice"),
  input: document.getElementById("emailsInput"),
  chips: document.getElementById("pendingChips"),
  send: document.getElementById("sendBtn"),
  list: document.getElementById("inviteList"),
  count: document.getElementById("invitedCount"),
};

function parseEmails(text) {
  return [...new Set(
    String(text || "")
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function validPending() {
  return parseEmails(els.input.value).filter((e) => EMAIL_RE.test(e));
}

function renderChips() {
  const emails = parseEmails(els.input.value);
  const bad = emails.filter((e) => !EMAIL_RE.test(e));
  els.chips.innerHTML = emails.map((e) =>
    `<span class="chip" style="${EMAIL_RE.test(e) ? "" : "background:var(--red-soft);color:var(--red);"}">
      ${Views.escapeHtml(e)}${EMAIL_RE.test(e) ? "" : ' <i class="bi bi-exclamation-circle"></i>'}
    </span>`).join("");
  return bad.length;
}

function renderList() {
  const invited = state.event?.invitedEmails || [];
  els.count.textContent = `(${invited.length})`;

  if (!invited.length) {
    els.list.innerHTML = `<li><div class="empty-note">No invitees yet. Add emails to grant access.</div></li>`;
    return;
  }

  els.list.innerHTML = invited.map((email) => {
    const joined = state.joined.has(email);
    return `
      <li class="ticket-list__item" style="cursor:default;">
        <div class="ticket-list__subject">${Views.escapeHtml(email)}</div>
        <div class="ticket-list__sub">
          <span class="badge-soft ${joined ? "badge-upcoming" : "badge-pending"}">${joined ? "Joined" : "Invited"}</span>
          <button class="btn btn--danger btn--sm" type="button" data-remove="${Views.escapeHtml(email)}">Remove</button>
        </div>
      </li>`;
  }).join("");
}

function renderNotice() {
  if (!state.event) { els.notice.innerHTML = ""; return; }
  if (state.event.visibility !== "private") {
    els.notice.innerHTML = `<div class="banner banner--amber"><i class="bi bi-exclamation-triangle"></i> This event is public — invitations are only available for private events. Set visibility to “private” when editing the event.</div>`;
    els.send.disabled = true;
  } else {
    els.notice.innerHTML = `<div class="banner banner--green"><i class="bi bi-shield-lock"></i> This is a private event. Only invited emails can view and book it.</div>`;
    els.send.disabled = false;
  }
}

async function load() {
  if (!state.eventId) {
    els.notice.innerHTML = "";
    els.list.innerHTML = `<li><div class="empty-note">Choose an event to manage its invites.</div></li>`;
    els.sub.textContent = "Select an event from the dropdown to manage its invites.";
    return;
  }

  els.list.innerHTML = `<li>${Views.spinner("Loading invites…")}</li>`;
  try {
    const [event, participants] = await Promise.all([
      API.getEvent(state.eventId),
      API.getParticipants(state.eventId).catch(() => ({ participants: [] })),
    ]);
    state.event = event;
    state.joined = new Set((participants.participants || []).map((p) => (p.user?.email || "").toLowerCase()));
    els.sub.textContent = event ? `${event.title} · ${Views.titleCase(event.visibility)}` : "";
    renderNotice();
    renderList();
  } catch (err) {
    els.list.innerHTML = `<li><div class="empty-note">Could not load this event.</div></li>`;
    Views.handleError(err);
  }
}

async function sendInvites() {
  const emails = validPending();
  if (!emails.length) { Views.toast("Add valid emails", "Enter at least one valid email address."); return; }

  els.send.disabled = true;
  try {
    const event = await API.inviteUsers(state.eventId, emails);
    state.event = event || state.event;
    els.input.value = "";
    renderChips();
    renderList();
    Views.toast("Invites sent", `${emails.length} email(s) invited.`, "success");
  } catch (err) {
    Views.handleError(err);
  } finally {
    els.send.disabled = state.event && state.event.visibility !== "private";
  }
}

async function removeInvite(email) {
  if (!window.confirm(`Remove ${email} from the invite list?`)) return;
  try {
    const event = await API.updateEvent(state.eventId, { removeInvitedEmails: [email] });
    state.event = event || state.event;
    if (state.event && Array.isArray(state.event.invitedEmails)) {
      state.event.invitedEmails = state.event.invitedEmails.filter((e) => e !== email);
    }
    renderList();
    Views.toast("Invite removed", `${email} is no longer invited.`, "success");
  } catch (err) {
    Views.handleError(err);
  }
}

function bindEvents() {
  els.input.addEventListener("input", renderChips);
  els.send.addEventListener("click", sendInvites);
  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (btn) removeInvite(btn.dataset.remove);
  });
}

async function init() {
  const user = await Views.requireUser("organizer");
  if (!user) return;
  bindEvents();
  await Views.bindEventPicker(els.picker);
  load();
}

document.addEventListener("DOMContentLoaded", init);
