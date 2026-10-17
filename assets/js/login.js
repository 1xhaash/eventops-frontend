/* =========================================================
   EventOps · Login form
   Client-side validation + API call + UI states
   ========================================================= */

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const alertBox = document.getElementById("loginAlert");
const blockedCard = document.getElementById("blockedCard");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fieldOf = (input) => input.closest(".field");

/* ---------- alert helpers ---------- */
function showAlert(message) {
  if (message) alertBox.querySelector(".auth-alert__text").textContent = message;
  alertBox.classList.add("is-visible");
}

function hideAlert() {
  alertBox.classList.remove("is-visible");
}

function showBlocked() { blockedCard.classList.add("is-visible"); }
function hideBlocked() { blockedCard.classList.remove("is-visible"); }

/* ---------- field helpers ---------- */
function markValid(input) { fieldOf(input).classList.remove("is-invalid"); }

/* ---------- password visibility ---------- */
document.querySelectorAll(".input-wrap__toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});

/* ---------- dismiss alert ---------- */
document.getElementById("alertClose").addEventListener("click", hideAlert);

/* clear invalid state as the user types */
[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => markValid(input));
});

/* ---------- submit ---------- */
form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  hideAlert();
  hideBlocked();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let valid = true;

  if (!EMAIL_RE.test(email)) valid = false;
  if (password.length < 1) valid = false;

  if (!valid) {
    showAlert("Invalid email or password");
    return;
  }

  const btn = form.querySelector(".btn-brand");
  btn.disabled = true;
  btn.style.opacity = ".7";
  btn.textContent = "Logging in...";

  API.login(email, password)
    .then(() => {
      window.location.href = "dashboard.html";
    })
    .catch((err) => {
      if (err.status === undefined) {
        showAlert("Unable to connect. Please try again.");
        return;
      }

      if (err.status === 403) {
        if (/block/i.test(err.message || "")) showBlocked();
        else showAlert(err.message || "Your account cannot log in yet.");
        return;
      }

      showAlert(err.message || "Invalid email or password");
    })
    .finally(() => {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = "Login";
    });
});
