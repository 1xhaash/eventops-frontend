/* =========================================================
   EventOps · Seat Selection
   GET  /api/events/:id/seats
   POST /api/events/:id/bookings
   ========================================================= */

const COLS = 12;

const params = new URLSearchParams(location.search);
const EVENT_ID = params.get("id") || location.pathname.split("/").pop();

const grid = document.getElementById("seatGrid");
const confirmBtn = document.getElementById("confirmBtn");

let event = null;
let seats = [];            // [{ _id, label, status }]
let selectedSeat = null;   // { id, label }

/* ---------- helpers ---------- */
const money = (v) => "EGP " + Number(v || 0).toLocaleString("en-US");
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- toasts ---------- */
function toast(title, text = "", type = "error") {
  const stack = document.getElementById("toastStack");
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

/* ---------- data ---------- */
async function loadEvent() {
  try {
    return await API.getEvent(EVENT_ID);
  } catch {
    return null;
  }
}

async function loadSeats() {
  try {
    return await API.getSeats(EVENT_ID);
  } catch {
    return [];
  }
}

/* ===================== RENDER ===================== */
function seatClass(status) {
  return status === "held" ? "seat--held"
    : status === "booked" ? "seat--booked"
    : "seat--available";
}

function renderSeatMap() {
  const rows = [];
  for (let i = 0; i < seats.length; i += COLS) rows.push(seats.slice(i, i + COLS));

  grid.innerHTML = rows
    .map((rowSeats, r) => {
      const rowLabel = String.fromCharCode(65 + r);
      const cells = rowSeats
        .map((seat) => {
          const label = seat.label || String(seat._id).slice(-4);
          const face = String(label).replace(/^\D+/, "") || label;
          const selected = selectedSeat && selectedSeat.id === seat._id;
          const cls = selected ? "seat--selected" : seatClass(seat.status);
          const disabled = seat.status !== "available" ? "disabled" : "";
          return `<button class="seat ${cls}" type="button"
                    data-seat-id="${seat._id}" data-label="${escapeHtml(label)}"
                    ${disabled} title="${escapeHtml(label)} · ${seat.status}">${escapeHtml(face)}</button>`;
        })
        .join("");
      return `<div class="seat-row"><span class="seat-row__label">${rowLabel}</span><div class="seat-row__seats">${cells}</div></div>`;
    })
    .join("");
}

function updateSummary() {
  document.getElementById("eventName").textContent = event ? event.title : "—";
  document.getElementById("summaryEvent").textContent = event ? event.title : "—";

  const priceText = event ? (Number(event.price) === 0 ? "Free" : money(event.price)) : "—";
  document.getElementById("summaryPrice").textContent = priceText;
  document.getElementById("summarySeat").textContent = selectedSeat ? selectedSeat.label : "—";
  document.getElementById("summaryTotal").textContent =
    event && selectedSeat ? (Number(event.price) === 0 ? "Free" : money(event.price)) : money(0);

  confirmBtn.disabled = !selectedSeat;
  confirmBtn.innerHTML = event && Number(event.price) > 0
    ? '<i class="bi bi-clock-history"></i> Hold seat'
    : '<i class="bi bi-check-lg"></i> Confirm booking';
}

/* ===================== SELECTION ===================== */
grid.addEventListener("click", (e) => {
  const btn = e.target.closest(".seat");
  if (!btn || btn.disabled) return;

  const id = btn.dataset.seatId;
  if (selectedSeat && selectedSeat.id === id) {
    selectedSeat = null;                    // deselect
  } else {
    selectedSeat = { id, label: btn.dataset.label };
  }

  renderSeatMap();
  updateSummary();
});

/* ===================== CONFIRM & PAY ===================== */
async function confirmBooking() {
  if (!selectedSeat) return;

  if (!API.isLoggedIn()) {
    toast("Please login to continue", "You need an account to book a seat.");
    setTimeout(() => (window.location.href = "login.html"), 1400);
    return;
  }

  confirmBtn.disabled = true;
  const original = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';

  const seatId = selectedSeat.id;
  const seatLabel = selectedSeat.label;

  try {
    const body = await API.createBooking(EVENT_ID, seatId);

    const isPendingPayment = body && body.data && body.data.status === "pending_payment";
    toast(
      isPendingPayment ? "Seat held" : "Booking confirmed",
      body && body.message ? body.message : `Seat ${seatLabel} is booked.`,
      "success",
    );

    const seat = seats.find((s) => s._id === seatId);
    if (seat) seat.status = event && Number(event.price) > 0 ? "held" : "booked";
    selectedSeat = null;
    renderSeatMap();
    updateSummary();
    const bookingId = body && body.data && body.data._id;
    if (isPendingPayment && bookingId) {
      setTimeout(() => (window.location.href = `checkout.html?booking=${bookingId}`), 1400);
    } else {
      setTimeout(() => (window.location.href = "my-bookings.html"), 1600);
    }

  } catch (err) {
    /* 409 covers two different situations:
       (a) this user already has an active booking for the event, or
       (b) the seat was genuinely taken in the meantime. */
    if (err.status === 409) {
      const alreadyBooked = /already have an active booking/i.test(err.message || "");

      if (alreadyBooked) {
        /* Point the user at the booking they already have instead of
           pretending the seat was taken. */
        toast("You already have a booking", "Only one seat per event — taking you to it…", "success");

        let existing = null;
        try {
          const mine = await API.myBookings();
          existing = mine.find(
            (b) =>
              String(b.event?._id || b.event) === String(EVENT_ID) &&
              ["pending_payment", "confirmed"].includes(b.status),
          );
        } catch { /* ignore lookup errors */ }

        const dest = existing && existing.status === "pending_payment"
          ? `checkout.html?booking=${existing._id}`
          : "my-bookings.html";
        setTimeout(() => (window.location.href = dest), 1400);
        return;
      }

      /* genuine seat conflict */
      toast("Seat no longer available", "Someone just booked this seat. Please choose another.");
      const seat = seats.find((s) => s._id === seatId);
      if (seat) seat.status = "booked";
      selectedSeat = null;
      renderSeatMap();
      updateSummary();
      return;
    }

    /* 401 · not authenticated */
    if (err.status === 401) {
      toast("Session expired", "Please login again.");
      setTimeout(() => (window.location.href = "login.html"), 1400);
      return;
    }

    if (err.status === undefined) {
      toast("Unable to connect", "Check your connection and try again.");
      return;
    }

    toast(err.message || "Booking failed", "Please try again.");

  } finally {
    confirmBtn.innerHTML = original;
    updateSummary();
  }
}

confirmBtn.addEventListener("click", confirmBooking);

/* ===================== INIT ===================== */
async function init() {
  const [ev, seatList] = await Promise.all([loadEvent(), loadSeats()]);
  event = ev;
  seats = seatList;

  if (!seats.length) {
    document.getElementById("eventName").textContent = event ? event.title : "Event not found";
    grid.innerHTML = `<div class="empty-note">No seats available for this event.</div>`;
    updateSummary();
    return;
  }

  renderSeatMap();
  updateSummary();
}

document.addEventListener("DOMContentLoaded", init);
