/* =========================================================
   EventOps · Shared app shell (sidebar + topbar)

   Renders ONE consistent sidebar on every page, and turns the
   topbar into working controls:
     · the bell  → a notifications panel built from real endpoints
     · the user  → a menu with Profile / My bookings / Support / Sign out

   Usage: load after api.js and before the page script.
     <script src="assets/js/api.js"></script>
     <script src="assets/js/layout.js"></script>
     <script src="assets/js/<page>.js"></script>
   ========================================================= */

window.Layout = (function () {
  /* Single source of truth for the sidebar. Order is fixed for every
     role; `organizer`/`admin` items only appear for those roles. */
  const NAV = [
    { page: "dashboard",   href: "dashboard.html",          icon: "bi-house",           label: "Dashboard" },
    { page: "events",      href: "index.html",              icon: "bi-calendar3",       label: "Browse events" },
    { page: "bookings",    href: "my-bookings.html",        icon: "bi-ticket-perforated", label: "My bookings" },
    { page: "support",     href: "support.html",            icon: "bi-life-preserver",  label: "Support" },
    { page: "profile",     href: "profile.html",            icon: "bi-person",          label: "Profile" },
    { page: "organizer",   href: "organizer-dashboard.html", icon: "bi-briefcase",      label: "Organizer dashboard", organizer: true },
    { page: "create-event", href: "create-event.html",      icon: "bi-plus-square",     label: "Create event",        organizer: true },
    { page: "participants", href: "participants.html",      icon: "bi-people",          label: "Participants",        organizer: true },
    { page: "check-in",    href: "check-in.html",           icon: "bi-qr-code-scan",    label: "Check-in",            organizer: true },
    { page: "invites",     href: "invites.html",            icon: "bi-envelope-paper",  label: "Invites",             organizer: true },
    { page: "reports",     href: "reports.html",            icon: "bi-graph-up",        label: "Reports",             organizer: true },
    { page: "admin",       href: "admin-dashboard.html",    icon: "bi-speedometer2",    label: "Admin overview",      admin: true },
    { page: "admin-apps",  href: "admin-applications.html", icon: "bi-clipboard-check", label: "Organizer applications", admin: true },
    { page: "admin-users", href: "admin-users.html",        icon: "bi-people-fill",     label: "Users & events",      admin: true },
  ];

  /* Which sidebar item is "active" for a given file. */
  const PAGE_BY_FILE = {
    "dashboard.html": "dashboard",
    "index.html": "events",
    "event-details.html": "events",
    "seat-selection.html": "events",
    "my-bookings.html": "bookings",
    "ticket.html": "bookings",
    "checkout.html": "bookings",
    "payment-result.html": "bookings",
    "support.html": "support",
    "profile.html": "profile",
    "organizer-dashboard.html": "organizer",
    "create-event.html": "create-event",
    "participants.html": "participants",
    "check-in.html": "check-in",
    "invites.html": "invites",
    "reports.html": "reports",
    "admin-dashboard.html": "admin",
    "admin-applications.html": "admin-apps",
    "admin-users.html": "admin-users",
  };

  /* ---------- small helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const initials = (name) =>
    String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

  function formatDate(value) {
    const d = new Date(value);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function relTime(value) {
    const d = new Date(value);
    if (isNaN(d)) return "";
    const diff = Date.now() - d.getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day}d ago`;
    return formatDate(value);
  }

  function currentFile() {
    return (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
  }

  function canSee(item, user) {
    const role = user && user.role;
    if (item.admin) return role === "admin";
    if (item.organizer) return role === "organizer" && user.status === "approved";
    return true;
  }

  /* ---------- sidebar ---------- */
  function renderSidebar(user) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const active = PAGE_BY_FILE[currentFile()] || "";
    const links = NAV.filter((item) => canSee(item, user))
      .map(
        (item) => `
        <a class="sidebar__link${item.page === active ? " is-active" : ""}" href="${item.href}">
          <i class="bi ${item.icon}"></i><span>${item.label}</span>
        </a>`
      )
      .join("");

    sidebar.innerHTML = `<nav class="sidebar__nav">${links}</nav>`;
  }

  /* ---------- topbar ---------- */
  function renderTopbar(user) {
    const brand = document.querySelector(".topbar .brand");
    if (brand) brand.setAttribute("href", window.API && API.isLoggedIn() ? "dashboard.html" : "index.html");

    const nameEl = document.querySelector(".topbar .profile__name");
    if (nameEl) nameEl.textContent = (user && user.name) || "Guest";

    const avatar = document.querySelector(".topbar .profile__avatar");
    if (avatar && user) avatar.src = `https://i.pravatar.cc/80?u=${encodeURIComponent(user.id || user.email || "user")}`;
  }

  /* ---------- dropdown menu plumbing ---------- */
  function setOpen(wrap, open) {
    if (!wrap) return;
    wrap.classList.toggle("is-open", open);
    const menu = wrap.querySelector(".dropdown__menu");
    if (menu) menu.hidden = !open;
    const btn = wrap.querySelector("button");
    if (btn) btn.setAttribute("aria-expanded", String(open));
  }

  function closeMenus() {
    document.querySelectorAll(".dropdown.is-open").forEach((w) => setOpen(w, false));
  }

  function toggleMenu(wrap) {
    document.querySelectorAll(".dropdown").forEach((m) => { if (m !== wrap) setOpen(m, false); });
    setOpen(wrap, !wrap.classList.contains("is-open"));
  }

  /* ---------- menus (bell + user) ---------- */
  function ensureMenus(user) {
    const actions = document.querySelector(".topbar__actions");
    if (!actions) return;

    if (actions.dataset.menus !== "1") {
      actions.dataset.menus = "1";

      const bell = actions.querySelector(".icon-btn");
      const profile = actions.querySelector(".profile");

      /* notifications */
      const notifWrap = document.createElement("div");
      notifWrap.className = "dropdown";
      notifWrap.id = "notifWrap";
      if (bell) {
        actions.insertBefore(notifWrap, bell);
        notifWrap.appendChild(bell);
        bell.setAttribute("aria-haspopup", "true");
        bell.setAttribute("aria-expanded", "false");
        const dot = bell.querySelector(".icon-btn__dot");
        if (dot) { dot.id = "notifDot"; dot.hidden = true; }
        const notifMenu = document.createElement("div");
        notifMenu.className = "dropdown__menu dropdown__menu--wide";
        notifMenu.hidden = true;
        notifMenu.innerHTML = `
          <div class="dropdown__head"><strong>Notifications</strong></div>
          <div class="dropdown__list" id="notifList"><div class="dropdown__empty">Loading…</div></div>`;
        notifWrap.appendChild(notifMenu);
        bell.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(notifWrap); });
      }

      /* user menu */
      if (profile) {
        const profWrap = document.createElement("div");
        profWrap.className = "dropdown";
        profWrap.id = "profWrap";
        actions.appendChild(profWrap);
        profWrap.appendChild(profile);
        profile.setAttribute("aria-haspopup", "true");
        profile.setAttribute("aria-expanded", "false");
        const profMenu = document.createElement("div");
        profMenu.className = "dropdown__menu dropdown__menu--profile";
        profMenu.hidden = true;
        profMenu.innerHTML = `<div class="dropdown__head dropdown__head--user" id="menuUser"></div><div id="menuLinks"></div>`;
        profWrap.appendChild(profMenu);
        profile.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(profWrap); });
      }

      if (!document.body.dataset.menuClickBound) {
        document.body.dataset.menuClickBound = "1";
        document.addEventListener("click", closeMenus);
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });
      }
    }

    updateMenuUser(user);
  }

  function updateMenuUser(user) {
    const head = document.getElementById("menuUser");
    const links = document.getElementById("menuLinks");
    if (!head || !links) return;

    if (user) {
      head.innerHTML = `
        <span class="dropdown__avatar">${esc(initials(user.name))}</span>
        <span><span class="dropdown__name">${esc(user.name || "User")}</span><span class="dropdown__email">${esc(user.email || "")}</span></span>`;
      links.innerHTML = `
        <a class="dropdown__item" href="profile.html"><i class="bi bi-person"></i> Profile</a>
        <a class="dropdown__item" href="my-bookings.html"><i class="bi bi-ticket-perforated"></i> My bookings</a>
        <a class="dropdown__item" href="support.html"><i class="bi bi-life-preserver"></i> Support</a>
        <div class="dropdown__sep"></div>
        <button class="dropdown__item dropdown__item--danger" type="button" id="signOutBtn"><i class="bi bi-box-arrow-right"></i> Sign out</button>`;
      const out = document.getElementById("signOutBtn");
      if (out) out.addEventListener("click", () => API.logout("login.html"));
    } else {
      head.innerHTML = `
        <span class="dropdown__avatar"><i class="bi bi-person"></i></span>
        <span><span class="dropdown__name">Guest</span><span class="dropdown__email">Not signed in</span></span>`;
      links.innerHTML = `
        <a class="dropdown__item" href="login.html"><i class="bi bi-box-arrow-in-right"></i> Sign in</a>
        <a class="dropdown__item" href="signup.html"><i class="bi bi-person-plus"></i> Create account</a>`;
    }
  }

  /* ---------- notifications ---------- */
  function notifRow(item) {
    return `
      <a class="notif" href="${item.href}">
        <span class="notif__icon ${item.tint}"><i class="bi ${item.icon}"></i></span>
        <span class="notif__body">
          <span class="notif__title">${esc(item.title)}</span>
          <span class="notif__text">${esc(item.text)}</span>
        </span>
        <span class="notif__time">${esc(item.time ? relTime(item.time) : "")}</span>
      </a>`;
  }

  async function buildNotifications(user) {
    const items = [];

    if (!user) return items;

    const role = user.role;
    const approvedOrganizer = role === "organizer" && user.status === "approved";

    if (role === "admin") {
      const body = await API.adminOrganizerApplications("?status=pending&limit=5");
      const apps = (body && body.data) || [];
      const total = (body && body.pagination && body.pagination.total) || apps.length;
      if (total > 0) {
        items.push({ icon: "bi-clipboard-check", tint: "tint-amber", title: `${total} pending application${total > 1 ? "s" : ""}`, text: "Organizer requests awaiting review", href: "admin-applications.html" });
      }
      apps.slice(0, 3).forEach((a) => items.push({
        icon: "bi-person-plus", tint: "tint-purple",
        title: `${(a.user && a.user.name) || "Applicant"} applied`,
        text: a.organizationName || "Organizer application",
        href: "admin-applications.html", time: a.createdAt,
      }));
    } else if (approvedOrganizer) {
      const events = await API.listEvents("?organizer=me", { auth: true });
      const upcoming = events
        .filter((e) => e.status === "scheduled")
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        .slice(0, 4);
      upcoming.forEach((e) => items.push({
        icon: "bi-calendar-event", tint: "tint-purple",
        title: e.title, text: `Starts ${formatDate(e.startsAt)}`,
        href: `participants.html?event=${e._id}`, time: e.startsAt,
      }));
      if (!items.length) items.push({ icon: "bi-calendar-plus", tint: "tint-purple", title: "Create your next event", text: "Publish an event to start selling tickets", href: "create-event.html" });
    } else {
      const bookings = await API.myBookings();
      const recent = [...bookings]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 5);
      recent.forEach((b) => {
        const map = {
          confirmed: { t: "Booking confirmed", icon: "bi-check-circle", tint: "tint-green", href: `ticket.html?id=${b._id}` },
          pending_payment: { t: "Payment pending", icon: "bi-hourglass-split", tint: "tint-amber", href: `checkout.html?booking=${b._id}` },
          cancelled: { t: "Booking cancelled", icon: "bi-x-circle", tint: "tint-red", href: "my-bookings.html" },
          expired: { t: "Booking expired", icon: "bi-clock-history", tint: "tint-red", href: "my-bookings.html" },
        }[b.status] || { t: "Booking updated", icon: "bi-ticket-perforated", tint: "tint-purple", href: "my-bookings.html" };
        items.push({
          icon: map.icon, tint: map.tint, title: map.t,
          text: (b.event && b.event.title) || "Event", href: map.href,
          time: b.updatedAt || b.createdAt,
        });
      });
      if (!items.length) items.push({ icon: "bi-compass", tint: "tint-purple", title: "Find your next event", text: "Browse events and book a seat", href: "index.html" });
    }

    return items;
  }

  async function loadNotifications(user) {
    const list = document.getElementById("notifList");
    const dot = document.getElementById("notifDot");
    if (!list) return;

    if (!user) {
      list.innerHTML = `<div class="dropdown__empty">Sign in to see notifications.</div>`;
      if (dot) dot.hidden = true;
      return;
    }

    list.innerHTML = `<div class="dropdown__empty">Loading…</div>`;
    try {
      const items = await buildNotifications(user);
      if (!items.length) {
        list.innerHTML = `<div class="dropdown__empty">You're all caught up.</div>`;
        if (dot) dot.hidden = true;
        return;
      }
      list.innerHTML = items.map(notifRow).join("");
      if (dot) dot.hidden = false;
    } catch (err) {
      list.innerHTML = `<div class="dropdown__empty">Couldn't load notifications.</div>`;
      if (dot) dot.hidden = true;
    }
  }

  /* ---------- mobile sidebar ---------- */
  function bindMobileClose() {
    if (document.body.dataset.layoutBound === "1") return;
    document.body.dataset.layoutBound = "1";
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".sidebar__link")) return;
      const sidebar = document.querySelector(".sidebar");
      if (sidebar) sidebar.classList.remove("is-open");
    });
  }

  function apply(user) {
    renderSidebar(user);
    renderTopbar(user);
    ensureMenus(user);
  }

  function init() {
    if (!window.API) return;

    bindMobileClose();

    const cached = API.getUser();
    apply(cached);
    loadNotifications(cached);

    if (!API.isLoggedIn()) return;

    API.me()
      .then((user) => { apply(user); loadNotifications(user); })
      .catch(() => { /* page script handles auth errors */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init, renderSidebar, renderTopbar, NAV };
})();
