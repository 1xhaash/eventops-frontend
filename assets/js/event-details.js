/* =========================================================
   EventOps · Event Details page
   GET /api/events/:id  +  GET /api/events/:id/seats
   ========================================================= */

/* event id from ?id=  (fallback: last path segment) */
const params = new URLSearchParams(location.search);
const EVENT_ID = params.get("id") || location.pathname.split("/").pop();

/* ---------- helpers ---------- */
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const num = (v) => Number(v || 0).toLocaleString("en-US");

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function organizerName(org) {
  if (org && typeof org === "object") return org.name || org.email || "EventOps";
  return "EventOps Team";
}

/* ---------- state ---------- */
let state = {
  event: null,
  seats: { total: 0, available: 0, booked: 0 },
};

/* ===================== RENDER ===================== */
function renderBadges(ev) {
  const wrap = document.getElementById("coverBadges");
  const vis = ev.visibility === "private" ? "private" : "public";
  const statusMap = {
    scheduled: { cls: "badge-scheduled", icon: "bi-calendar-check", label: "Scheduled" },
    cancelled: { cls: "badge-cancelled", icon: "bi-x-octagon", label: "Cancelled" },
    completed: { cls: "badge-completed", icon: "bi-check2-circle", label: "Completed" },
  };
  const st = statusMap[ev.status] || statusMap.scheduled;
  const visIcon = vis === "private" ? "bi-lock" : "bi-globe2";

  wrap.innerHTML = `
    <span class="badge-soft ${st.cls}"><i class="bi ${st.icon}"></i> ${st.label}</span>
    <span class="badge-soft badge-${vis}"><i class="bi ${visIcon}"></i> ${vis[0].toUpperCase() + vis.slice(1)}</span>`;
}

function renderInfo(ev) {
  document.getElementById("eventTitle").textContent = ev.title || "Untitled event";
  document.getElementById("eventOrganizer").textContent = organizerName(ev.organizer);

  document.getElementById("infoVenue").textContent = ev.venue || "—";
  document.getElementById("infoStarts").textContent = formatDateTime(ev.startsAt);
  document.getElementById("infoEnds").textContent = formatDateTime(ev.endsAt);
  document.getElementById("infoDeadline").textContent = formatDateTime(ev.registrationDeadline);
  document.getElementById("infoPrice").textContent = ev.price === 0 ? "Free" : money(ev.price);

  document.getElementById("eventDescription").textContent = ev.description || "No description provided.";

  const cover = document.getElementById("coverImage");
  cover.src = `https://picsum.photos/seed/${encodeURIComponent(ev._id || ev.title)}/1200/400`;
  cover.alt = ev.title || "Event cover";
}

function renderCapacity() {
  const ev = state.event;
  const total = Number(ev.capacity) || 0;
  const booked = state.seats.booked;
  const available = Math.max(state.seats.available, 0);
  const pct = total ? Math.min(Math.round((booked / total) * 100), 100) : 0;

  document.getElementById("capacityText").textContent = `${num(booked)} / ${num(total)} booked`;
  document.getElementById("capacityLeft").textContent = `${num(available)} seats left`;
  document.getElementById("bookingSeats").textContent =
    `${num(available)} seats left of ${num(total)}`;

  const fill = document.getElementById("capacityFill");
  fill.style.width = pct + "%";
  fill.classList.toggle("is-full", pct >= 100);
}

function renderBooking() {
  const ev = state.event;
  document.getElementById("bookingPrice").textContent = ev.price === 0 ? "Free" : money(ev.price);

  const btn = document.getElementById("selectSeatBtn");
  const note = document.getElementById("bookingNote");

  const deadlinePassed =
    ev.registrationDeadline && new Date() > new Date(ev.registrationDeadline);
  const notScheduled = ev.status !== "scheduled";
  const soldOut = state.seats.available <= 0 && state.seats.total > 0;

  const closed = deadlinePassed || notScheduled || soldOut;

  btn.disabled = closed;
  btn.innerHTML = closed
    ? '<i class="bi bi-slash-circle"></i> Registration closed'
    : '<i class="bi bi-grid-3x3-gap"></i> Select your seat';

  if (deadlinePassed || notScheduled) {
    note.classList.add("is-visible");
    note.innerHTML = '<i class="bi bi-x-circle"></i> Registration closed';
  } else if (soldOut) {
    note.classList.add("is-visible");
    note.innerHTML = '<i class="bi bi-x-circle"></i> Sold out';
  } else {
    note.classList.remove("is-visible");
  }
}

/* ---------- countdown to registration deadline ---------- */
let countdownTimer = null;

function startCountdown() {
  const el = document.getElementById("countdown");
  const label = el.querySelector("span");
  const deadline = new Date(state.event.registrationDeadline).getTime();

  clearInterval(countdownTimer);

  if (!state.event.registrationDeadline || isNaN(deadline)) {
    el.classList.remove("is-visible");
    return;
  }

  const tick = () => {
    const diff = deadline - Date.now();

    if (diff <= 0) {
      el.classList.remove("is-urgent");
      el.classList.add("is-visible", "is-closed");
      label.textContent = "Registration closed";
      clearInterval(countdownTimer);
      renderBooking();
      return;
    }

    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    el.classList.add("is-visible");
    el.classList.toggle("is-urgent", diff < 24 * 60 * 60 * 1000);
    label.textContent = `Closes in ${d}d ${h}h ${m}m ${sec}s`;
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ===================== LOAD ===================== */
async function loadEvent() {
  try {
    return await API.getEvent(EVENT_ID);
  } catch {
    return null;
  }
}

async function loadSeats(event) {
  const total = Number(event.capacity) || 0;

  try {
    const seats = await API.getSeats(event._id);
    const booked = seats.filter((s) => s.status === "booked").length;
    const held = seats.filter((s) => s.status === "held").length;
    const available = seats.filter((s) => s.status === "available").length;
    return { total, booked: booked + held, available, all: seats };
  } catch {
    return { total, booked: 0, available: total, all: [] };
  }
}

function renderNotFound() {
  document.getElementById("eventTitle").textContent = "Event not found";
  document.getElementById("eventOrganizer").textContent = "—";
  document.getElementById("eventDescription").textContent =
    "This event could not be loaded. It may have been removed or is not public.";
  document.getElementById("coverBadges").innerHTML = "";
  const btn = document.getElementById("selectSeatBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-slash-circle"></i> Unavailable';
}

async function init() {
  const event = await loadEvent();

  if (!event) {
    renderNotFound();
    return;
  }

  const seats = await loadSeats(event);
  state.event = event;
  state.seats = seats;

  renderBadges(event);
  renderInfo(event);
  renderCapacity();
  renderBooking();
  startCountdown();

  document.getElementById("selectSeatBtn").addEventListener("click", () => {
    if (document.getElementById("selectSeatBtn").disabled) return;
    window.location.href = `seat-selection.html?id=${event._id}`;
  });

  document.getElementById("globalSearch").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const search = e.currentTarget.value.trim();
    window.location.href = search
      ? `index.html?search=${encodeURIComponent(search)}`
      : "index.html";
  });
}

document.addEventListener("DOMContentLoaded", init);
