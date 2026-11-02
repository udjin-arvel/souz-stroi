import type { FieldErrors, ProductInput } from "./api";

export interface SpecRow {
  id: string;
  key: string;
  value: string;
}

export interface FormState {
  name: string;
  manufacturer: string;
  description: string;
  specs: SpecRow[];
}

let rowSeq = 0;
export const newRowId = () => `row-${Date.now().toString(36)}-${(rowSeq++).toString(36)}`;

export const emptyForm = (): FormState => ({
  name: "",
  manufacturer: "",
  description: "",
  specs: [{ id: newRowId(), key: "", value: "" }],
});

export function formFromInput(input: ProductInput): FormState {
  const rows = Object.entries(input.specs ?? {}).map(([key, value]) => ({
    id: newRowId(),
    key,
    value,
  }));
  return {
    name: input.name ?? "",
    manufacturer: input.manufacturer ?? "",
    description: input.description ?? "",
    specs: rows.length ? rows : [{ id: newRowId(), key: "", value: "" }],
  };
}

/**
 * Build the request payload. Rows with neither key nor value are skipped;
 * rows with a key but empty value are sent as-is — the backend drops them.
 */
export function inputFromForm(form: FormState): ProductInput {
  const specs: Record<string, string> = {};
  for (const row of form.specs) {
    const key = row.key.trim();
    if (!key) continue;
    specs[key] = row.value.trim();
  }
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    specs,
    description: form.description.trim(),
  };
}

/** Client-side mirror of the backend rules, so obvious mistakes never leave the browser. */
export function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Укажите название товара";
  if (!form.manufacturer.trim()) errors.manufacturer = "Укажите производителя";
  if (form.specs.some((r) => !r.key.trim() && r.value.trim())) {
    errors.specs = "У характеристики со значением должно быть название";
  }
  return errors;
}

export type ParseResult =
  | { ok: true; input: ProductInput }
  | { ok: false; error: string; fieldErrors: FieldErrors };

/** Parse the raw JSON tab. Mirrors the backend 422 rules with readable Russian messages. */
export function parseJsonInput(raw: string): ParseResult {
  if (!raw.trim()) {
    return { ok: false, error: "Вставьте JSON с данными товара", fieldErrors: { json: "Пусто" } };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Некорректный JSON: ${msg}`,
      fieldErrors: { json: "Синтаксическая ошибка" },
    };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      error: "Ожидается JSON-объект вида { \"name\": ..., \"manufacturer\": ... }",
      fieldErrors: { json: "Не объект" },
    };
  }

  const obj = data as { name?: unknown; manufacturer?: unknown; specs?: unknown; description?: unknown };
  const fieldErrors: FieldErrors = {};
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  if (typeof obj.name !== "string" || !obj.name.trim()) fieldErrors.name = "Обязательное поле";
  if (typeof obj.manufacturer !== "string" || !obj.manufacturer.trim()) {
    fieldErrors.manufacturer = "Обязательное поле";
  }

  let specs: Record<string, string> = {};
  if (obj.specs !== undefined && obj.specs !== null) {
    if (typeof obj.specs !== "object" || Array.isArray(obj.specs)) {
      fieldErrors.specs = "specs должен быть объектом { \"ключ\": \"значение\" }";
    } else {
      specs = Object.fromEntries(
        Object.entries(obj.specs as Record<string, unknown>).map(([k, v]) => [k, str(v)]),
      );
    }
  }

  if (Object.keys(fieldErrors).length) {
    const list = Object.entries(fieldErrors as Record<string, string>)
      .map(([k, v]) => `${k} — ${v}`)
      .join(", ");
    return { ok: false, error: `Проверьте поля: ${list}`, fieldErrors };
  }

  return {
    ok: true,
    input: {
      name: str(obj.name).trim(),
      manufacturer: str(obj.manufacturer).trim(),
      specs,
      description: str(obj.description).trim(),
    },
  };
}

export const inputToJson = (input: ProductInput) => JSON.stringify(input, null, 2);
