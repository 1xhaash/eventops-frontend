/* =========================================================
   EventOps Dashboard — role-aware
   The same page adapts to the signed-in user's role using the
   functions that actually exist in the backend:

     participant (role "user")
       GET /api/users/me · GET /api/events · GET /api/bookings/me
     organizer (role "organizer" + approved)
       GET /api/events?organizer=me · GET /api/events/:id/seats
     admin
       GET /api/admin/organizer-applications (counts) · GET /api/events
   ========================================================= */

/* ---------- status maps (backend → UI) ---------- */
const STATUS_LABEL = { scheduled: "Upcoming", cancelled: "Cancelled", completed: "Completed" };

const BADGE_CLASS = {
  Upcoming: "badge-upcoming",
  Pending: "badge-pending",
  Draft: "badge-draft",
  Completed: "badge-completed",
  Cancelled: "badge-cancelled",
};

const DOT_COLOR = {
  Upcoming: "#16a34a",
  Pending: "#d97706",
  Draft: "#8a8fa3",
  Completed: "#6b7180",
  Cancelled: "#e23b3b",
};

/* ---------- helpers ---------- */
const num = (v) => Number(v || 0).toLocaleString("en-US");
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const label = (status) => STATUS_LABEL[status] || "Upcoming";

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

function formatTimeRange(start, end) {
  const fmt = (v) => {
    const d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function greetingText(name) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return name
    ? `Good ${part}, ${escapeHtml(name)} <span class="wave">👋</span>`
    : `Good ${part} <span class="wave">👋</span>`;
}

/* Which dashboard flavour applies to a user. */
function roleKind(user) {
  if (!user) return "participant";
  if (user.role === "admin") return "admin";
  if (user.role === "organizer" && user.status === "approved") return "organizer";
  return "participant";
}

/* ---------- renderers ---------- */
function renderStats(stats) {
  document.getElementById("statCards").innerHTML = stats
    .map((s) => `
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-card__icon ${s.tint}"><i class="bi ${s.icon}"></i></div>
          <div class="stat-card__label">${s.label}</div>
          <div class="stat-card__value">${s.value}</div>
        </div>
      </div>`)
    .join("");
}

function renderEvents(events) {
  const el = document.getElementById("eventList");

  if (!events.length) {
    el.innerHTML = `<div class="empty-note">No events found.</div>`;
    return;
  }

  el.innerHTML = events
    .map((e) => {
      const booked = e._booked ?? 0;
      const total = e._total ?? (Number(e.capacity) || 0);
      const left = Math.max(total - booked, 0);
      const status = label(e.status);
      const image = e.image || `https://picsum.photos/seed/${encodeURIComponent(e._id || e.title)}/300/220`;
      return `
        <article class="event-card" data-status="${status}">
          <img class="event-card__thumb" src="${image}" alt="${escapeHtml(e.title)}" loading="lazy" />
          <div class="event-card__body">
            <div class="event-card__info">
              <div class="event-card__top">
                <span class="badge-soft ${BADGE_CLASS[status] || "badge-draft"}">${status}</span>
                <a class="dots-btn" href="event-details.html?id=${encodeURIComponent(e._id)}" aria-label="View ${escapeHtml(e.title)}"><i class="bi bi-three-dots"></i></a>
              </div>
              <h3 class="event-card__title">${escapeHtml(e.title)}</h3>
              <p class="event-card__desc">${escapeHtml(e.description)}</p>
              <div class="event-card__meta">
                <span><i class="bi bi-calendar3"></i>${formatDate(e.startsAt)} &nbsp; ${formatTimeRange(e.startsAt, e.endsAt)}</span>
                <span><i class="bi bi-geo-alt"></i>${escapeHtml(e.venue)}</span>
              </div>
            </div>
            <div class="event-card__side">
              <div>
                <div class="event-card__price">${Number(e.price) === 0 ? "Free" : money(e.price)}<small>per ticket</small></div>
                <div class="event-card__seats">
                  <i class="bi bi-people"></i>
                  <div>${num(booked)} / ${num(total)}<small>${num(left)} seats left</small></div>
                </div>
              </div>
              <button class="btn-view" type="button" data-id="${e._id}">View Details</button>
            </div>
          </div>
        </article>`;
    })
    .join("");
}

function renderTimeline(items) {
  const el = document.getElementById("timeline");

  if (!items.length) {
    el.innerHTML = `<li class="empty-note empty-note--plain">No events scheduled today.</li>`;
    return;
  }

  el.innerHTML = items
    .map((t) => {
      const color = DOT_COLOR[t.status] || "#5b4de8";
      return `
        <li class="timeline__item">
          <span class="timeline__dot" style="background:${color};color:${color}"></span>
          <div class="timeline__time">${t.time}</div>
          <div class="timeline__row">
            <div>
              <div class="timeline__name">${escapeHtml(t.name)}</div>
              <div class="timeline__venue">${escapeHtml(t.venue)}</div>
            </div>
            <span class="badge-soft ${BADGE_CLASS[t.status] || "badge-draft"}">${t.status}</span>
          </div>
        </li>`;
    })
    .join("");
}

function renderQuickStats(items) {
  document.getElementById("quickStats").innerHTML = items
    .map((q) => `
      <li class="quick-stats__item">
        <span class="quick-stats__icon ${q.tint}"><i class="bi ${q.icon}"></i></span>
        <span class="quick-stats__label">${q.label}</span>
        <span class="quick-stats__value">${q.value}</span>
      </li>`)
    .join("");
}

/* ===================== DATA ===================== */
async function fetchApplicationCounts() {
  const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  await Promise.allSettled(
    ["pending", "approved", "rejected"].map(async (status) => {
      const body = await API.adminOrganizerApplications(`?status=${status}&limit=1`);
      counts[status] = (body && body.pagination && body.pagination.total) || 0;
    })
  );
  counts.total = counts.pending + counts.approved + counts.rejected;
  return counts;
}

async function fetchDashboardData(kind) {
  let user = null;
  try {
    user = await API.me();
  } catch (err) {
    if (err && err.status === 401) {
      API.clearSession();
      window.location.href = "login.html";
      return null;
    }
  }

  let events = [];
  let bookings = [];
  let counts = null;

  if (kind === "organizer") {
    try { events = await API.listEvents("?organizer=me", { auth: true }); } catch { events = []; }
  } else {
    try { events = await API.listEvents(); } catch { events = []; }
  }

  if (kind === "participant") {
    try { bookings = await API.myBookings(); } catch { bookings = []; }
  }

  if (kind === "admin") {
    counts = await fetchApplicationCounts();
  }

  return { events, bookings, user, counts };
}

async function attachSeatCounts(events) {
  await Promise.allSettled(
    events.slice(0, 6).map(async (ev) => {
      if (ev._booked != null) return;
      try {
        const seats = await API.getSeats(ev._id);
        if (!seats.length) return;
        ev._booked = seats.filter((s) => s.status === "booked" || s.status === "held").length;
        ev._sold = seats.filter((s) => s.status === "booked").length;
        ev._total = seats.length;
      } catch { /* keep capacity */ }
    })
  );
}

/* ---------- derived view models ---------- */
function buildStats(kind, { events = [], bookings = [], counts = null } = {}) {
  if (kind === "admin") {
    const c = counts || { pending: 0, approved: 0, rejected: 0, total: 0 };
    return [
      { label: "Pending applications", value: num(c.pending), icon: "bi-hourglass-split", tint: "tint-amber" },
      { label: "Approved applicants", value: num(c.approved), icon: "bi-patch-check", tint: "tint-green" },
      { label: "Rejected applicants", value: num(c.rejected), icon: "bi-x-circle", tint: "tint-red" },
      { label: "Total applications", value: num(c.total), icon: "bi-clipboard-check", tint: "tint-purple" },
    ];
  }

  if (kind === "organizer") {
    const sold = events.reduce((sum, e) => sum + (Number(e._sold) || 0), 0);
    const revenue = events.reduce((sum, e) => sum + (Number(e._sold) || 0) * (Number(e.price) || 0), 0);
    return [
      { label: "My events", value: num(events.length), icon: "bi-calendar3", tint: "tint-purple" },
      { label: "Scheduled", value: num(events.filter((e) => e.status === "scheduled").length), icon: "bi-calendar-check", tint: "tint-green" },
      { label: "Tickets sold", value: num(sold), icon: "bi-ticket-perforated", tint: "tint-purple" },
      { label: "Revenue", value: money(revenue), icon: "bi-cash-stack", tint: "tint-amber" },
    ];
  }

  const active = bookings.filter((b) => ["confirmed", "pending_payment"].includes(b.status));
  return [
    { label: "Active bookings", value: num(active.length), icon: "bi-ticket-perforated", tint: "tint-purple" },
    { label: "Confirmed", value: num(bookings.filter((b) => b.status === "confirmed").length), icon: "bi-check-circle", tint: "tint-green" },
    { label: "Pending payment", value: num(bookings.filter((b) => b.status === "pending_payment").length), icon: "bi-clock", tint: "tint-amber" },
    { label: "Cancelled", value: num(bookings.filter((b) => b.status === "cancelled").length), icon: "bi-x-circle", tint: "tint-red" },
  ];
}

function bookingsForPeriod(bookings, period) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return bookings.filter((booking) => {
    const created = new Date(booking.createdAt);
    if (isNaN(created)) return false;
    if (period === "Last Month") {
      const previous = new Date(currentYear, currentMonth - 1, 1);
      return created.getFullYear() === previous.getFullYear() && created.getMonth() === previous.getMonth();
    }
    if (period === "This Year") return created.getFullYear() === currentYear;
    return created.getFullYear() === currentYear && created.getMonth() === currentMonth;
  });
}

