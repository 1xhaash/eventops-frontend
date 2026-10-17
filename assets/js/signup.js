/* =========================================================
   EventOps · Sign-Up form
   Validation + role selection + POST /api/auth/signup
   ========================================================= */

const form = document.getElementById("signupForm");
const fields = {
  fullName: document.getElementById("fullName"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- helpers ---------- */
const fieldOf = (input) => input.closest(".field");

function setValid(input) {
  fieldOf(input).classList.remove("is-invalid");
}

function setInvalid(input, message) {
  const field = fieldOf(input);
  field.classList.add("is-invalid");
  if (message) {
    field.querySelector(".field__error").lastChild.textContent = message;
  }
}

/* ---------- individual validators ---------- */
const validators = {
  fullName: (v) => (v.trim().length >= 3 ? "" : "Please enter your full name."),
  email: (v) => (EMAIL_RE.test(v.trim()) ? "" : "Please enter a valid email address."),
  password: (v) => (v.length >= 6 ? "" : "Password must be at least 6 characters."),
};

function validateInput(input) {
  const rule = validators[input.id];
  if (!rule) return true;
  const error = rule(input.value);
  error ? setInvalid(input, error) : setValid(input);
  return !error;
}

/* ---------- live validation ---------- */
Object.values(fields).forEach((input) => {
  input.addEventListener("blur", () => validateInput(input));
  input.addEventListener("input", () => {
    if (fieldOf(input).classList.contains("is-invalid")) validateInput(input);
  });
});

/* ---------- password visibility toggle ---------- */
document.querySelectorAll(".input-wrap__toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});

/* ---------- submit ---------- */
form.addEventListener("submit", (ev) => {
  ev.preventDefault();

  Object.values(fields).map(validateInput);
  const firstInvalid = Object.values(fields).find((i) =>
    fieldOf(i).classList.contains("is-invalid")
  );

  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const roleEl = document.querySelector('input[name="role"]:checked');

  const payload = {
    name: fields.fullName.value.trim(),
    email: fields.email.value.trim(),
    password: fields.password.value,
    role: roleEl ? roleEl.value : "user",
  };

  const btn = form.querySelector(".btn-brand");
  btn.disabled = true;
  btn.style.opacity = ".7";

  API.signup(payload)
    .then(() => {
      form.hidden = true;
      const foot = document.querySelector(".auth-card__foot");
      if (foot) foot.hidden = true;

      const emailEl = document.getElementById("signupSuccessEmail");
      if (emailEl) emailEl.textContent = payload.email;

      const success = document.getElementById("signupSuccess");
      if (success) success.hidden = false;
    })
    .catch((err) => {
      if (err.status === undefined) {
        setInvalid(fields.email, "Unable to connect. Please try again.");
        fields.email.focus();
        return;
      }

      const errors = (err.data && err.data.errors) || [];
      let target = fields.email;
      let message = err.message || "Signup failed. Please try again.";

      for (const e of errors) {
        if (/name/i.test(e)) { target = fields.fullName; message = e; break; }
        if (/password/i.test(e)) { target = fields.password; message = e; break; }
        if (/email/i.test(e)) { target = fields.email; message = e; break; }
      }

      setInvalid(target, message);
      target.focus();
    })
    .finally(() => {
      btn.disabled = false;
      btn.style.opacity = "1";
    });
});
