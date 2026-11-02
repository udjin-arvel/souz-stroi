import { describe, expect, it } from "vitest";
import { NO_DATA, parseErrorBody } from "@/lib/api";
import { mockGenerate } from "@/lib/mock";
import { inputFromForm, parseJsonInput, validateForm } from "@/lib/product-form";

describe("input validation", () => {
  it("requires name and manufacturer in the form", () => {
    const errors = validateForm({ name: " ", manufacturer: "", description: "", specs: [] });
    expect(Object.keys(errors).sort()).toEqual(["manufacturer", "name"]);
  });

  it("reports broken JSON as a JSON error", () => {
    const r = parseJsonInput('{"name": "x",');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.json).toBeDefined();
  });

  it("reports missing manufacturer in JSON", () => {
    const r = parseJsonInput('{"name": "Манометр"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.manufacturer).toBeDefined();
  });

  it("skips spec rows without a key", () => {
    const input = inputFromForm({
      name: "A",
      manufacturer: "B",
      description: "",
      specs: [
        { id: "1", key: "класс точности", value: "1,5" },
        { id: "2", key: "", value: "" },
      ],
    });
    expect(input.specs).toEqual({ "класс точности": "1,5" });
  });
});

describe("422 mapping", () => {
  it("maps Pydantic loc to the form field", () => {
    const err = parseErrorBody(422, {
      detail: [{ loc: ["body", "name"], msg: "Field required" }],
    });
    expect(err.fieldErrors.name).toBe("Обязательное поле");
    expect(err.retryable).toBe(false);
  });

  it("treats 429 as retryable", () => {
    expect(parseErrorBody(429, null).retryable).toBe(true);
  });
});

describe("demo mode keeps characteristics honest", () => {
  it("uses only input specs and marks absent expected fields as 'данных нет'", async () => {
    const out = await mockGenerate(
      {
        name: "Манометр",
        manufacturer: "Манотомь",
        specs: { "класс точности": "1,5", "питание": "" },
        description: "",
      },
      "success",
    );
    const real = out.characteristics.filter((c) => c.value !== NO_DATA);
    expect(real).toEqual([{ name: "класс точности", value: "1,5" }]);
    expect(out.missing_fields).toContain("питание");
    expect(out.seo_title.length).toBeLessThanOrEqual(70);
  }, 5000);
});
