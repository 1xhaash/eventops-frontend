/* =========================================================
   EventOps · Create / Edit Event
   GET   /api/events/:id   (edit mode prefill)
   POST  /api/events       (create)
   PATCH /api/events/:id   (update)
   ========================================================= */

const params = new URLSearchParams(location.search);
const EVENT_ID = params.get("id");
const IS_EDIT = !!EVENT_ID;

const form = document.getElementById("eventForm");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formAlert = document.getElementById("formAlert");
const invitedGroup = document.getElementById("invitedGroup");
const guardNotice = document.getElementById("guardNotice");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_KEYS = [
  "title", "description", "venue", "startsAt", "endsAt",
  "registrationDeadline", "capacity", "price", "visibility", "invitedEmails",
];

let savedLabel = "";
let originalInvitedEmails = [];

/* ---------- helpers ---------- */
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pad = (n) => String(n).padStart(2, "0");

function toLocalInput(value) {
  const d = new Date(value);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d.toISOString();
}

function parseEmails(text) {
  return String(text || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

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

/* ---------- form errors ---------- */
function setFieldError(key, message) {
  const errEl = document.querySelector(`.field-error[data-error-for="${key}"]`);
  if (errEl) errEl.textContent = message || "";
  const input = document.getElementById(key);
  if (input) input.classList.add("is-invalid");
}

function clearErrors() {
  form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
}

function showFormAlert(messages) {
  const items = messages.filter(Boolean);
  if (!items.length) return;
  formAlert.innerHTML =
    `<div class="form-alert__title"><i class="bi bi-exclamation-triangle"></i> Please fix the following:</div>` +
    `<ul>${items.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`;
  formAlert.hidden = false;
}

function hideFormAlert() {
  formAlert.hidden = true;
  formAlert.innerHTML = "";
}

/* ---------- values & validation ---------- */
function readValues() {
  const vis = form.querySelector('input[name="visibility"]:checked');
  return {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    venue: document.getElementById("venue").value.trim(),
    startsAt: document.getElementById("startsAt").value,
    endsAt: document.getElementById("endsAt").value,
    registrationDeadline: document.getElementById("registrationDeadline").value,
    capacity: document.getElementById("capacity").value.trim(),
    price: document.getElementById("price").value.trim(),
    visibility: vis ? vis.value : "",
    invitedEmails: document.getElementById("invitedEmails").value,
  };
}

function validate(v) {
  const errs = {};

  if (!v.title) errs.title = "Title is required.";
  else if (v.title.length < 3) errs.title = "Title must be at least 3 characters.";
  else if (v.title.length > 100) errs.title = "Title must be at most 100 characters.";

  if (!v.description) errs.description = "Description is required.";
  else if (v.description.length < 10) errs.description = "Description must be at least 10 characters.";

  if (!v.venue) errs.venue = "Venue is required.";
  else if (v.venue.length < 3) errs.venue = "Venue must be at least 3 characters.";

  const start = v.startsAt ? new Date(v.startsAt) : null;
  const end = v.endsAt ? new Date(v.endsAt) : null;
  const deadline = v.registrationDeadline ? new Date(v.registrationDeadline) : null;

  if (!v.startsAt || isNaN(start)) errs.startsAt = "Start date & time is required.";
  if (!v.endsAt || isNaN(end)) errs.endsAt = "End date & time is required.";
  if (!v.registrationDeadline || isNaN(deadline)) errs.registrationDeadline = "Registration deadline is required.";

  if (start && end && !isNaN(start) && !isNaN(end) && end <= start) {
    errs.endsAt = "End time must be after the start time.";
  }
  if (start && deadline && !isNaN(start) && !isNaN(deadline) && deadline > start) {
    errs.registrationDeadline = "Deadline must be on or before the start time.";
  }

  if (v.capacity === "") errs.capacity = "Capacity is required.";
  else if (!/^\d+$/.test(v.capacity) || Number(v.capacity) < 1) {
    errs.capacity = "Capacity must be a whole number of at least 1.";
  }

  if (v.price === "") errs.price = "Price is required.";
  else if (isNaN(Number(v.price)) || Number(v.price) < 0) {
    errs.price = "Price must be 0 or more.";
  }

  if (!v.visibility) errs.visibility = "Please choose a visibility.";

  if (v.visibility === "private") {
    const bad = parseEmails(v.invitedEmails).filter((e) => !EMAIL_RE.test(e));
    if (bad.length) errs.invitedEmails = `Invalid email address: ${bad[0]}`;
  }

  return errs;
}

function buildPayload(v) {
  const payload = {
    title: v.title,
    description: v.description,
    venue: v.venue,
    startsAt: toISO(v.startsAt),
    endsAt: toISO(v.endsAt),
    registrationDeadline: toISO(v.registrationDeadline),
    capacity: Number(v.capacity),
    price: Number(v.price),
    visibility: v.visibility,
  };

  if (v.visibility === "private") {
    payload.invitedEmails = [...new Set(parseEmails(v.invitedEmails).map((e) => e.toLowerCase()))];
  } else if (!IS_EDIT) {
    payload.invitedEmails = [];
  }

  if (IS_EDIT && v.visibility === "private") {
    const next = new Set(payload.invitedEmails || []);
    const removed = originalInvitedEmails.filter((e) => !next.has(e));
    if (removed.length) payload.removeInvitedEmails = removed;
  }

  return payload;
}

/* ---------- backend errors (best-effort field mapping) ---------- */
function mapBackendErrors(err) {
  const data = err && err.data;
  let list = [];

  if (data && Array.isArray(data.errors)) list = data.errors.map(String);
  else if (data && typeof data.errors === "string" && data.errors) list = [data.errors];
  else if (err && err.message) list = [err.message];

  if (!list.length) list = ["Something went wrong. Please try again."];

  const unmapped = [];
  list.forEach((msg) => {
    const key = FIELD_KEYS.find((k) => new RegExp(`^"?${k}"?\\b`, "i").test(msg));
    if (key) setFieldError(key, msg);
    else unmapped.push(msg);
  });

  return unmapped;
}

/* ---------- ui state ---------- */
function syncVisibility() {
  const vis = form.querySelector('input[name="visibility"]:checked');
  const isPrivate = !!vis && vis.value === "private";
  invitedGroup.hidden = !isPrivate;
  form.querySelectorAll(".radio-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.vis === (vis ? vis.value : ""));
  });
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.innerHTML = on
    ? '<i class="bi bi-hourglass-split"></i> Saving...'
    : savedLabel;
}

function setMode() {
  if (IS_EDIT) {
    document.getElementById("pageTitle").textContent = "Edit event";
    document.getElementById("pageSub").textContent = "Update the details and save your changes.";
    submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Save changes';
  } else {
    submitBtn.innerHTML = '<i class="bi bi-send"></i> Publish event';
  }
  savedLabel = submitBtn.innerHTML;
}

/* ---------- prefill (edit mode) ---------- */
function prefill(event) {
  document.getElementById("title").value = event.title || "";
  document.getElementById("description").value = event.description || "";
  document.getElementById("venue").value = event.venue || "";
  document.getElementById("startsAt").value = toLocalInput(event.startsAt);
  document.getElementById("endsAt").value = toLocalInput(event.endsAt);
  document.getElementById("registrationDeadline").value = toLocalInput(event.registrationDeadline);
  document.getElementById("capacity").value = event.capacity ?? "";
  document.getElementById("price").value = event.price ?? "";

  const vis = event.visibility === "private" ? "private" : "public";
  const radio = form.querySelector(`input[name="visibility"][value="${vis}"]`);
  if (radio) radio.checked = true;
  if (vis === "private") {
    document.getElementById("invitedEmails").value = (event.invitedEmails || []).join("\n");
  }
  originalInvitedEmails = (event.invitedEmails || []).map((e) => String(e).trim().toLowerCase());
  syncVisibility();
}

async function loadForEdit() {
  try {
    const event = await API.getEvent(EVENT_ID);
    if (!event) throw new Error("Event not found.");
    prefill(event);
  } catch (err) {
    if (err.status === 401) { API.logout(); return; }
    showFormAlert([err.message || "Could not load this event."]);
    toast("Could not load event", err.message || "Please try again.");
    submitBtn.disabled = true;
  }
}

/* ---------- submit ---------- */
async function onSubmit(ev) {
  ev.preventDefault();
  hideFormAlert();
  clearErrors();

  const values = readValues();
  const errs = validate(values);
  const keys = Object.keys(errs);

  if (keys.length) {
    keys.forEach((k) => setFieldError(k, errs[k]));
    showFormAlert(["Please fix the highlighted fields and try again."]);
    const first = document.querySelector(`.field-error[data-error-for="${keys[0]}"]`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Check the form", `${keys.length} field${keys.length > 1 ? "s" : ""} need attention.`);
    return;
  }

  setLoading(true);

  try {
    if (IS_EDIT) {
      await API.updateEvent(EVENT_ID, buildPayload(values));
      toast("Event updated", "Your changes have been saved.", "success");
    } else {
      await API.createEvent(buildPayload(values));
      toast("Event created", "Your event is now live.", "success");
    }
    setTimeout(() => (window.location.href = "organizer-dashboard.html"), 1200);

  } catch (err) {
    if (err.status === 401) {
      toast("Session expired", "Please login again.");
      setTimeout(() => API.logout(), 1200);
      return;
    }

    if (err.status === 403) {
      showFormAlert([err.message || "You do not have permission to perform this action."]);
      toast("Action not allowed", err.message || "You do not have permission.");
      return;
    }

    if (err.status === 400) {
      const unmapped = mapBackendErrors(err);
      showFormAlert(unmapped.length ? unmapped : [err.message || "Please review your input."]);
      toast("Could not save event", "Please review the highlighted fields.");
      return;
    }

    if (err.status === 404) {
      showFormAlert([err.message || "Event not found."]);
      toast("Not found", err.message || "This event is unavailable.");
      return;
    }

    if (err.status === undefined) {
      toast("Unable to connect", "Check your connection and try again.");
      return;
    }

    toast(err.message || "Request failed", "Please try again.");

  } finally {
    setLoading(false);
  }
}

/* ---------- cancel ---------- */
function onCancel() {
  if (document.referrer && document.referrer.includes(location.host)) history.back();
  else window.location.href = "organizer-dashboard.html";
}

/* ===================== INIT ===================== */
async function init() {
  setMode();

  form.addEventListener("submit", onSubmit);
  form.querySelectorAll('input[name="visibility"]').forEach((r) => r.addEventListener("change", syncVisibility));
  cancelBtn.addEventListener("click", onCancel);

  if (!API.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = await API.me();
  } catch (err) {
    if (err.status === 401) { API.logout(); return; }
    guardNotice.hidden = false;
    form.hidden = true;
    toast("Unable to verify access", "Check your connection and try again.");
    return;
  }
  const nameEl = document.querySelector(".profile__name");
  if (nameEl && user && user.name) nameEl.textContent = user.name;

  if (!user || user.role !== "organizer" || user.status !== "approved") {
    guardNotice.hidden = false;
    form.hidden = true;
    return;
  }

  syncVisibility();

  if (IS_EDIT) await loadForEdit();
}

document.addEventListener("DOMContentLoaded", init);
