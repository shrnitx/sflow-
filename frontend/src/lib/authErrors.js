export function getAuthErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (
    code === "email_address_not_authorized" ||
    message.includes("email address not authorized") ||
    message.includes("not authorized to send")
  ) {
    return "Supabase's built-in email sender only sends to authorized project-team addresses. Configure custom SMTP for your Supabase project; see AUTH_SETUP.md.";
  }

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit") ||
    message.includes("email send rate limit") ||
    message.includes("over_email_send_rate_limit")
  ) {
    return "Supabase's built-in email sender is limited to 2 emails per hour. Configure custom SMTP in Supabase to support more sign-ups; see AUTH_SETUP.md.";
  }

  if (
    code === "over_request_rate_limit" ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  ) {
    return "Too many authentication attempts were made in a short time. Wait a few minutes and try again. Email-send limits require custom SMTP in Supabase.";
  }

  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect. Check both and try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email using the link in your inbox before logging in.";
  }

  if (message.includes("user already registered")) {
    return "An account with this email already exists. Log in instead.";
  }

  if (
    message.includes("password should be at least") ||
    message.includes("password is too short")
  ) {
    return "Choose a longer password. It must be at least 6 characters.";
  }

  if (!error?.message) {
    return "Authentication failed. Check your connection and Supabase configuration, then try again.";
  }

  return error.message;
}
