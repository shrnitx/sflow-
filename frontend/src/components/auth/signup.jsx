import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getAuthErrorMessage } from "../../lib/authErrors";
import "./auth.css";

export default function Signup({ onShowLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: name.trim(),
          },
        },
      });

      if (signupError) {
        setError(getAuthErrorMessage(signupError));
        return;
      }

      if (!data.user) {
        setError("Supabase did not return a user. Check the Auth configuration and try again.");
        return;
      }

      // Supabase can deliberately return an obfuscated user for an existing
      // email when email confirmation is enabled.
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("We couldn't create a new account with this email. Try logging in instead.");
        return;
      }

      if (data.session) {
        setMessage("Account created successfully. You are now signed in.");
      } else {
        setMessage(
          "Account created. Check your inbox and spam folder for the confirmation link before logging in. If no email arrives, ask the project owner to configure custom SMTP in Supabase."
        );
      }
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p>Start using StudyFlow.</p>

        {error && <div className="auth-error" role="alert" aria-live="polite">{error}</div>}
        {message && <div className="auth-success" role="status" aria-live="polite">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />

          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          <label htmlFor="signup-confirm">Confirm Password</label>
          <input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p>
          Already have an account?{" "}
          <button
            type="button"
            className="auth-link"
            onClick={onShowLogin}
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