function buildQuickStats(kind, { bookings = [], events = [], counts = null, period = "This Month" } = {}) {
  if (kind === "admin") {
    const c = counts || { pending: 0, approved: 0, rejected: 0, total: 0 };
    return [
      { label: "Pending applications", value: num(c.pending), icon: "bi-hourglass-split", tint: "tint-amber" },
      { label: "Approved applicants", value: num(c.approved), icon: "bi-patch-check", tint: "tint-green" },
      { label: "Rejected applicants", value: num(c.rejected), icon: "bi-x-circle", tint: "tint-red" },
      { label: "Total applications", value: num(c.total), icon: "bi-clipboard-check", tint: "tint-purple" },
    ];
  }

  if (kind === "organizer") {
    return [
      { label: "Scheduled events", value: num(events.filter((e) => e.status === "scheduled").length), icon: "bi-calendar-check", tint: "tint-green" },
      { label: "Cancelled events", value: num(events.filter((e) => e.status === "cancelled").length), icon: "bi-x-circle", tint: "tint-red" },
      { label: "Completed events", value: num(events.filter((e) => e.status === "completed").length), icon: "bi-check2-circle", tint: "tint-purple" },
      { label: "Total events", value: num(events.length), icon: "bi-calendar3", tint: "tint-purple" },
    ];
  }

  const scoped = bookingsForPeriod(bookings, period);
  return [
    { label: "Confirmed bookings", value: num(scoped.filter((b) => b.status === "confirmed").length), icon: "bi-ticket-perforated", tint: "tint-purple" },
    { label: "Cancelled bookings", value: num(scoped.filter((b) => b.status === "cancelled").length), icon: "bi-x-circle", tint: "tint-red" },
    { label: "Pending payment", value: num(scoped.filter((b) => b.status === "pending_payment").length), icon: "bi-clock", tint: "tint-amber" },
    { label: "Total bookings", value: num(scoped.length), icon: "bi-bar-chart-line", tint: "tint-purple" },
  ];
}

