// Thin client for the FastAPI backend described in the spec (POST /api/generate, GET /api/health).

export interface ProductInput {
  name: string;
  manufacturer: string;
  specs: Record<string, string>;
  description: string;
}

export interface Characteristic {
  name: string;
  value: string;
}

export interface ProductCardOutput {
  seo_title: string;
  seo_description: string;
  characteristics: Characteristic[];
  search_queries: string[];
  commercial_block: string;
  missing_fields: string[];
  warnings: string[];
  prompt_version: string;
}

/** Field keys the UI can highlight. "json" is the raw JSON textarea. */
export type FieldKey = "name" | "manufacturer" | "description" | "specs" | "json";
export type FieldErrors = { [K in FieldKey]?: string | undefined };

export const NO_DATA = "данных нет";
export const CLIENT_TIMEOUT_MS = 95_000; // backend total timeout is 90 s

const STATUS_MESSAGES: Record<number, string> = {
  401: "Ошибка конфигурации LLM",
  402: "Сервис LLM временно недоступен",
  422: "Проверьте входные данные",
  429: "Слишком много запросов, попробуйте позже",
  500: "Сервис LLM временно недоступен",
  503: "Сервис LLM временно недоступен",
  504: "Превышено время ожидания ответа LLM",
};

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  readonly retryable: boolean;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    // 422 / 401 / 402 need a fix first; everything else may succeed on retry.
    this.retryable = ![401, 402, 422].includes(status);
  }
}

interface PydanticErrorItem {
  loc?: (string | number)[];
  msg?: string;
}

const KNOWN_FIELDS = new Set<string>(["name", "manufacturer", "description", "specs"]);

/** Translate a FastAPI error body (`{detail: string}` or Pydantic list) into an ApiError. */
export function parseErrorBody(status: number, body: unknown): ApiError {
  const fallback = STATUS_MESSAGES[status] ?? `Ошибка сервера (${status})`;
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return new ApiError(status, detail);
  }

  if (Array.isArray(detail)) {
    const fieldErrors: FieldErrors = {};
    const messages: string[] = [];
    for (const item of detail as PydanticErrorItem[]) {
      const loc = (item.loc ?? []).filter((p) => p !== "body").map(String);
      const field = (loc.find((p) => KNOWN_FIELDS.has(p)) as FieldKey | undefined) ??
        (loc.length ? "json" : undefined);
      const msg = humanizePydanticMessage(item.msg ?? "Некорректное значение");
      if (field && !fieldErrors[field]) fieldErrors[field] = msg;
      messages.push(loc.length ? `${loc.join(".")}: ${msg}` : msg);
    }
    return new ApiError(status, messages.join("; ") || fallback, fieldErrors);
  }

  return new ApiError(status, fallback);
}

function humanizePydanticMessage(msg: string): string {
  if (/field required/i.test(msg)) return "Обязательное поле";
  if (/at least 1 character/i.test(msg)) return "Поле не может быть пустым";
  if (/json/i.test(msg)) return "Некорректный JSON";
  return msg;
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export async function generateCard(
  baseUrl: string,
  input: ProductInput,
  signal?: AbortSignal,
): Promise<ProductCardOutput> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), CLIENT_TIMEOUT_MS);
  const onAbort = () => timeout.abort("user");
  signal?.addEventListener("abort", onAbort);

  let res: Response;
  try {
    res = await fetch(joinUrl(baseUrl, "/api/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      signal: timeout.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new ApiError(499, "Запрос отменён");
    if (timeout.signal.aborted) throw new ApiError(504, "Превышено время ожидания ответа LLM");
    throw new ApiError(
      0,
      `Не удалось подключиться к бэкенду (${baseUrl}). Проверьте, что сервис запущен и CORS разрешает этот адрес.`,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseErrorBody(res.status, body);
  if (!body || typeof body !== "object" || !("seo_title" in body)) {
    throw new ApiError(502, "Бэкенд вернул ответ в неожиданном формате");
  }
  return normalizeOutput(body as Partial<ProductCardOutput>);
}

function normalizeOutput(o: Partial<ProductCardOutput>): ProductCardOutput {
  return {
    seo_title: o.seo_title ?? "",
    seo_description: o.seo_description ?? "",
    characteristics: o.characteristics ?? [],
    search_queries: o.search_queries ?? [],
    commercial_block: o.commercial_block ?? "",
    missing_fields: o.missing_fields ?? [],
    warnings: o.warnings ?? [],
    prompt_version: o.prompt_version ?? "—",
  };
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(joinUrl(baseUrl, "/api/health"), { signal: ctrl.signal });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
