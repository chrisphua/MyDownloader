import { useState, type FormEvent } from "react";
import { signIn, signUp } from "@/lib/auth";

type Screen = "sign-in" | "sign-up";

export function AuthForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [screen, setScreen] = useState<Screen>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em || !password) { setError("Email and password are required"); return; }
    setError(""); setLoading(true);
    try {
      await signIn(em, password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally { setLoading(false); }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em || !password) { setError("Email and password are required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      await signUp(em, password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-container">
      {screen === "sign-in" && (
        <form className="auth-form" onSubmit={handleSignIn}>
          <h2 className="auth-heading">Welcome back</h2>
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="auth-footer">
            Don't have an account?{" "}
            <button type="button" className="auth-link" onClick={() => { setScreen("sign-up"); setError(""); }}>
              Sign up
            </button>
          </p>
        </form>
      )}

      {screen === "sign-up" && (
        <form className="auth-form" onSubmit={handleSignUp}>
          <h2 className="auth-heading">Create account</h2>
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" type="password" placeholder="Password (8+ chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
          <p className="auth-footer">
            Already have an account?{" "}
            <button type="button" className="auth-link" onClick={() => { setScreen("sign-in"); setError(""); }}>
              Sign in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
