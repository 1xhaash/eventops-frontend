/* =========================================================
   EventOps · My Bookings
   GET /api/bookings/me
   ========================================================= */

const TABS = ["all", "pending_payment", "confirmed", "cancelled", "expired"];

const STATUS_META = {
  confirmed: { label: "Confirmed", badge: "badge-upcoming" },
  pending_payment: { label: "Pending payment", badge: "badge-pending" },
  cancelled: { label: "Cancelled", badge: "badge-cancelled" },
  expired: { label: "Expired", badge: "badge-completed" },
};

let bookings = [];
let activeStatus = "all";
let ticker = null;

const expiredSeen = new Set();

/* ---------- helpers ---------- */
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const priceText = (v) => (Number(v) === 0 ? "Free" : money(v));

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

function remainingText(expiresAt) {
  const t = new Date(expiresAt).getTime();
  if (!expiresAt || isNaN(t)) return "--:--";
  const ms = t - Date.now();
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------- toasts ---------- */
function toast(title, text = "", type = "error") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  const variant = type === "success" ? " toast-msg--success" : type === "info" ? " toast-msg--info" : "";
  const icon = type === "success" ? "bi-check-lg" : type === "info" ? "bi-info-lg" : "bi-exclamation-lg";
  el.className = "toast-msg" + variant;
  el.innerHTML = `
    <span class="toast-msg__icon"><i class="bi ${icon}"></i></span>
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

/* ===================== RENDER ===================== */
function renderCard(b) {
  const ev = b.event || {};
  const seat = b.seat || {};
  const meta = STATUS_META[b.status] || { label: b.status || "—", badge: "badge-draft" };
  const image = `https://picsum.photos/seed/${encodeURIComponent(b._id)}/300/220`;

  let action = "";
  if (b.status === "confirmed") {
    action = `
      <button class="btn-view" type="button" data-action="ticket" data-id="${b._id}">View ticket</button>
      <button class="btn-cancel" type="button" data-action="cancel" data-id="${b._id}">Cancel booking</button>`;
  } else if (b.status === "pending_payment") {
    action = `
      <div class="hold">
        <span class="hold__label"><i class="bi bi-clock"></i> Hold expires in</span>
        <span class="hold__timer" data-expires="${escapeHtml(b.expiresAt || "")}" data-id="${b._id}">--:--</span>
      </div>
      <button class="btn-brand booking-card__pay" type="button" data-action="pay" data-id="${b._id}">Pay now</button>
      <button class="btn-cancel" type="button" data-action="cancel" data-id="${b._id}">Cancel</button>`;
  }

  return `
    <article class="booking-card">
      <img class="booking-card__thumb" src="${image}" alt="${escapeHtml(ev.title || "Event")}" loading="lazy" />
      <div class="booking-card__body">
        <div class="booking-card__info">
          <h3 class="booking-card__title">${escapeHtml(ev.title || "Untitled event")}</h3>
          <div class="booking-card__meta">
            <span><i class="bi bi-calendar3"></i>${formatDate(ev.startsAt)} &nbsp; ${formatTimeRange(ev.startsAt, ev.endsAt)}</span>
            <span><i class="bi bi-geo-alt"></i>${escapeHtml(ev.venue || "—")}</span>
          </div>
          <div class="booking-card__tags">
            <span class="seat-chip"><i class="bi bi-armchair"></i>Seat ${escapeHtml(seat.label || "—")}</span>
            <span class="seat-chip seat-chip--amount">${priceText(ev.price)}</span>
          </div>
        </div>
        <div class="booking-card__side">
          <span class="badge-soft ${meta.badge}">${meta.label}</span>
          ${action}
        </div>
      </div>
    </article>`;
}

function renderList() {
  const el = document.getElementById("bookingList");
  const list = activeStatus === "all" ? bookings : bookings.filter((b) => b.status === activeStatus);

  if (!list.length) {
    el.innerHTML = `<div class="empty-note">No bookings to show here yet.</div>`;
    return;
  }

  el.innerHTML = list.map(renderCard).join("");
}