function buildTimeline(events) {
  const isToday = (v) => {
    const d = new Date(v);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };

  let source = events.filter((e) => isToday(e.startsAt));
  if (!source.length) source = events.slice(0, 4);

  return source.slice(0, 5).map((e) => ({
    time: new Date(e.startsAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    name: e.title,
    venue: e.venue,
    status: label(e.status),
  }));
}

/* ---------- role-specific shell (titles, CTAs, links) ---------- */
function applyRoleShell(kind, user) {
  document.querySelector(".page-head__title").innerHTML =
    greetingText(user && user.name ? user.name.split(" ")[0] : "");

  const nameEl = document.querySelector(".profile__name");
  if (nameEl && user && user.name) nameEl.textContent = user.name;

  const createBtn = document.getElementById("createEventBtn");
  if (createBtn) createBtn.hidden = kind !== "organizer";

  const sectionTitle = document.querySelector(".section-head__title");
  const sectionLink = document.querySelector(".section-head__link");
  const ctaTitle = document.querySelector(".cta-card h4");
  const ctaText = document.querySelector(".cta-card p");
  const ctaIcon = document.querySelector(".cta-card__icon");
  const ctaBtn = document.getElementById("createEventCta");
  const periodPanel = document.getElementById("periodSelect") ? document.getElementById("periodSelect").closest(".panel") : null;

  if (kind === "organizer") {
    if (sectionTitle) sectionTitle.textContent = "My Events";
    if (sectionLink) { sectionLink.href = "organizer-dashboard.html"; sectionLink.innerHTML = `Manage <i class="bi bi-arrow-right"></i>`; }
    if (ctaTitle) ctaTitle.textContent = "Ready to host?";
    if (ctaText) ctaText.textContent = "Create and manage your events in just a few clicks.";
    if (ctaIcon) ctaIcon.className = "bi bi-plus-square cta-card__icon";
    if (ctaBtn) {
      ctaBtn.innerHTML = `Create Event <i class="bi bi-arrow-right"></i>`;
      ctaBtn.onclick = () => { window.location.href = "create-event.html"; };
    }
    if (periodPanel) periodPanel.hidden = true;
  } else if (kind === "admin") {
    if (sectionTitle) sectionTitle.textContent = "Upcoming Events";
    if (sectionLink) { sectionLink.href = "index.html"; sectionLink.innerHTML = `View all <i class="bi bi-arrow-right"></i>`; }
    if (ctaTitle) ctaTitle.textContent = "Organizer applications";
    if (ctaText) ctaText.textContent = "Review requests from participants who want to become organizers.";
    if (ctaIcon) ctaIcon.className = "bi bi-clipboard-check cta-card__icon";
    if (ctaBtn) {
      ctaBtn.innerHTML = `Review applications <i class="bi bi-arrow-right"></i>`;
      ctaBtn.onclick = () => { window.location.href = "admin-applications.html"; };
    }
    if (periodPanel) periodPanel.hidden = true;
  } else {
    if (sectionTitle) sectionTitle.textContent = "Upcoming Events";
    if (sectionLink) { sectionLink.href = "index.html"; sectionLink.innerHTML = `View all <i class="bi bi-arrow-right"></i>`; }
    if (ctaTitle) ctaTitle.textContent = "Looking for your next event?";
    if (ctaText) ctaText.textContent = "Browse what's happening and book your seat in seconds.";
    if (ctaIcon) ctaIcon.className = "bi bi-calendar2-check cta-card__icon";
    if (ctaBtn) {
      ctaBtn.innerHTML = `Browse events <i class="bi bi-arrow-right"></i>`;
      ctaBtn.onclick = () => { window.location.href = "index.html"; };
    }
  }
}

/* ---------- interactions ---------- */
function initSearch() {
  const input = document.getElementById("globalSearch");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll("#eventList .event-card").forEach((card) => {
      card.style.display = card.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

function initEventLinks() {
  document.getElementById("eventList").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-view");
    if (!btn || !btn.dataset.id) return;
    window.location.href = `event-details.html?id=${encodeURIComponent(btn.dataset.id)}`;
  });
}

/* ===================== INIT ===================== */
async function init() {
  if (!API.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const kind = roleKind(API.getUser());
  const data = await fetchDashboardData(kind);
  if (!data) return;

  const { events, bookings, user, counts } = data;
  const finalKind = user ? roleKind(user) : kind;

  await attachSeatCounts(events);
  applyRoleShell(finalKind, user);

  renderStats(buildStats(finalKind, { events, bookings, counts }));
  renderEvents(events.slice(0, 6));
  renderTimeline(buildTimeline(events));

  const periodSelect = document.getElementById("periodSelect");
  renderQuickStats(buildQuickStats(finalKind, { bookings, events, counts, period: periodSelect.value }));

  initSearch();
  initEventLinks();

  const goToCreateEvent = () => { window.location.href = "create-event.html"; };
  const createBtn = document.getElementById("createEventBtn");
  if (createBtn) createBtn.addEventListener("click", goToCreateEvent);

  if (finalKind === "participant") {
    periodSelect.addEventListener("change", () => {
      renderQuickStats(buildQuickStats("participant", { bookings, period: periodSelect.value }));
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
