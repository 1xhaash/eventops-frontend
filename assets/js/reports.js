/* =========================================================
   EventOps Organizer · Event Reports (#17)
   GET /api/events/:id/reports
   GET /api/events/:id/reports/export
   ========================================================= */

const state = { eventId: Views.eventId(), report: null };

const els = {
  picker: document.getElementById("eventPicker"),
  sub: document.getElementById("pageSub"),
  stats: document.getElementById("statGrid"),
  bars: document.getElementById("barChart"),
  donut: document.getElementById("donut"),
  donutPct: document.getElementById("donutPct"),
  legend: document.getElementById("legend"),
  summary: document.getElementById("summaryBody"),
  exportBtn: document.getElementById("exportBtn"),
};

function statCard(icon, tint, label, value, foot = "") {
  return `
    <div class="stat-card">
      <div class="stat-card__icon ${tint}"><i class="bi ${icon}"></i></div>
      <div class="stat-card__label">${label}</div>
      <div class="stat-card__value">${value}</div>
      ${foot ? `<div class="stat-card__foot">${foot}</div>` : ""}
    </div>`;
}

function renderStats(r) {
  const registered = r.bookings.confirmed + r.bookings.pendingPayment + r.bookings.cancelled + r.bookings.expired;
  const fill = r.capacity ? Math.round((r.bookings.confirmed / r.capacity) * 100) : 0;
  const attended = r.tickets.checkedIn;
  const noShow = r.tickets.issued - attended;

  els.stats.innerHTML = [
    statCard("bi-journal-text", "tint-purple", "Registered", registered),
    statCard("bi-patch-check", "tint-green", "Confirmed", r.bookings.confirmed, `Fill rate ${fill}%`),
    statCard("bi-person-check", "tint-green", "Attended", attended),
    statCard("bi-person-dash", "tint-red", "No-shows", Math.max(noShow, 0)),
    statCard("bi-cash-coin", "tint-amber", "Revenue", Views.money(r.revenue), "Gross, confirmed bookings"),
    statCard("bi-cash-stack", "tint-purple", "Net payout", Views.money(r.revenue), "Fees: EGP 0 (mock)"),
  ].join("");
}

function renderBars(r) {
  const items = [
    { label: "Confirmed", value: r.bookings.confirmed },
    { label: "Pending", value: r.bookings.pendingPayment },
    { label: "Cancelled", value: r.bookings.cancelled },
    { label: "Expired", value: r.bookings.expired },
  ];
  const max = Math.max(1, ...items.map((i) => i.value));
  els.bars.innerHTML = items.map((i) => `
    <div class="bar-chart__col">
      <div class="bar-chart__value">${i.value}</div>
      <div class="bar-chart__bar" style="height:${Math.round((i.value / max) * 100)}%"></div>
      <div class="bar-chart__label">${i.label}</div>
    </div>`).join("");
}

function renderDonut(r) {
  const attended = r.tickets.checkedIn;
  const noShow = Math.max(r.tickets.issued - attended, 0);
  const total = attended + noShow;
  const pct = total ? Math.round((attended / total) * 100) : 0;

  els.donut.style.background = total
    ? `conic-gradient(var(--green) 0% ${pct}%, #eef0f5 ${pct}% 100%)`
    : `#eef0f5`;
  els.donutPct.textContent = `${pct}%`;

  els.legend.innerHTML = `
    <div class="legend__row"><span class="legend__dot" style="background:var(--green)"></span> Attended <span class="legend__val">${attended}</span></div>
    <div class="legend__row"><span class="legend__dot" style="background:#eef0f5"></span> No-shows <span class="legend__val">${noShow}</span></div>
    <div class="legend__row muted"><span class="legend__dot" style="background:var(--line)"></span> Tickets issued <span class="legend__val">${r.tickets.issued}</span></div>`;
}

function renderSummary(r) {
  const fill = r.capacity ? Math.round((r.bookings.confirmed / r.capacity) * 100) : 0;
  const rows = [
    ["Event", Views.escapeHtml(r.event.title)],
    ["Status", Views.titleCase(r.event.status)],
    ["Capacity", r.capacity],
    ["Confirmed bookings", r.bookings.confirmed],
    ["Pending payment", r.bookings.pendingPayment],
    ["Cancelled", r.bookings.cancelled],
    ["Expired", r.bookings.expired],
    ["Fill rate", `${fill}%`],
    ["Tickets issued", r.tickets.issued],
    ["Attended", r.tickets.checkedIn],
    ["No-shows", r.tickets.notCheckedIn],
    ["Ticket price", Views.money(r.event.price)],
    ["Gross revenue", Views.money(r.revenue)],
    ["Net revenue", Views.money(r.revenue)],
  ];
  els.summary.innerHTML = rows.map(
    ([k, v]) => `<tr><td class="muted">${k}</td><td style="text-align:right; font-weight:600;">${v}</td></tr>`,
  ).join("");
}

function renderEmpty() {
  els.stats.innerHTML = "";
  els.bars.innerHTML = "";
  els.legend.innerHTML = "";
  els.donut.style.background = "#eef0f5";
  els.donutPct.textContent = "0%";
  els.summary.innerHTML = `<tr><td><div class="empty-note">Choose an event to generate its report.</div></td></tr>`;
}

async function load() {
  if (!state.eventId) { renderEmpty(); els.sub.textContent = "Select an event to generate its report."; return; }
  els.summary.innerHTML = `<tr><td>${Views.spinner("Generating report…")}</td></tr>`;
  try {
    const r = await API.getReport(state.eventId);
    state.report = r;
    els.sub.textContent = `${r.event.title} · ${Views.titleCase(r.event.status)}`;
    renderStats(r);
    renderBars(r);
    renderDonut(r);
    renderSummary(r);
  } catch (err) {
    renderEmpty();
    Views.handleError(err);
  }
}

async function exportReport() {
  if (!state.eventId) { Views.toast("Choose an event", "Select an event before exporting."); return; }
  els.exportBtn.disabled = true;
  try {
    const blob = await API.downloadReport(state.eventId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-report-${state.eventId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Views.toast("Report exported", "The Excel file has been downloaded.", "success");
  } catch (err) {
    Views.handleError(err);
  } finally {
    els.exportBtn.disabled = false;
  }
}

async function init() {
  const user = await Views.requireUser("organizer");
  if (!user) return;
  els.exportBtn.addEventListener("click", exportReport);
  await Views.bindEventPicker(els.picker);
  load();
}

document.addEventListener("DOMContentLoaded", init);
