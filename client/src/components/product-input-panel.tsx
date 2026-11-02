import { Braces, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors, FieldKey, ProductInput } from "@/lib/api";
import {
  emptyForm,
  formFromInput,
  inputFromForm,
  inputToJson,
  newRowId,
  type FormState,
} from "@/lib/product-form";
import { SAMPLES } from "@/lib/samples";
import { cn } from "@/lib/utils";

export type InputTab = "form" | "json";

interface Props {
  tab: InputTab;
  onTabChange: (tab: InputTab) => void;
  form: FormState;
  onFormChange: (form: FormState) => void;
  jsonText: string;
  onJsonChange: (text: string) => void;
  fieldErrors: FieldErrors;
  onClearError: (field: FieldKey) => void;
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ProductInputPanel(props: Props) {
  const { tab, form, onFormChange, jsonText, onJsonChange, fieldErrors, onClearError } = props;

  const switchTab = (next: string) => {
    if (next === tab) return;
    if (next === "json") {
      onJsonChange(inputToJson(inputFromForm(form)));
      props.onTabChange("json");
      return;
    }
    // JSON → form: lenient, so a half-filled object still transfers.
    if (!jsonText.trim()) {
      props.onTabChange("form");
      return;
    }
    try {
      const data = JSON.parse(jsonText) as Partial<ProductInput>;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not object");
      const specs =
        data.specs && typeof data.specs === "object" && !Array.isArray(data.specs)
          ? Object.fromEntries(Object.entries(data.specs).map(([k, v]) => [k, String(v ?? "")]))
          : {};
      onFormChange(
        formFromInput({
          name: String(data.name ?? ""),
          manufacturer: String(data.manufacturer ?? ""),
          description: String(data.description ?? ""),
          specs,
        }),
      );
      props.onTabChange("form");
    } catch {
      toast.error("JSON не разобран — исправьте его, чтобы перенести данные в форму");
    }
  };

  const loadSample = (input: ProductInput) => {
    onFormChange(formFromInput(input));
    onJsonChange(inputToJson(input));
    for (const f of ["name", "manufacturer", "specs", "json", "description"] as const) onClearError(f);
  };

  const setField = (key: "name" | "manufacturer" | "description", value: string) => {
    onFormChange({ ...form, [key]: value });
    onClearError(key);
  };

  const setRow = (id: string, patch: Partial<{ key: string; value: string }>) => {
    onFormChange({ ...form, specs: form.specs.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    onClearError("specs");
  };

  const removeRow = (id: string) => {
    const rest = form.specs.filter((r) => r.id !== id);
    onFormChange({ ...form, specs: rest.length ? rest : emptyForm().specs });
  };

  const addRow = () =>
    onFormChange({ ...form, specs: [...form.specs, { id: newRowId(), key: "", value: "" }] });

  return (
    <section className="rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-lg font-bold">Данные о приборе</h2>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="sm" disabled={props.loading}>
                <FileText />
                Загрузить пример
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SAMPLES.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => loadSample(s.input)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            disabled={props.loading}
            onClick={() => {
              onFormChange(emptyForm());
              onJsonChange("");
            }}
          >
            Очистить
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={switchTab} className="px-5 pt-4 pb-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">
            <FileText className="mr-1.5 size-4" />
            Форма
          </TabsTrigger>
          <TabsTrigger value="json">
            <Braces className="mr-1.5 size-4" />
            JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-5 space-y-4">
          <Field label="Название" required error={fieldErrors.name} htmlFor="f-name">
            <Input
              id="f-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Манометр показывающий DM 02"
              aria-invalid={!!fieldErrors.name}
              className={errorRing(fieldErrors.name)}
            />
          </Field>

          <Field
            label="Производитель"
            required
            error={fieldErrors.manufacturer}
            htmlFor="f-manufacturer"
          >
            <Input
              id="f-manufacturer"
              value={form.manufacturer}
              onChange={(e) => setField("manufacturer", e.target.value)}
              placeholder="Манотомь"
              aria-invalid={!!fieldErrors.manufacturer}
              className={errorRing(fieldErrors.manufacturer)}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Характеристики</Label>
              <span className="text-xs text-muted-foreground">пустые значения не передаются в LLM</span>
            </div>
            <div
              className={cn(
                "space-y-2 rounded-md",
                fieldErrors.specs && "ring-2 ring-destructive/40 ring-offset-4 ring-offset-card",
              )}
            >
              {form.specs.map((row) => (
                <div key={row.id} className="flex gap-2">
                  <Input
                    aria-label="Название характеристики"
                    value={row.key}
                    onChange={(e) => setRow(row.id, { key: e.target.value })}
                    placeholder="характеристика"
                    className="flex-1"
                  />
                  <Input
                    aria-label="Значение характеристики"
                    value={row.value}
                    onChange={(e) => setRow(row.id, { value: e.target.value })}
                    placeholder="значение"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить характеристику"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {fieldErrors.specs && <p className="text-xs text-destructive">{fieldErrors.specs}</p>}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus />
              Добавить характеристику
            </Button>
          </div>

          <Field label="Описание / фрагмент паспорта" error={fieldErrors.description} htmlFor="f-desc">
            <Textarea
              id="f-desc"
              rows={5}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Прибор предназначен для измерения избыточного давления…"
            />
          </Field>
        </TabsContent>

        <TabsContent value="json" className="mt-5 space-y-2">
          <Label htmlFor="f-json">Сырой JSON (ProductInput)</Label>
          <Textarea
            id="f-json"
            rows={18}
            spellCheck={false}
            value={jsonText}
            onChange={(e) => {
              onJsonChange(e.target.value);
              onClearError("json");
            }}
            placeholder={'{\n  "name": "…",\n  "manufacturer": "…",\n  "specs": {},\n  "description": ""\n}'}
            aria-invalid={!!fieldErrors.json}
            className={cn("font-mono text-xs leading-relaxed", errorRing(fieldErrors.json))}
          />
          {(["json", "name", "manufacturer", "specs"] as const)
            .filter((k) => fieldErrors[k])
            .map((k) => (
              <p key={k} className="text-xs text-destructive">
                {k === "json" ? "JSON" : k}: {fieldErrors[k]}
              </p>
            ))}
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 border-t px-5 py-4">
        <Button
          variant="brand"
          size="lg"
          className="flex-1"
          onClick={props.onSubmit}
          disabled={props.loading}
        >
          {props.loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {props.loading ? "Генерируем…" : "Сгенерировать"}
        </Button>
        {props.loading && (
          <Button variant="outline" size="lg" onClick={props.onCancel}>
            <X />
            Отменить
          </Button>
        )}
      </div>
    </section>
  );
}

function errorRing(error?: string | undefined) {
  return error ? "border-destructive focus-visible:ring-destructive" : undefined;
}

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
