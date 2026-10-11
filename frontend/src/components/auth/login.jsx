import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "./auth.css";
import StudyFlowHeroAnimation from "../StudyFlowHeroAnimation";

export default function Login({ onShowSignup, tasks = [] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-page studyflow-auth-page">
      <main className="studyflow-auth-layout">
        <section className="studyflow-auth-showcase">
          <div className="studyflow-auth-kicker">
            <span className="studyflow-auth-kicker-dot" />
            FROM STUDY CHAOS TO DAILY FLOW
          </div>
          <h2>Make room for <span>better focus.</span></h2>
          <p>See your recent study work at a glance, celebrate completed tasks, and keep your next step clear.</p>
          <StudyFlowHeroAnimation tasks={tasks} />
          <div className="studyflow-auth-note">
            <span className="studyflow-auth-note-mark">✓</span>
            Your planner reflects tasks saved in this browser.
          </div>
        </section>
        <div className="auth-card">
        <h1>Welcome Back</h1>
        <p>Login to continue to StudyFlow.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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