function renderTabs() {
  TABS.forEach((status) => {
    const el = document.querySelector(`[data-count="${status}"]`);
    if (!el) return;
    el.textContent = status === "all"
      ? bookings.length
      : bookings.filter((b) => b.status === status).length;
  });
}

/* ===================== TIMERS ===================== */
function updateTimers() {
  let needReload = false;

  document.querySelectorAll("[data-expires]").forEach((el) => {
    const text = remainingText(el.dataset.expires);
    el.textContent = text;
    if (text === "00:00" && !expiredSeen.has(el.dataset.id)) {
      expiredSeen.add(el.dataset.id);
      needReload = true;
    }
  });

  if (needReload) loadBookings();
}

/* ===================== DATA ===================== */
async function loadBookings() {
  try {
    bookings = await API.myBookings();
  } catch (err) {
    if (err.status === 401) return API.logout();
    bookings = [];
    toast("Unable to load bookings", err.message || "Please try again.");
  }
  renderTabs();
  renderList();
  updateTimers();
}

/* ===================== INTERACTIONS ===================== */
function onListClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  if (btn.dataset.action === "ticket") {
    window.location.href = `ticket.html?id=${encodeURIComponent(btn.dataset.id)}`;
  } else if (btn.dataset.action === "pay") {
    window.location.href = `checkout.html?booking=${encodeURIComponent(btn.dataset.id)}`;
  } else if (btn.dataset.action === "cancel") {
    const booking = bookings.find((x) => x._id === btn.dataset.id);
    if (booking) confirmCancel(booking);
  }
}

/* ===================== CANCEL ===================== */
function confirmCancel(b) {
  const ev = b.event || {};
  const seat = b.seat || {};
  const paid = Number(ev.price) > 0 && b.status === "confirmed";
  const refundLine = paid
    ? `You'll be refunded <strong>${money(ev.price)}</strong> to your original payment method.`
    : "No payment was taken, so there's nothing to refund.";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancelTitle">
      <div class="modal__icon"><i class="bi bi-exclamation-triangle"></i></div>
      <h3 class="modal__title" id="cancelTitle">Cancel this booking?</h3>
      <p class="modal__text">
        <strong>${escapeHtml(ev.title || "This event")}</strong><br />
        Seat ${escapeHtml(seat.label || "-")} &middot; ${priceText(ev.price)}<br /><br />
        ${refundLine} The seat will be released. This can't be undone.
      </p>
      <div class="modal__actions">
        <button class="btn-view" type="button" data-modal="close">Keep booking</button>
        <button class="btn-danger" type="button" data-modal="confirm">Yes, cancel</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));

  const close = () => {
    overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => overlay.remove(), 180);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay || e.target.closest('[data-modal="close"]')) return close();

    const confirmBtn = e.target.closest('[data-modal="confirm"]');
    if (!confirmBtn) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cancelling...';

    try {
      const res = await API.cancelMyBooking(b._id);
      const refunded = res && res.refunded;
      close();
      toast(
        "Booking cancelled",
        refunded
          ? `Refunded ${money(res.amount || ev.price)} — the seat is now free.`
          : "The seat has been released.",
        "info",
      );
      await loadBookings();
    } catch (err) {
      close();
      if (err.status === 401) return API.logout();
      toast("Couldn't cancel booking", err.message || "Please try again.");
    }
  });
}

/* ===================== INIT ===================== */
async function init() {
  if (!API.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const user = API.getUser();
  const nameEl = document.querySelector(".profile__name");
  if (nameEl && user && user.name) nameEl.textContent = user.name;

  document.getElementById("statusTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".status-tab");
    if (!btn) return;
    activeStatus = btn.dataset.status;
    document.querySelectorAll(".status-tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    renderList();
  });

  document.getElementById("bookingList").addEventListener("click", onListClick);

  await loadBookings();
  ticker = setInterval(updateTimers, 1000);
}

document.addEventListener("DOMContentLoaded", init);
