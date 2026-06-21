import { useState } from "react";
import { signInWithEmail } from "../context/AuthContext.jsx";
import { isConfigured } from "../lib/supabase.js";
import Logo from "./Logo.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr("");
    const { error } = await signInWithEmail(email.trim());
    setBusy(false);
    if (error) {
      console.error("Sign-in error:", error);
      setErr(error.message || error.error_description || JSON.stringify(error));
    } else setSent(true);
  }

  return (
    <div className="center">
      <div className="authcard">
        <Logo className="brand-mark-lg" size={44} />
        <h1>Ex Libris</h1>
        <p>Your personal archive</p>

        {!isConfigured && (
          <div className="banner">
            Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code> and add your
            project URL and anon key, then restart the dev server.
          </div>
        )}

        {sent ? (
          <p style={{ marginTop: 18 }}>
            Check your inbox — we sent a magic sign-in link to <b>{email}</b>. Open it on this device to
            continue.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button className="btn primary" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {err && <p className="danger" style={{ marginTop: 10 }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
