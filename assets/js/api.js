/* =========================================================
   EventOps · Shared API layer
   Talks to the EXISTING backend as-is (no backend changes).

   Endpoints available on the server:
     POST   /api/auth/signup
     POST   /api/auth/login
     GET    /api/users/me                    (auth)
     PUT    /api/users/me                    (auth)
     GET    /api/events
     GET    /api/events/:id
     POST   /api/events                      (auth · organizer)
     PATCH  /api/events/:id                  (auth · organizer)
     POST   /api/events/:id/cancel           (auth · organizer)
     POST   /api/events/:id/invites          (auth · organizer · private)
     GET    /api/events/:id/seats
     GET    /api/events/:id/participants     (auth · organizer)
     POST   /api/events/:id/check-in         (auth · organizer)
     GET    /api/events/:id/reports          (auth · organizer)
     GET    /api/events/:id/reports/export   (auth · organizer)
     POST   /api/events/:id/bookings         (auth)
     GET    /api/bookings/me                 (auth)
     GET    /api/bookings/:id/ticket         (auth)
     PATCH  /api/organizer/bookings/:id/cancel (auth · organizer)
     POST   /api/payments/initiate           (auth)
     POST   /api/payments/mock-confirm/:txId (auth)
     GET    /api/payments/booking/:bookingId
     GET    /api/payments/:txId
     POST   /api/tickets                     (auth)
     GET    /api/tickets                     (auth)
     GET    /api/tickets/:id                 (auth)
     PATCH  /api/tickets/:id                 (auth)
     GET    /api/admin/users                 (auth · admin)
     GET    /api/admin/events                (auth · admin)
     GET    /api/admin/stats                 (auth · admin)
   ========================================================= */

/* DEPLOY: set this to your backend public URL (no trailing slash), e.g. "https://eventops-api.onrender.com". Leave "" for local dev. */
const DEPLOY_API_BASE = "";

