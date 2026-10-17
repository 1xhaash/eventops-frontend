/* =========================================================
   EventOps · Landing / Events Listing
   GET /api/events  (public listing)
   ========================================================= */

const PAGE_SIZE = 8;

/* ---------- element refs ---------- */
const grid = document.getElementById("eventsGrid");
const paginationEl = document.getElementById("pagination");
const resultsCount = document.getElementById("resultsCount");

/* ---------- filter state ---------- */
const initialQuery = new URLSearchParams(window.location.search);
const filters = {
  search: initialQuery.get("search") || "",
  category: "",
  date: "",
  price: "",
  sort: "",
};
let allEvents = [];   // results from API
let visibleEvents = []; // after client-side category filter
let currentPage = 1;

const CATEGORY_KEYWORDS = {
  tech: ["tech", "ai", "software", "summit", "cloud", "data", "developer"],
  business: ["business", "startup", "market", "innovation", "finance", "forum"],
  music: ["music", "concert", "festival", "band", "live"],
  design: ["design", "ux", "ui", "product", "workshop", "creative"],
  food: ["food", "drink", "dinner", "tasting", "culinary", "chef"],
};

/* ---------- helpers ---------- */
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const num = (v) => Number(v || 0).toLocaleString("en-US");

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatDate(value) {
  const d = new Date(value);
  if (!value || isNaN(d)) return "Date TBA";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/* ---------- date-range → query params ---------- */
function dateRangeParams(range) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (range === "today") {
    return { startsAfter: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), startsBefore: endOfToday.toISOString() };
  }
  if (range === "week") {
    return { startsAfter: now.toISOString(), startsBefore: new Date(now.getTime() + 7 * 864e5).toISOString() };
  }
  if (range === "month") {
    return { startsAfter: now.toISOString(), startsBefore: new Date(now.getTime() + 30 * 864e5).toISOString() };
  }
  return {};
}

function buildQuery() {
  const q = new URLSearchParams();

  if (filters.search) q.set("search", filters.search);
  if (filters.sort) q.set("sort", filters.sort);

  if (filters.price === "free") q.set("maxPrice", "0");
  if (filters.price === "paid") q.set("minPrice", "1");

  const range = dateRangeParams(filters.date);
  Object.entries(range).forEach(([k, v]) => q.set(k, v));

  return q.toString();
}

/* ---------- API ---------- */
async function fetchEvents() {
  try {
    const qs = buildQuery();
    return await API.listEvents(qs ? `?${qs}` : "");
  } catch {
    return [];
  }
}

/* ===================== RENDER ===================== */
function skeletons() {
  grid.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-card__media"></div>
        <div class="skeleton-card__body">
          <div class="skeleton skeleton-line w-40"></div>
          <div class="skeleton skeleton-line w-90"></div>
          <div class="skeleton skeleton-line w-60"></div>
        </div>
      </div>`
    )
    .join("");
  paginationEl.innerHTML = "";
}

function categoryMatches(ev, category) {
  if (!category) return true;
  const text = `${ev.title} ${ev.description}`.toLowerCase();
  return (CATEGORY_KEYWORDS[category] || []).some((kw) => text.includes(kw));
}

function eventCard(ev) {
  const isFree = Number(ev.price) === 0;
  const vis = ev.visibility === "private" ? "private" : "public";
  const visIcon = vis === "private" ? "bi-lock" : "bi-globe2";

  return `
    <article class="ev-card">
      <a class="ev-card__link" href="event-details.html?id=${encodeURIComponent(ev._id)}">
        <div class="ev-card__media">
          <span class="badge-soft badge-${vis} ev-card__badge"><i class="bi ${visIcon}"></i> ${vis[0].toUpperCase() + vis.slice(1)}</span>
          <span class="ev-card__price-badge ${isFree ? "is-free" : ""}">${isFree ? "Free" : money(ev.price)}</span>
          <img src="https://picsum.photos/seed/${encodeURIComponent(ev._id || ev.title)}/600/360" alt="${escapeHtml(ev.title)}" loading="lazy" />
        </div>
        <div class="ev-card__body">
          <div class="ev-card__date"><i class="bi bi-calendar3"></i> ${formatDate(ev.startsAt)}</div>
          <h3 class="ev-card__title">${escapeHtml(ev.title)}</h3>
          <div class="ev-card__venue"><i class="bi bi-geo-alt"></i> ${escapeHtml(ev.venue || "Venue TBA")}</div>
          <div class="ev-card__seats" data-seats-for="${escapeHtml(ev._id)}">
            <i class="bi bi-people"></i>
            <span>Checking seats…</span>
          </div>
          <div class="ev-card__foot">
            <span class="ev-card__price ${isFree ? "is-free" : ""}">${isFree ? "Free" : money(ev.price)}</span>
            <span class="ev-card__cta">View details <i class="bi bi-arrow-right"></i></span>
          </div>
        </div>
      </a>
    </article>`;
}

function renderPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageEvents = visibleEvents.slice(start, start + PAGE_SIZE);

  if (!visibleEvents.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i class="bi bi-calendar-x"></i></div>
        <h3>No events found</h3>
        <p>Try changing your filters or search keywords.</p>
      </div>`;
    paginationEl.innerHTML = "";
    return;
  }

  grid.innerHTML = pageEvents.map(eventCard).join("");
  renderPagination();
  refreshSeats(pageEvents);
}

