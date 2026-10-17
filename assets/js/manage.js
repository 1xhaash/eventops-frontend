/* =========================================================
   EventOps · Shared helpers for management pages
   (participants, check-in, reports, invites, admin, checkout…)
   Exposes window.Views — load AFTER api.js / layout.js.
   ========================================================= */

window.Views = (function () {
  /* ---------- formatting ---------- */
  const money = (n) => `EGP ${Number(n || 0).toLocaleString("en-US")}`;

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(value) {
    const d = new Date(value);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(value) {
    const d = new Date(value);
    if (isNaN(d)) return "—";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatTime(value) {
    const d = new Date(value);
    if (isNaN(d)) return "—";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  }

  function titleCase(s) {
    return s ? String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
  }

  /* ---------- url params ---------- */
  const getParam = (name) => new URLSearchParams(window.location.search).get(name);
  const eventId = () => getParam("event") || getParam("id") || null;

  /* ---------- toast ---------- */
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

  /* ---------- error handling ---------- */
  function handleError(err, { redirectOnAuth = true } = {}) {
    if (err && err.status === 401 && redirectOnAuth) { API.logout(); return; }
    if (err && err.status === 403) { toast("Not allowed", "You do not have permission for this action."); return; }
    if (err && err.status === undefined) { toast("Unable to connect", "Check your connection and try again."); return; }
    toast(err && err.message ? err.message : "Something went wrong", "Please try again.");
  }

  /* ---------- access denied ---------- */
  function renderAccessDenied(title, message) {
    const content = document.getElementById("content") || document.querySelector(".content");
    if (!content) return;
    content.innerHTML = `
      <div class="access-denied">
        <div class="access-denied__icon"><i class="bi bi-shield-lock"></i></div>
        <h2>${escapeHtml(title || "Access denied")}</h2>
        <p>${escapeHtml(message || "You do not have permission to view this page.")}</p>
        <a class="btn-brand" href="dashboard.html"><i class="bi bi-arrow-left"></i> Back to dashboard</a>
      </div>`;
  }

  /* ---------- auth / role gate ---------- */
  async function requireUser(role) {
    if (!API.isLoggedIn()) { window.location.href = "login.html"; return null; }

    let user;
    try {
      user = await API.me();
    } catch (err) {
      if (err.status === 401) { API.logout(); return null; }
      handleError(err);
      return null;
    }

    const ok = role === "admin"
      ? user.role === "admin"
      : role === "organizer"
        ? (user.role === "organizer" || user.role === "admin")
        : true;

    if (!ok) {
      renderAccessDenied(
        role === "admin" ? "Admins only" : "Organizers only",
        role === "admin"
          ? "This area is restricted to administrators."
          : "This area is for organizers. Apply from your profile to become one.",
      );
      return null;
    }

    const nameEl = document.querySelector(".profile__name");
    if (nameEl && user.name) nameEl.textContent = user.name;
    return user;
  }

  /* ---------- organizer event picker ---------- */
  async function loadOrganizerEvents() {
    return API.listEvents("?organizer=me", { auth: true });
  }

  async function bindEventPicker(selectEl, { excludeCancelled = false } = {}) {
    if (!selectEl) return [];
    try {
      let events = await loadOrganizerEvents();
      if (excludeCancelled) events = events.filter((e) => e.status !== "cancelled");
      const current = eventId();
      selectEl.innerHTML = `<option value="">Select an event…</option>` +
        events.map((e) => `<option value="${e._id}"${e._id === current ? " selected" : ""}>${escapeHtml(e.title)}</option>`).join("");
      selectEl.addEventListener("change", () => {
        const id = selectEl.value;
        const url = new URL(window.location.href);
        if (id) url.searchParams.set("event", id);
        else url.searchParams.delete("event");
        window.location.href = url.toString();
      });
      return events;
    } catch (err) {
      handleError(err);
      return [];
    }
  }

  function spinner(text = "Loading…") {
    return `<div class="spinner"><i class="bi bi-arrow-repeat"></i><span>${escapeHtml(text)}</span></div>`;
  }

  function emptyRow(colspan, text = "No data found.") {
    return `<tr><td colspan="${colspan}"><div class="empty-note">${escapeHtml(text)}</div></td></tr>`;
  }

  return {
    money, escapeHtml, formatDate, formatDateTime, formatTime, initials, titleCase,
    getParam, eventId, toast, handleError, renderAccessDenied, requireUser,
    loadOrganizerEvents, bindEventPicker, spinner, emptyRow,
  };
})();
