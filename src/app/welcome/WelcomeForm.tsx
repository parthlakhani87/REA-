"use client";

import { useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { api } from "@/lib/client";

export function WelcomeForm({ name, email }: { name: string; email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match");
    setBusy(true);
    setError("");
    try {
      await api("/api/me", { method: "PATCH", json: { newPassword: password } });
      // Home shows the "Get PONGS Connect on your phone" steps next.
      window.location.href = "/app";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title={`Welcome, ${name.split(" ")[0]}`} subtitle="Set your own password to finish setting up your account.">
      <form onSubmit={submit} className="space-y-4">
        <ol className="space-y-1.5 text-[13px] text-ink-2">
          <li>
            <b className="text-ink">1.</b> Choose a password only you know.
          </li>
          <li>
            <b className="text-ink">2.</b> Next, install the app on your phone and turn on notifications.
          </li>
        </ol>
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <div>
          <label className="label">New password (at least 8 characters)</label>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </AuthCard>
  );
}
