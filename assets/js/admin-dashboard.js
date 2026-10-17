/* =========================================================
   EventOps Admin · Dashboard (#18)
   GET /api/admin/stats  (users, events, bookings, revenue,
                          topEvents, revenueByMonth, recentApplications)
   ========================================================= */

const els = {
  stats: document.getElementById("statGrid"),
  revenueChart: document.getElementById("revenueChart"),
  activity: document.getElementById("activityList"),
  topEvents: document.getElementById("topEventsBody"),
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

function renderStats(s) {
  const organizers = (s.users.byRole && s.users.byRole.organizer) || 0;
  const scheduled = (s.events.byStatus && s.events.byStatus.scheduled) || 0;
  const pendingApps = (s.organizerApplications.byStatus && s.organizerApplications.byStatus.pending) || 0;
  const blocked = (s.users.byStatus && s.users.byStatus.blocked) || 0;

  els.stats.innerHTML = [
    statCard("bi-people", "tint-purple", "Total users", s.users.total, `${organizers} organizers`),
    statCard("bi-briefcase", "tint-amber", "Organizers", organizers, `${blocked} blocked accounts`),
    statCard("bi-calendar3", "tint-purple", "Events", s.events.total, `${scheduled} scheduled`),
    statCard("bi-ticket-perforated", "tint-green", "Tickets sold", s.ticketsSold),
    statCard("bi-cash-coin", "tint-green", "Total revenue", Views.money(s.revenue)),
    statCard("bi-clipboard-check", "tint-amber", "Pending applications", pendingApps),
  ].join("");
}

function renderRevenueChart(series) {
  if (!series || !series.length) {
    els.revenueChart.innerHTML = `<div class="empty-note" style="width:100%;">No revenue recorded yet.</div>`;
    return;
  }
  const max = Math.max(1, ...series.map((s) => s.revenue));
  els.revenueChart.innerHTML = series.map((s) => `
    <div class="bar-chart__col">
      <div class="bar-chart__value">${Views.money(s.revenue).replace("EGP ", "")}</div>
      <div class="bar-chart__bar" style="height:${Math.round((s.revenue / max) * 100)}%"></div>
      <div class="bar-chart__label">${Views.escapeHtml(s._id)}</div>
    </div>`).join("");
}

function renderActivity(apps) {
  if (!apps || !apps.length) {
    els.activity.innerHTML = `<li><div class="empty-note">No recent activity.</div></li>`;
    return;
  }
  els.activity.innerHTML = apps.map((a) => {
    const name = a.user?.name || "Unknown";
    const statusCls = a.status === "approved" ? "badge-upcoming" : a.status === "rejected" ? "badge-cancelled" : "badge-pending";
    return `
      <li class="ticket-list__item" style="cursor:default;">
        <div class="ticket-list__subject">${Views.escapeHtml(name)} applied</div>
        <div class="ticket-list__sub">
          <span>${Views.escapeHtml(a.organizationName || "Organizer")}</span>
          <span class="badge-soft ${statusCls}">${Views.titleCase(a.status)}</span>
        </div>
        <div class="muted" style="font-size:12px; margin-top:6px;">${Views.formatDateTime(a.createdAt)}</div>
      </li>`;
  }).join("");
}

function renderTopEvents(events) {
  if (!events || !events.length) {
    els.topEvents.innerHTML = Views.emptyRow(4, "No ticket sales yet.");
    return;
  }
  els.topEvents.innerHTML = events.map((e) => `
    <tr>
      <td>${Views.escapeHtml(e.title || "—")}</td>
      <td>${Views.money(e.price)}</td>
      <td style="text-align:right;">${e.sold}</td>
      <td style="text-align:right; font-weight:700;">${Views.money(e.sold * e.price)}</td>
    </tr>`).join("");
}

async function init() {
  const user = await Views.requireUser("admin");
  if (!user) return;

  els.stats.innerHTML = Views.spinner("Loading statistics…");
  try {
    const s = await API.adminStats();
    if (!s || !s.users) throw new Error("Unexpected stats response");
    renderStats(s);
    renderRevenueChart(s.revenueByMonth);
    renderActivity(s.recentApplications);
    renderTopEvents(s.topEvents);
  } catch (err) {
    Views.handleError(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
