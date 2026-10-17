/* =========================================================
   EventOps Organizer · Check-in (#16)
   POST /api/events/:id/check-in   { qrToken }
   ========================================================= */

const state = {
  eventId: Views.eventId(),
  capacity: 0,
  byBooking: new Map(),
  checkedIn: 0,
};

const els = {
  picker: document.getElementById("eventPicker"),
  sub: document.getElementById("pageSub"),
  token: document.getElementById("manualToken"),
  btn: document.getElementById("manualBtn"),
  result: document.getElementById("resultCard"),
  checkedCount: document.getElementById("checkedCount"),
  capacityText: document.getElementById("capacityText"),
  bar: document.getElementById("attendanceBar"),
};

function setResult(kind, icon, title, meta) {
  els.result.className = `scan-result scan-result--${kind}`;
  els.result.innerHTML = `
    <div class="scan-result__icon"><i class="bi ${icon}"></i></div>
    <h2 class="scan-result__name">${Views.escapeHtml(title)}</h2>
    <p class="scan-result__meta">${meta}</p>`;
}

function updateCounter() {
  els.checkedCount.textContent = state.checkedIn;
  els.capacityText.textContent = `/ ${state.capacity} checked in`;
  const pct = state.capacity ? Math.round((state.checkedIn / state.capacity) * 100) : 0;
  els.bar.style.width = `${Math.min(pct, 100)}%`;
}

async function loadParticipants() {
  if (!state.eventId) return;
  try {
    const data = await API.getParticipants(state.eventId);
    state.capacity = data.event?.capacity || 0;
    state.byBooking = new Map();
    let checked = 0;
    (data.participants || []).forEach((p) => {
      state.byBooking.set(String(p.booking), p);
      if (p.ticketStatus === "used") checked += 1;
    });
    state.checkedIn = checked;
    if (data.event) els.sub.textContent = `${data.event.title} · ${Views.formatDate(data.event.startsAt)}`;
    updateCounter();
  } catch (err) {
    Views.handleError(err);
  }
}

async function doCheckIn(token) {
  if (!state.eventId) {
    Views.toast("Choose an event", "Select the event you are checking in for.");
    return;
  }
  const value = String(token || "").trim();
  if (!value) {
    Views.toast("Enter a token", "Paste the ticket QR token first.");
    return;
  }

  els.btn.disabled = true;
  try {
    const ticket = await API.checkIn(state.eventId, value);
    const p = ticket && ticket.booking ? state.byBooking.get(String(ticket.booking)) : null;
    const name = p?.user?.name || "Attendee";
    const seat = p?.seat ? ` · Seat ${p.seat}` : "";
    setResult("success", "bi-check-circle-fill", `${name} checked in`,
      `${seat ? seat.replace(" · ", "") : "No seat"} · checked in at ${Views.formatTime(ticket?.checkedInAt || new Date())}`);
    Views.toast("Check-in successful", `${name} is checked in.`, "success");
    els.token.value = "";
    await loadParticipants();
  } catch (err) {
    const msg = (err && err.message) || "Check-in failed";
    if (err && err.status === 409) {
      setResult("error", "bi-x-octagon-fill", "Already checked in", Views.escapeHtml(msg));
    } else if (err && err.status === 400) {
      setResult("warn", "bi-exclamation-triangle-fill", "Wrong event", Views.escapeHtml(msg));
    } else if (err && err.status === 404) {
      setResult("error", "bi-question-circle-fill", "Ticket not found", "No ticket matches that token.");
    } else {
      setResult("error", "bi-x-octagon-fill", "Check-in failed", Views.escapeHtml(msg));
      Views.handleError(err);
    }
  } finally {
    els.btn.disabled = false;
  }
}

function bindEvents() {
  els.btn.addEventListener("click", () => doCheckIn(els.token.value));
  els.token.addEventListener("keydown", (e) => { if (e.key === "Enter") doCheckIn(els.token.value); });
}

async function init() {
  const user = await Views.requireUser("organizer");
  if (!user) return;
  bindEvents();
  await Views.bindEventPicker(els.picker, { excludeCancelled: true });
  await loadParticipants();
}

document.addEventListener("DOMContentLoaded", init);
