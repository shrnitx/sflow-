import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getAuthErrorMessage } from "../../lib/authErrors";
import "./auth.css";
import StudyFlowHeroAnimation from "../StudyFlowHeroAnimation";

export default function Login({ onShowSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        setError(getAuthErrorMessage(loginError));
      }
      // AuthContext listens for Supabase's auth-state event and opens StudyFlow.
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page studyflow-auth-page">
      <main className="studyflow-auth-layout">
        <section className="studyflow-auth-showcase">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            STUDENT PRODUCTIVITY
          </div>
          <h1>StudyFlow</h1>
          <p>Plan classes, revise for exams and build consistent focus in one calm workspace.</p>
          <StudyFlowHeroAnimation />
        </section>
        <div className="auth-card">
        <h1>Welcome Back</h1>
        <p>Login to continue to StudyFlow.</p>

        {error && <div className="auth-error" role="alert" aria-live="polite">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p>
          Don't have an account?{" "}
          <button
            type="button"
            className="auth-link"
            onClick={onShowSignup}
          >
            Create account
          </button>
        </p>
        </div>
      </main>
    </div>
  );
}
