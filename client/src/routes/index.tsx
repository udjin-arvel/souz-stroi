import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { ProductInputPanel, type InputTab } from "@/components/product-input-panel";
import { ResultPanel, type ResultState } from "@/components/result-panel";
import { useClientSettings } from "@/hooks/use-client-settings";
import { ApiError, generateCard, type FieldErrors, type FieldKey, type ProductInput } from "@/lib/api";
import { mockGenerate } from "@/lib/mock";
import {
  emptyForm,
  inputFromForm,
  parseJsonInput,
  validateForm,
  type FormState,
} from "@/lib/product-form";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI-помощник карточек товаров КИП — Союз-Прибор" },
      {
        name: "description",
        content:
          "Черновик карточки товара для B2B-магазина КИП: SEO-заголовок, описание, характеристики из исходных данных, поисковые запросы.",
      },
      { property: "og:title", content: "AI-помощник карточек товаров КИП" },
      {
        property: "og:description",
        content: "Генерация SEO-текстов для приборов без выдуманных характеристик.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { settings, update } = useClientSettings();
  const [tab, setTab] = useState<InputTab>("form");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [jsonText, setJsonText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const clearError = useCallback(
    (field: FieldKey) =>
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }),
    [],
  );

  const collectInput = (): ProductInput | null => {
    if (tab === "json") {
      const parsed = parseJsonInput(jsonText);
      if (!parsed.ok) {
        setFieldErrors(parsed.fieldErrors);
        toast.error(parsed.error);
        return null;
      }
      return parsed.input;
    }
    const errors = validateForm(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast.error("Заполните обязательные поля");
      return null;
    }
    return inputFromForm(form);
  };

  const submit = async () => {
    const input = collectInput();
    if (!input) return;

    setFieldErrors({});
    setResult({ status: "loading" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const output =
        settings.mode === "mock"
          ? await mockGenerate(input, settings.mockScenario, ctrl.signal)
          : await generateCard(settings.apiBaseUrl, input, ctrl.signal);
      setResult({ status: "success", input, output });
    } catch (err) {
      const error =
        err instanceof ApiError ? err : new ApiError(500, "Непредвиденная ошибка клиента");
      if (error.status === 422) {
        // JSON tab has no per-field inputs: route field errors to the textarea too.
        setFieldErrors(tab === "json" ? { json: error.message, ...error.fieldErrors } : error.fieldErrors);
      }
      setResult({ status: "error", error });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <AppHeader settings={settings} onChange={update} />

      <main className="mx-auto mt-6 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-6">
            <ProductInputPanel
              tab={tab}
              onTabChange={setTab}
              form={form}
              onFormChange={setForm}
              jsonText={jsonText}
              onJsonChange={setJsonText}
              fieldErrors={fieldErrors}
              onClearError={clearError}
              loading={result.status === "loading"}
              onSubmit={submit}
              onCancel={() => abortRef.current?.abort()}
            />
          </div>
        </div>
        <div className="lg:col-span-7">
          <ResultPanel
            state={result}
            onRetry={submit}
            isDemo={settings.mode === "mock"}
            onEnableDemo={() => {
              update({ mode: "mock" });
              toast.success("Демо-режим включён — ответы формируются в браузере");
            }}
          />
        </div>
      </main>
    </div>
  );
}
