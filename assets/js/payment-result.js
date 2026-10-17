/* =========================================================
   EventOps · Payment Result (#7)
   Reads ?booking=<id>&status=success|failed
   GET /api/bookings/me  ·  GET /api/events/:id  ·  GET /api/events/:id/seats
   ========================================================= */

const root = document.getElementById("resultRoot");

function summaryRows(booking, event, seatLabel) {
  return `
    <dl class="result-summary">
      <div class="summary-row"><dt>Event</dt><dd>${Views.escapeHtml(event?.title || "—")}</dd></div>
      <div class="summary-row"><dt>Seat</dt><dd>${seatLabel ? Views.escapeHtml(seatLabel) : "—"}</dd></div>
      <div class="summary-row"><dt>Amount paid</dt><dd>${Views.money(event?.price ?? 0)}</dd></div>
      <div class="summary-row"><dt>Booking ID</dt><dd class="mono">${Views.escapeHtml(booking._id)}</dd></div>
      <div class="summary-row"><dt>Status</dt><dd><span class="badge-soft badge-upcoming">${Views.titleCase(booking.status)}</span></dd></div>
    </dl>`;
}

function renderSuccess(booking, event, seatLabel) {
  root.innerHTML = `
    <div class="result-card result-card--success">
      <div class="result-card__icon"><i class="bi bi-check-lg"></i></div>
      <h1 class="result-card__title">Booking confirmed</h1>
      <p class="result-card__sub">Your payment was successful and your seat is reserved.</p>
      ${summaryRows(booking, event, seatLabel)}
      <div class="result-card__actions">
        <a class="btn btn--primary" href="ticket.html?id=${booking._id}"><i class="bi bi-qr-code"></i> View ticket</a>
        <a class="btn" href="index.html">Back to events</a>
      </div>
    </div>`;
}

function renderFailed(booking, event, seatLabel) {
  const retryable = !booking || booking.status === "pending_payment";
  root.innerHTML = `
    <div class="result-card result-card--error">
      <div class="result-card__icon"><i class="bi bi-x-lg"></i></div>
      <h1 class="result-card__title">Payment failed or hold expired</h1>
      <p class="result-card__sub">No charge was made. Your seat may have been released.</p>
      ${booking ? summaryRows(booking, event, seatLabel) : ""}
      <div class="result-card__actions">
        ${retryable && booking ? `<a class="btn btn--primary" href="checkout.html?booking=${booking._id}"><i class="bi bi-arrow-repeat"></i> Try again</a>` : ""}
        <a class="btn" href="my-bookings.html">My bookings</a>
        <a class="btn" href="index.html">Back to events</a>
      </div>
    </div>`;
}

async function init() {
  const user = await Views.requireUser();
  if (!user) return;

  const bookingId = Views.getParam("booking");
  const status = Views.getParam("status") || "failed";

  if (!bookingId) {
    renderFailed(null);
    return;
  }

  let booking = null;
  try {
    const bookings = await API.myBookings();
    booking = bookings.find((b) => b._id === bookingId) || null;
  } catch (err) {
    Views.handleError(err);
  }

  let event = null;
  let seatLabel = null;
  if (booking) {
    const eventId = booking.event?._id || booking.event;
    try { event = await API.getEvent(eventId); } catch { /* optional */ }
    try {
      const seats = await API.getSeats(eventId);
      const seat = seats.find((s) => s._id === (booking.seat?._id || booking.seat));
      seatLabel = seat?.label || null;
    } catch { /* optional */ }
  }

  const isSuccess = status === "success" || booking?.status === "confirmed";
  if (isSuccess && booking && booking.status === "confirmed") {
    renderSuccess(booking, event, seatLabel);
  } else if (isSuccess && booking && booking.status !== "confirmed") {
    renderFailed(booking, event, seatLabel);
  } else {
    renderFailed(booking, event, seatLabel);
  }
}

document.addEventListener("DOMContentLoaded", init);
