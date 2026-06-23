import { useEffect, useRef, useState } from "react";
import { signInWithEmail, signInWithGoogle } from "../context/AuthContext.jsx";
import { isConfigured } from "../lib/supabase.js";
import Logo from "./Logo.jsx";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const widgetRef = useRef(null);

  // Optional Cloudflare Turnstile CAPTCHA (only if a site key is configured).
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    if (!document.querySelector("script[data-turnstile]")) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "1";
      document.head.appendChild(s);
    }
    let timer;
    const render = () => {
      if (window.turnstile && widgetRef.current && !widgetRef.current.dataset.rendered) {
        window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_KEY,
          callback: (t) => setCaptchaToken(t),
          "expired-callback": () => setCaptchaToken(""),
          "error-callback": () => setCaptchaToken(""),
        });
        widgetRef.current.dataset.rendered = "1";
      } else {
        timer = setTimeout(render, 300);
      }
    };
    render();
    return () => clearTimeout(timer);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    if (TURNSTILE_KEY && !captchaToken) {
      setErr("Please complete the verification challenge.");
      return;
    }
    setBusy(true);
    setErr("");
    const { error } = await signInWithEmail(email.trim(), captchaToken || undefined);
    setBusy(false);
    if (error) {
      console.error("Sign-in error:", error);
      setErr(error.message || error.error_description || JSON.stringify(error));
    } else setSent(true);
  }

  async function google() {
    setErr("");
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("Google sign-in error:", error);
      setErr(error.message || "Google sign-in failed");
    }
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
          <>
            <button className="btn google-btn" onClick={google}>
              Continue with Google
            </button>
            <div className="or-divider"><span>or</span></div>
            <form onSubmit={submit}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              {TURNSTILE_KEY && <div ref={widgetRef} className="turnstile" />}
              <button className="btn primary" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
              {err && <p className="danger" style={{ marginTop: 10 }}>{err}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
