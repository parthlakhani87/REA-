"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { api } from "@/lib/client";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", cities: "Mumbai, Pune, Ahmedabad" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/setup", {
        method: "POST",
        json: { ...form, cities: form.cities.split(",").map((c) => c.trim()).filter(Boolean) },
      });
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthCard title="Welcome to PONGS Connect" subtitle="Create the first admin account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Your name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} required />
        </div>
        <div>
          <label className="label">Password (min 8 characters)</label>
          <input className="input" type="password" minLength={8} value={form.password} onChange={set("password")} required />
        </div>
        <div>
          <label className="label">Cities (comma separated)</label>
          <input className="input" value={form.cities} onChange={set("cities")} />
          <p className="mt-1 text-xs text-slate-500">
            Each city gets Sales, Project, Accounts and Dispatch groups. You can add more later.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Setting up…" : "Create workspace"}
        </button>
      </form>
    </AuthCard>
  );
}
