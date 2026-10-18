"use client";

// Per-device conveniences kept in localStorage: theme, panel state and saved messages.
// Every access is guarded so private windows and blocked storage simply fall back to defaults.

import { useCallback, useEffect, useState } from "react";

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pc:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`pc:${key}`, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new CustomEvent("pc:pref", { detail: key }));
}

export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(readPref(key, fallback));
    const onChange = (e: Event) => (e as CustomEvent).detail === key && setValue(readPref(key, fallback));
    window.addEventListener("pc:pref", onChange);
    return () => window.removeEventListener("pc:pref", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((v: T) => writePref(key, v), [key]);
  return [value, set];
}

export type ThemeChoice = "light" | "dark" | "system";

export function applyTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem("pc:theme", choice);
  } catch {}
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function currentTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem("pc:theme");
    return t === "dark" || t === "system" ? t : "light";
  } catch {
    return "light";
  }
}

export type SavedMessage = {
  id: number;
  channelId: number;
  channelName: string;
  userName: string;
  body: string;
  createdAt: string;
  savedAt: string;
  hasAttachments: boolean;
};

export function useSaved(userId: number) {
  const [saved, setSaved] = usePref<SavedMessage[]>(`saved:${userId}`, []);
  const isSaved = useCallback((id: number) => saved.some((s) => s.id === id), [saved]);
  const toggle = useCallback(
    (m: Omit<SavedMessage, "savedAt">) => {
      const current = readPref<SavedMessage[]>(`saved:${userId}`, []);
      setSaved(
        current.some((s) => s.id === m.id)
          ? current.filter((s) => s.id !== m.id)
          : [{ ...m, savedAt: new Date().toISOString() }, ...current].slice(0, 500),
      );
    },
    [userId, setSaved],
  );
  return { saved, isSaved, toggle };
}
