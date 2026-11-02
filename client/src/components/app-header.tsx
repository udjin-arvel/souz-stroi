import { useQuery } from "@tanstack/react-query";
import { Activity, FlaskConical, Server, Settings2 } from "lucide-react";
import { useState } from "react";
import heroImage from "@/assets/hero-instruments.jpg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ClientSettings } from "@/hooks/use-client-settings";
import { checkHealth } from "@/lib/api";
import { MOCK_SCENARIOS, type MockScenario } from "@/lib/mock";
import { cn } from "@/lib/utils";

interface Props {
  settings: ClientSettings;
  onChange: (patch: Partial<ClientSettings>) => void;
}

export function useBackendHealth(settings: ClientSettings) {
  return useQuery({
    queryKey: ["health", settings.apiBaseUrl],
    queryFn: () => checkHealth(settings.apiBaseUrl),
    enabled: settings.mode === "api",
    refetchInterval: 15_000,
    retry: false,
  });
}

export function AppHeader({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const health = useBackendHealth(settings);

  const status =
    settings.mode === "mock"
      ? { label: "Демо-режим", dot: "bg-warning", icon: FlaskConical }
      : health.isPending
        ? { label: "Проверка API…", dot: "bg-primary-foreground/50", icon: Activity }
        : health.data
          ? { label: "API доступен", dot: "bg-success", icon: Server }
          : { label: "API недоступен", dot: "bg-brand", icon: Server };

  return (
    <header>
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-md bg-brand font-display text-sm font-extrabold">
              СП
            </span>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold tracking-wide uppercase">
                Союз-Прибор
              </div>
              <div className="text-xs text-primary-foreground/70">AI-помощник контент-менеджера</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10 sm:flex"
            >
              <span className={cn("size-2 rounded-full", status.dot)} />
              <status.icon className="size-4" />
              {status.label}
            </button>
            <Button variant="onDark" size="sm" onClick={() => setOpen(true)}>
              <Settings2 />
              Подключение
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-lg bg-primary-deep">
          <img
            src={heroImage}
            alt="Контрольно-измерительные приборы"
            width={1600}
            height={640}
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-hero" />
          <div className="relative max-w-xl px-6 py-8 text-primary-foreground sm:px-10 sm:py-10">
            <h1 className="text-2xl font-extrabold tracking-tight uppercase sm:text-3xl">
              Карточка товара КИП
            </h1>
            <p className="mt-3 text-base text-primary-foreground/85 sm:text-lg">
              SEO-заголовок, описание, поисковые запросы и commercial-блок. Характеристики — строго
              из исходных данных.
            </p>
          </div>
        </div>
      </div>

      <SettingsDialog open={open} onOpenChange={setOpen} settings={settings} onChange={onChange} />
    </header>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: Props & { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [url, setUrl] = useState(settings.apiBaseUrl);
  const health = useBackendHealth(settings);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setUrl(settings.apiBaseUrl);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подключение к бэкенду</DialogTitle>
          <DialogDescription>
            Клиент отправляет запросы на FastAPI-сервис: <code>POST /api/generate</code>,{" "}
            <code>GET /api/health</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="api-url">Адрес API</Label>
            <div className="flex gap-2">
              <Input
                id="api-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  onChange({ apiBaseUrl: url.trim() });
                  void health.refetch();
                }}
              >
                Применить
              </Button>
            </div>
            {settings.mode === "api" && (
              <p
                className={cn(
                  "text-xs",
                  health.data ? "text-success" : "text-muted-foreground",
                )}
              >
                {health.isFetching
                  ? "Проверяем /api/health…"
                  : health.data
                    ? "Сервис отвечает {\"status\": \"ok\"}"
                    : "Сервис не отвечает. Проверьте, что бэкенд запущен и CORS разрешает этот адрес."}
              </p>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/50 p-4">
            <div>
              <Label htmlFor="mock-mode">Демо-режим</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Ответы формируются в браузере по тем же правилам, без обращения к бэкенду и LLM.
              </p>
            </div>
            <Switch
              id="mock-mode"
              checked={settings.mode === "mock"}
              onCheckedChange={(v) => onChange({ mode: v ? "mock" : "api" })}
            />
          </div>

          {settings.mode === "mock" && (
            <div className="space-y-2">
              <Label>Сценарий ответа</Label>
              <Select
                value={settings.mockScenario}
                onValueChange={(v) => onChange({ mockScenario: v as MockScenario })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_SCENARIOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