window.API = (function () {
  const BASE = DEPLOY_API_BASE || "http://localhost:3000";

  /* ---------- session ---------- */
  const getToken = () => localStorage.getItem("token") || null;
  const isLoggedIn = () => !!getToken();

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  };

  const setSession = (token, user) => {
    if (token) localStorage.setItem("token", token);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const logout = (redirect = "login.html") => {
    clearSession();
    if (redirect) window.location.href = redirect;
  };

  /* ---------- request ---------- */
  async function request(path, { method = "GET", body, auth = false, headers = {} } = {}) {
    const opts = { method, headers: { ...headers } };

    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const token = getToken();
    if (auth && token) opts.headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(BASE + path, opts);

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      const err = new Error((data && data.message) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data; // { success, message, data }
  }

  // Public event routes accept an optional token so private-event owners and
  // invitees can be authorized. If a stored token is stale, retrying without it
  // keeps public event pages available while protected pages still handle 401s.
  async function requestWithOptionalAuth(path, options = {}) {
    if (!getToken()) return request(path, { ...options, auth: false });

    try {
      return await request(path, { ...options, auth: true });
    } catch (err) {
      if (err.status !== 401) throw err;
      return request(path, { ...options, auth: false });
    }
  }

  /* ---------- endpoint + verb helpers ---------- */
  const endpoints = {
    signup: "/api/auth/signup",
    login: "/api/auth/login",
    profile: "/api/users/me",
    events: "/api/events",
    event: (id) => `/api/events/${id}`,
    createEvent: "/api/events",
    updateEvent: (id) => `/api/events/${id}`,
    cancelEvent: (id) => `/api/events/${id}/cancel`,
    eventInvites: (id) => `/api/events/${id}/invites`,
    eventSeats: (id) => `/api/events/${id}/seats`,
    eventParticipants: (id) => `/api/events/${id}/participants`,
    eventCheckIn: (id) => `/api/events/${id}/check-in`,
    eventReport: (id) => `/api/events/${id}/reports`,
    eventReportExport: (id) => `/api/events/${id}/reports/export`,
    createBooking: (id) => `/api/events/${id}/bookings`,
    myBookings: "/api/bookings/me",
    bookingTicket: (id) => `/api/bookings/${id}/ticket`,
    cancelMyBooking: (id) => `/api/bookings/${id}/cancel`,
    cancelBooking: (id) => `/api/organizer/bookings/${id}/cancel`,
    paymentsInitiate: "/api/payments/initiate",
    paymentMockConfirm: (txId) => `/api/payments/mock-confirm/${txId}`,
    paymentByBooking: (bookingId) => `/api/payments/booking/${bookingId}`,
    payment: (txId) => `/api/payments/${txId}`,
    tickets: "/api/tickets",
    ticket: (id) => `/api/tickets/${id}`,
    organizerApplications: "/api/organizer-applications",
    myOrganizerApplications: "/api/organizer-applications/me",
    adminOrganizerApplications: "/api/admin/organizer-applications",
    adminOrganizerApplication: (id) => `/api/admin/organizer-applications/${id}`,
    adminUsers: "/api/admin/users",
    adminEvents: "/api/admin/events",
    adminStats: "/api/admin/stats",
    adminUserStatus: (id) => `/api/admin/users/${id}/status`,
  };

  /* ---------- high level (return the inner .data when present) ---------- */
  const api = {
    BASE, endpoints,
    getToken, isLoggedIn, getUser, setSession, clearSession, logout, request,

    // auth
    async login(email, password) {
      const body = await request(endpoints.login, { method: "POST", body: { email, password } });
      if (body && body.token) setSession(body.token, body.data || null);
      return body;
    },
    async signup(payload) {
      return request(endpoints.signup, { method: "POST", body: payload });
    },
    async me() {
      const body = await request(endpoints.profile, { auth: true });
      if (body && body.data) setSession(null, body.data);
      return body && body.data;
    },
    async updateProfile(payload) {
      const body = await request(endpoints.profile, { method: "PUT", body: payload, auth: true });
      if (body && body.data) setSession(null, body.data);
      return body && body.data;
    },

    // organizer applications
    async applyOrganizer(payload) {
      return request(endpoints.organizerApplications, { method: "POST", body: payload, auth: true });
    },
    async myOrganizerApplications() {
      const body = await request(endpoints.myOrganizerApplications, { auth: true });
      return (body && body.data) || [];
    },

    // admin
    async adminOrganizerApplications(query = "") {
      return request(`${endpoints.adminOrganizerApplications}${query}`, { auth: true });
    },
    async reviewOrganizerApplication(id, payload) {
      const body = await request(endpoints.adminOrganizerApplication(id), { method: "PATCH", body: payload, auth: true });
      return body && body.data;
    },
    async adminUsers(query = "") {
      return request(`${endpoints.adminUsers}${query}`, { auth: true });
    },
    async adminEvents() {
      const body = await request(endpoints.adminEvents, { auth: true });
      return (body && body.data) || [];
    },
    async adminStats() {
      const body = await request(endpoints.adminStats, { auth: true });
      return (body && body.data) || body;
    },
    async updateUserStatus(id, status) {
      const body = await request(endpoints.adminUserStatus(id), { method: "PATCH", body: { status }, auth: true });
      return body && body.data;
    },

    // events
    async listEvents(query = "", opts = {}) {
      const body = await request(`${endpoints.events}${query}`, { auth: opts.auth === true });
      return (body && body.data) || [];
    },
    async getEvent(id) {
      const body = await requestWithOptionalAuth(endpoints.event(id));
      return (body && body.data) || null;
    },
    async createEvent(payload) {
      const body = await request(endpoints.createEvent, { method: "POST", body: payload, auth: true });
      return body && body.data;
    },
    async updateEvent(id, payload) {
      const body = await request(endpoints.updateEvent(id), { method: "PATCH", body: payload, auth: true });
      return body && body.data;
    },
    async cancelEvent(id) {
      return request(endpoints.cancelEvent(id), { method: "POST", auth: true });
    },
    async inviteUsers(eventId, emails) {
      const body = await request(endpoints.eventInvites(eventId), { method: "POST", body: { invitedEmails: emails }, auth: true });
      return body && body.data;
    },
    async getParticipants(eventId) {
      const body = await request(endpoints.eventParticipants(eventId), { auth: true });
      return (body && body.data) || [];
    },
    async checkIn(eventId, qrToken) {
      const body = await request(endpoints.eventCheckIn(eventId), { method: "POST", body: { qrToken }, auth: true });
      return body && body.data;
    },
    async getReport(eventId) {
      const body = await request(endpoints.eventReport(eventId), { auth: true });
      return (body && body.data) || body;
    },
    reportExportUrl(eventId) {
      return `${BASE}${endpoints.eventReportExport(eventId)}`;
    },
    async downloadReport(eventId) {
      const res = await fetch(endpoints.eventReportExport(eventId), {
        headers: { Authorization: `Bearer ${getToken() || ""}` },
      });
      if (!res.ok) {
        const err = new Error(`Export failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return res.blob();
    },
    async getSeats(id) {
      const body = await requestWithOptionalAuth(endpoints.eventSeats(id));
      return (body && body.data) || [];
    },

    // bookings
    async createBooking(eventId, seatId) {
      return request(endpoints.createBooking(eventId), {
        method: "POST", body: { seat: seatId }, auth: true,
      });
    },
    async myBookings() {
      const body = await request(endpoints.myBookings, { auth: true });
      return (body && body.data) || [];
    },
    async bookingTicket(bookingId) {
      const body = await request(endpoints.bookingTicket(bookingId), { auth: true });
      return (body && body.data) || body;
    },
    async cancelMyBooking(bookingId) {
      const body = await request(endpoints.cancelMyBooking(bookingId), { method: "PATCH", auth: true });
      return (body && body.data) || body;
    },

    // payments
    async initiatePayment(payload) {
      const body = await request(endpoints.paymentsInitiate, { method: "POST", body: payload, auth: true });
      return (body && body.data) || body;
    },
    async confirmPayment(txId) {
      const body = await request(endpoints.paymentMockConfirm(txId), { method: "POST", auth: true });
      return (body && body.data) || body;
    },
    async paymentByBooking(bookingId) {
      const body = await request(endpoints.paymentByBooking(bookingId), { auth: true });
      return (body && body.data) || body;
    },

    // support tickets
    async createTicket(payload) {
      const body = await request(endpoints.tickets, { method: "POST", body: payload, auth: true });
      return body && body.data;
    },
    async myTickets(query = "") {
      return request(`${endpoints.tickets}${query}`, { auth: true });
    },
    async getTicket(id) {
      const body = await request(endpoints.ticket(id), { auth: true });
      return (body && body.data) || body;
    },
    async updateTicket(id, payload) {
      const body = await request(endpoints.ticket(id), { method: "PATCH", body: payload, auth: true });
      return body && body.data;
    },
  };

  return api;
})();