function renderPagination() {
  const totalPages = Math.ceil(visibleEvents.length / PAGE_SIZE);
  if (totalPages <= 1) { paginationEl.innerHTML = ""; return; }

  let html = `
    <button class="page-btn" data-page="prev" ${currentPage === 1 ? "disabled" : ""}>
      <i class="bi bi-chevron-left"></i>
    </button>`;

  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="page-btn ${p === currentPage ? "is-active" : ""}" data-page="${p}">${p}</button>`;
  }

  html += `
    <button class="page-btn" data-page="next" ${currentPage === totalPages ? "disabled" : ""}>
      <i class="bi bi-chevron-right"></i>
    </button>`;

  paginationEl.innerHTML = html;
}

/* ---------- live "seats left" ---------- */
async function refreshSeats(events) {
  await Promise.allSettled(
    events.map(async (ev) => {
      try {
        const seats = await API.getSeats(ev._id);
        if (!seats.length) return;
        const available = seats.filter((s) => s.status === "available").length;
        const holder = document.querySelector(`[data-seats-for="${CSS.escape(ev._id)}"] span`);
        if (holder) {
          const label = available <= 0 ? "Sold out" : `${num(available)} seats left`;
          holder.textContent = label;
        }
      } catch { /* ignore */ }
    })
  );
}

/* ===================== AUTH NAV ===================== */
function renderAuthButtons() {
  const wrap = document.getElementById("authButtons");
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user") || "null"); } catch { user = null; }

  if (user) {
    const initials = (user.name || "U").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const home = user.role === "admin"
      ? { href: "admin-applications.html", label: "Applications" }
      : (user.role === "organizer" && user.status === "approved")
        ? { href: "organizer-dashboard.html", label: "My events" }
        : null;
    wrap.innerHTML = `
      <a class="btn-ghost" href="dashboard.html">Dashboard</a>
      ${home ? `<a class="btn-ghost" href="${home.href}">${home.label}</a>` : ""}
      <span class="profile profile--static">
        <span class="profile__avatar" style="display:grid;place-items:center;background:var(--brand);color:#fff;font-weight:700;font-size:14px">${initials}</span>
        <span class="profile__name">${escapeHtml(user.name || "Account")}</span>
      </span>`;
  } else {
    wrap.innerHTML = `
      <a class="btn-ghost" href="login.html">Login</a>
      <a class="btn-brand" href="signup.html" style="text-decoration:none">Sign up</a>`;
  }
}

async function refreshSession() {
  if (!API.isLoggedIn()) return;

  try {
    await API.me();
  } catch (err) {
    if (err.status === 401) API.clearSession();
  }
}

/* ===================== EVENTS ===================== */
function applyClientFilters() {
  visibleEvents = allEvents.filter((ev) => categoryMatches(ev, filters.category));
}

async function load() {
  skeletons();
  allEvents = await fetchEvents();
  applyClientFilters();
  currentPage = 1;
  resultsCount.textContent = visibleEvents.length ? `(${visibleEvents.length})` : "";
  renderPage();
}

/* ===================== WIRING ===================== */
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function init() {
  await refreshSession();
  renderAuthButtons();
  document.getElementById("searchInput").value = filters.search;

  // search (hero + debounce)
  document.getElementById("heroSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    filters.search = document.getElementById("searchInput").value.trim();
    load();
  });

  document.getElementById("searchInput").addEventListener(
    "input",
    debounce((e) => { filters.search = e.target.value.trim(); load(); }, 450)
  );

  // filters
  document.getElementById("categoryFilter").addEventListener("change", (e) => {
    filters.category = e.target.value;
    applyClientFilters();
    currentPage = 1;
    resultsCount.textContent = visibleEvents.length ? `(${visibleEvents.length})` : "";
    renderPage();
  });

  document.getElementById("dateFilter").addEventListener("change", (e) => {
    filters.date = e.target.value;
    load();
  });

  document.getElementById("priceFilter").addEventListener("change", (e) => {
    filters.price = e.target.value;
    load();
  });

  document.getElementById("sortFilter").addEventListener("change", (e) => {
    filters.sort = e.target.value;
    load();
  });

  // pagination
  paginationEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-btn");
    if (!btn || btn.disabled) return;
    const totalPages = Math.ceil(visibleEvents.length / PAGE_SIZE);
    const target = btn.dataset.page;

    if (target === "prev") currentPage = Math.max(1, currentPage - 1);
    else if (target === "next") currentPage = Math.min(totalPages, currentPage + 1);
    else currentPage = Number(target);

    renderPage();
    document.getElementById("events").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  load();
}

document.addEventListener("DOMContentLoaded", init);
