import React,{ useState } from "react";
import { useAuth } from "./AuthProvider";
import { LockKeyhole, Mail, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const { signIn, signUp, resetPassword, firebaseConfigured } = useAuth();

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!firebaseConfigured) {
      setError("Configure Firebase in .env.local first.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else if (mode === "signup") {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await resetPassword(email.trim());
        setMessage("Password reset email sent.");
      }
    } catch (err) {
      const messages = {
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/email-already-in-use": "This email is already registered.",
        "auth/weak-password": "Choose a stronger password.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/operation-not-allowed": "Enable Email/Password in Firebase.",
      };

      setError(messages[err.code] || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-hero">
        <div className="brand">
          <div className="brand-icon">ES</div>
          <div>
            <strong>ECHONIX</strong>
            <small>SALES WORKSPACE</small>
          </div>
        </div>

        <div className="hero-copy">
          <span className="kicker">FIELD SALES, MADE SIMPLE</span>
          <h1>
            Your daily work.
            <br />
            <em>One clear picture.</em>
          </h1>
          <p>
            Track field visits, organise reports and prepare
            WhatsApp updates in minutes.
          </p>
        </div>
      </section>

      <section className="auth-side">
        <div className="auth-card">
          <div className="auth-icon">
            <LockKeyhole size={23} />
          </div>

          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>
            {mode === "login"
              ? "Sign in to continue"
              : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
          </h2>

          <p className="sub">
            Secure access to your sales workspace.
          </p>

          {!firebaseConfigured && (
            <div className="notice warning">
              Add your Firebase configuration to .env.local.
            </div>
          )}

          <form onSubmit={submit}>
            {mode === "signup" && (
              <label className="field">
                <span>Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shanis"
                  required
                />
              </label>
            )}

            <label className="field">
              <span>Email address</span>
              <div className="input-icon">
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
            </label>

            {mode !== "reset" && (
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="At least 6 characters"
                  required
                />
              </label>
            )}

            {mode === "login" && (
              <button
                type="button"
                className="link forgot"
                onClick={() => {
                  setMode("reset");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            )}

            {error && <div className="notice error">{error}</div>}
            {message && <div className="notice success">{message}</div>}

            <button className="btn primary auth-submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="switch">
            {mode === "login" ? "New to the workspace? " : "Already have an account? "}
            <button
              className="link"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create account" : "Back to sign in"}
            </button>
            {mode === "reset" && (
              <button className="link" onClick={() => setMode("login")}>
                {" "}· Back to login
              </button>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}