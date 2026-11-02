import {
  AlertTriangle,
  Download,
  FileJson,
  FlaskConical,
  RotateCcw,
  SearchCheck,
  ServerCrash,
} from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NO_DATA, type ApiError, type ProductCardOutput, type ProductInput } from "@/lib/api";
import {
  characteristicsToText,
  downloadText,
  markdownFileName,
  queriesToText,
  toMarkdown,
} from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; input: ProductInput; output: ProductCardOutput }
  | { status: "error"; error: ApiError };

interface Props {
  state: ResultState;
  onRetry: () => void;
  onEnableDemo: () => void;
  isDemo: boolean;
}

export function ResultPanel({ state, onRetry, onEnableDemo, isDemo }: Props) {
  if (state.status === "idle") return <EmptyState isDemo={isDemo} onEnableDemo={onEnableDemo} />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return (
      <ErrorState error={state.error} onRetry={onRetry} onEnableDemo={onEnableDemo} isDemo={isDemo} />
    );
  return <SuccessState input={state.input} output={state.output} />;
}

function EmptyState({ isDemo, onEnableDemo }: { isDemo: boolean; onEnableDemo: () => void }) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed bg-card p-10 text-center">
      <div className="max-w-sm">
        <SearchCheck className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 text-lg font-bold">Здесь появится черновик карточки</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Заполните форму или вставьте JSON, затем нажмите «Сгенерировать». Можно начать с кнопки
          «Загрузить пример».
        </p>
        {!isDemo && (
          <Button variant="link" size="sm" className="mt-3" onClick={onEnableDemo}>
            <FlaskConical />
            Нет запущенного бэкенда? Включить демо-режим
          </Button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        Генерация может занять до 60 секунд — LLM пишет тексты, характеристики собираются из ваших
        данных.
      </p>
      {[56, 180, 140, 90].map((h, i) => (
        <div key={i} className="rounded-lg border bg-card p-5 shadow-card">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 w-full" style={{ height: h }} />
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  onEnableDemo,
  isDemo,
}: {
  error: ApiError;
  onRetry: () => void;
  onEnableDemo: () => void;
  isDemo: boolean;
}) {
  const title =
    error.status === 0
      ? "Бэкенд недоступен"
      : error.status === 422
        ? "Проверьте входные данные"
        : error.status === 499
          ? "Запрос отменён"
          : `Ошибка ${error.status}`;

  return (
    <div className="rounded-lg border border-destructive/30 bg-danger-soft p-6" role="alert">
      <div className="flex items-start gap-3">
        <ServerCrash className="mt-0.5 size-6 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-destructive">{title}</h2>
          <p className="mt-1 text-sm break-words text-foreground">{error.message}</p>
          {error.status === 422 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Проблемные поля подсвечены в форме слева.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onRetry}>
              <RotateCcw />
              Повторить
            </Button>
            {error.status === 0 && !isDemo && (
              <Button variant="outline" onClick={onEnableDemo}>
                <FlaskConical />
                Включить демо-режим
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessState({ input, output }: { input: ProductInput; output: ProductCardOutput }) {
  const titleLen = output.seo_title.length;
  const descLen = output.seo_description.length;
  const descOk = descLen >= 800 && descLen <= 1200;
  const filled = output.characteristics.filter((c) => c.value !== NO_DATA).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-4 shadow-card">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            Черновик готов · промпт <span className="font-mono">{output.prompt_version}</span>
          </div>
          <div className="truncate font-display font-bold">{input.name}</div>
        </div>
        <div className="flex gap-2">
          <CopyButton text={JSON.stringify(output, null, 2)} label="JSON" />
          <Button
            variant="default"
            size="sm"
            onClick={() => downloadText(markdownFileName(input), toMarkdown(input, output))}
          >
            <Download />
            Скачать .md
          </Button>
        </div>
      </div>

      {(output.warnings.length > 0 || output.missing_fields.length > 0) && (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
          {output.warnings.length > 0 && (
            <div className="flex flex-wrap items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 text-warning-foreground" />
              {output.warnings.map((w) => (
                <Badge key={w} variant="warning">
                  {w}
                </Badge>
              ))}
            </div>
          )}
          {output.missing_fields.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-warning-foreground">Требуют уточнения:</span>
              {output.missing_fields.map((f) => (
                <Badge key={f} variant="missing">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <Block
        title="SEO-заголовок"
        meta={<Counter value={titleLen} ok={titleLen <= 70} hint="≤ 70" />}
        copy={output.seo_title}
      >
        <p className="font-display text-lg font-semibold">{output.seo_title}</p>
      </Block>

      <Block
        title="SEO-описание"
        meta={<Counter value={descLen} ok={descOk} hint="800–1200" />}
        copy={output.seo_description}
      >
        <p className="text-sm leading-relaxed whitespace-pre-line">{output.seo_description}</p>
      </Block>

      <Block
        title="Характеристики"
        meta={
          <span className="text-xs text-muted-foreground">
            {filled} из {output.characteristics.length} заполнено · из входных данных
          </span>
        }
        copy={characteristicsToText(output)}
      >
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              {output.characteristics.map((c, i) => (
                <tr key={`${c.name}-${i}`} className="border-b last:border-b-0 odd:bg-muted/40">
                  <td className="w-1/2 px-3 py-2 text-muted-foreground">{c.name}</td>
                  <td className="px-3 py-2 font-medium">
                    {c.value === NO_DATA ? (
                      <Badge variant="missing">{NO_DATA}</Badge>
                    ) : (
                      c.value
                    )}
                  </td>
                </tr>
              ))}
              {output.characteristics.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground">Нет характеристик</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Поисковые запросы"
        meta={
          <Counter
            value={output.search_queries.length}
            ok={output.search_queries.length >= 3 && output.search_queries.length <= 5}
            hint="3–5"
            unit="шт."
          />
        }
        copy={queriesToText(output)}
      >
        <ul className="flex flex-wrap gap-2">
          {output.search_queries.map((q) => (
            <li key={q} className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground">
              {q}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Commercial-блок для менеджера" copy={output.commercial_block}>
        <p className="text-sm leading-relaxed whitespace-pre-line">{output.commercial_block}</p>
      </Block>

      <details className="rounded-lg border bg-card px-5 py-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-muted-foreground">
          <FileJson className="size-4" />
          Сырой ответ API
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
          {JSON.stringify(output, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Block({
  title,
  meta,
  copy,
  children,
}: {
  title: string;
  meta?: ReactNode;
  copy: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold tracking-wide text-primary uppercase">{title}</h3>
          {meta}
        </div>
        <CopyButton text={copy} />
      </div>
      {children}
    </section>
  );
}

function Counter({
  value,
  ok,
  hint,
  unit = "симв.",
}: {
  value: number;
  ok: boolean;
  hint: string;
  unit?: string;
}) {
  return (
    <span
      className={cn(
        "tabular rounded px-1.5 py-0.5 text-xs font-medium",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground",
      )}
    >
      {value} {unit} · {hint}
    </span>
  );
}
