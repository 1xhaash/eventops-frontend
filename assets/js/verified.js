/* =========================================================
   Email verification result
   Reads ?status=success|invalid|missing|error (default: invalid)
   and shows the matching state in the auth card.
   ========================================================= */
(function () {
  const params = new URLSearchParams(window.location.search);
  const status = (params.get("status") || "invalid").toLowerCase();

  const success = document.getElementById("verifiedSuccess");
  const error = document.getElementById("verifiedError");
  const errorTitle = document.getElementById("verifiedErrorTitle");
  const errorText = document.getElementById("verifiedErrorText");

  const MESSAGES = {
    invalid: {
      title: "Verification failed",
      text: "This verification link is invalid or has expired.",
    },
    missing: {
      title: "Verification link is incomplete",
      text: "The verification token is missing from this link.",
    },
    error: {
      title: "Something went wrong",
      text: "We couldn't verify your email right now. Please try again later.",
    },
  };

  if (status === "success") {
    success.hidden = false;
    document.title = "EventOps · Email Verified";
  } else {
    const info = MESSAGES[status] || MESSAGES.invalid;
    errorTitle.textContent = info.title;
    errorText.textContent = info.text;
    error.hidden = false;
    document.title = "EventOps · Verification failed";
  }
})();
