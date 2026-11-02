import { useCallback, useEffect, useState } from "react";
import type { MockScenario } from "@/lib/mock";

export type ClientMode = "api" | "mock";

export interface ClientSettings {
  apiBaseUrl: string;
  mode: ClientMode;
  mockScenario: MockScenario;
}

const STORAGE_KEY = "souz-ai-client-settings";

export const DEFAULT_SETTINGS: ClientSettings = {
  apiBaseUrl: (import.meta.env["VITE_API_BASE_URL"] as string | undefined) || "http://localhost:8000",
  mode: "api",
  mockScenario: "success",
};

export function useClientSettings() {
  const [settings, setSettings] = useState<ClientSettings>(DEFAULT_SETTINGS);

  // Read storage after hydration to avoid SSR mismatches.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ClientSettings>) });
    } catch {
      /* ignore broken storage */
    }
  }, []);

  const update = useCallback((patch: Partial<ClientSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, update };
}
