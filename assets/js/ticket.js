/* =========================================================
   EventOps · Ticket with QR
   GET /api/bookings/me  (booking resolved client-side)
   ========================================================= */

const params = new URLSearchParams(location.search);
const BOOKING_ID = params.get("id");

const TICKET_STATUS = {
  confirmed: { label: "Valid", badge: "badge-upcoming" },
  pending_payment: { label: "Pending", badge: "badge-pending" },
  cancelled: { label: "Revoked", badge: "badge-cancelled" },
  expired: { label: "Expired", badge: "badge-completed" },
};

/* ---------- helpers ---------- */
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const priceText = (v) => (Number(v) === 0 ? "Free" : money(v));

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTimeRange(start, end) {
  const fmt = (v) => {
    const d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

/* ===================== RENDER ===================== */
function notFound() {
  document.getElementById("ticketArea").innerHTML = `
    <a class="back-link" href="my-bookings.html"><i class="bi bi-arrow-left"></i> Back to my bookings</a>
    <div class="empty-note">
      Ticket not found. It may have been removed or you don't have access to it.
      <br /><br />
      <a class="btn-view" href="my-bookings.html">Go to my bookings</a>
    </div>`;
}

function renderQr(b) {
  const box = document.getElementById("qrBox");
  const codeEl = document.getElementById("qrCodeText");
  if (!box) return;

  const showText = (text, message) => {
    if (codeEl) codeEl.textContent = text || "—";
    box.innerHTML = `<div class="ticket__qr-fallback">${escapeHtml(message || text || "Not available")}</div>`;
  };

  /* A ticket only exists for a confirmed booking. Any other status has
     nothing to scan yet. */
  if (b.status !== "confirmed") {
    box.innerHTML = `<div class="ticket__qr-empty"><i class="bi bi-hourglass-split"></i><span>${
      b.status === "pending_payment" ? "Awaiting payment" :
      TICKET_STATUS[b.status]?.label || "Not available"
    }</span></div>`;
    if (codeEl) codeEl.textContent = "—";
    return;
  }

  API.bookingTicket(b._id)
    .then((ticket) => {
      const token = ticket?.qrToken || "";
      const dataUrl = ticket?.qrCode || "";
      if (codeEl) codeEl.textContent = token || "—";

      if (dataUrl) {
        box.innerHTML = `<img class="ticket__qr-img" src="${dataUrl}" alt="Ticket QR code" width="220" height="220" />`;
        return;
      }

      /* Fallback: draw the QR in the browser if the server didn't send an
         image and the QR library happened to load. */
      if (token && window.QRCode && typeof window.QRCode.toCanvas === "function") {
        const canvas = document.createElement("canvas");
        canvas.width = 220;
        canvas.height = 220;
        box.innerHTML = "";
        box.appendChild(canvas);
        window.QRCode.toCanvas(canvas, token, { width: 220 }, (err) => {
          if (err) showText(token, token);
        });
        return;
      }

      showText(token, token || "Ticket code unavailable");
    })
    .catch((err) => {
      if (err && err.status === 401) return API.logout();
      showText("", "Could not load the QR code");
    });
}

function renderTicket(b, user) {
  const ev = b.event || {};
  const seat = b.seat || {};
  const meta = TICKET_STATUS[b.status] || { label: "Unknown", badge: "badge-draft" };
  const attendee = user && user.name ? user.name : "Guest";
  const bookingRef = String(b._id || "").slice(-8).toUpperCase();

  document.getElementById("ticketArea").innerHTML = `
    <a class="back-link" href="my-bookings.html"><i class="bi bi-arrow-left"></i> Back to my bookings</a>

    <div class="ticket">
      <div class="ticket__main">
        <div class="ticket__top">
          <span class="brand brand--ticket">
            <span class="brand__logo"><i class="bi bi-camera-video-fill"></i></span>
            <span class="brand__name">EventOps</span>
          </span>
          <span class="badge-soft ${meta.badge}">${meta.label}</span>
        </div>

        <h1 class="ticket__title">${escapeHtml(ev.title || "Untitled event")}</h1>
        <p class="ticket__code-text">BOOKING #${escapeHtml(bookingRef)}</p>

        <div class="ticket__grid">
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-calendar3"></i>Date</span>
            <span class="ticket__value">${formatDate(ev.startsAt)}</span>
          </div>
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-clock"></i>Time</span>
            <span class="ticket__value">${formatTimeRange(ev.startsAt, ev.endsAt)}</span>
          </div>
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-geo-alt"></i>Venue</span>
            <span class="ticket__value">${escapeHtml(ev.venue || "—")}</span>
          </div>
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-armchair"></i>Seat</span>
            <span class="ticket__value ticket__value--strong">${escapeHtml(seat.label || "—")}</span>
          </div>
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-person"></i>Attendee</span>
            <span class="ticket__value">${escapeHtml(attendee)}</span>
          </div>
          <div class="ticket__field">
            <span class="ticket__label"><i class="bi bi-tag"></i>Price</span>
            <span class="ticket__value">${priceText(ev.price)}</span>
          </div>
        </div>

        <p class="ticket__note"><i class="bi bi-qr-code"></i>Present this QR code at the entrance for check-in.</p>
      </div>

      <div class="ticket__stub">
        <div class="ticket__qr" id="qrBox">
          <div class="spinner"><i class="bi bi-arrow-repeat"></i></div>
        </div>
        <div class="ticket__qr-caption">Scan to verify ticket</div>
        <code class="ticket__qr-code" id="qrCodeText">—</code>
        <button class="btn-brand ticket__download no-print" type="button" id="downloadBtn">
          <i class="bi bi-download"></i> Download PDF
        </button>
      </div>
    </div>`;

  renderQr(b);

  document.getElementById("downloadBtn").addEventListener("click", () => window.print());
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

  if (!BOOKING_ID) {
    notFound();
    return;
  }

  let bookings = [];
  try {
    bookings = await API.myBookings();
  } catch (err) {
    if (err.status === 401) return API.logout();
    notFound();
    return;
  }

  const booking = bookings.find((b) => b._id === BOOKING_ID);
  if (!booking) {
    notFound();
    return;
  }

  renderTicket(booking, user);
}

document.addEventListener("DOMContentLoaded", init);
