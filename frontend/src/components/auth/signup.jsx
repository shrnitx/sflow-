import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "./auth.css";
import StudyFlowHeroAnimation from "../StudyFlowHeroAnimation";

export default function Signup({ onShowLogin, tasks = [] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Please enter your name.");
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

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setMessage("Account created successfully.");
    } else {
      setMessage("Account created. Check your email if confirmation is required.");
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
        <h1>Create Account</h1>
        <p>Start using StudyFlow.</p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />

          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <label htmlFor="signup-confirm">Confirm Password</label>
          <input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
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
      </main>
    </div>
  );
}