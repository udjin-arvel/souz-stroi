// Demo mode: imitates the backend contract locally so the client can be shown without FastAPI.
// Follows the same rules as the spec: characteristics are built only from specs,
// expected-but-absent fields get "данных нет".
import { ApiError, NO_DATA, type ProductCardOutput, type ProductInput } from "./api";

export type MockScenario = "success" | "422" | "429" | "503" | "504";

export const MOCK_SCENARIOS: { value: MockScenario; label: string }[] = [
  { value: "success", label: "Успешный ответ" },
  { value: "422", label: "422 — ошибка валидации" },
  { value: "429", label: "429 — лимит запросов" },
  { value: "503", label: "503 — LLM недоступна" },
  { value: "504", label: "504 — таймаут LLM" },
];

const EXPECTED_FIELDS = [
  "диапазон измерений",
  "класс точности",
  "присоединение",
  "диаметр корпуса",
  "питание",
  "интерфейсы",
];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new ApiError(499, "Запрос отменён"));
    });
  });

export async function mockGenerate(
  input: ProductInput,
  scenario: MockScenario,
  signal?: AbortSignal,
): Promise<ProductCardOutput> {
  await wait(1400, signal);

  switch (scenario) {
    case "422":
      throw new ApiError(422, "manufacturer: Обязательное поле", {
        manufacturer: "Обязательное поле (ответ сервера)",
      });
    case "429":
      throw new ApiError(429, "Слишком много запросов, попробуйте позже");
    case "503":
      throw new ApiError(503, "Сервис LLM временно недоступен");
    case "504":
      throw new ApiError(504, "Превышено время ожидания ответа LLM");
  }

  const specs = Object.entries(input.specs).filter(([, v]) => v.trim());
  const lowerKeys = new Set(specs.map(([k]) => k.toLowerCase()));
  const missing = EXPECTED_FIELDS.filter((f) => !lowerKeys.has(f));

  const characteristics = [
    ...specs.map(([name, value]) => ({ name, value })),
    ...missing.map((name) => ({ name, value: NO_DATA })),
  ];

  const warnings: string[] = [];
  const dropped = Object.entries(input.specs).filter(([, v]) => !v.trim());
  if (dropped.length) {
    warnings.push(`Пустые характеристики отброшены: ${dropped.map(([k]) => k).join(", ")}`);
  }

  let seoTitle = `${input.name} ${input.manufacturer} — купить`;
  if (seoTitle.length > 70) {
    seoTitle = seoTitle.slice(0, 70).trimEnd();
    warnings.push("SEO-заголовок обрезан до 70 символов");
  }

  const specSentence = specs.length
    ? `Ключевые параметры: ${specs.map(([k, v]) => `${k} — ${v}`).join("; ")}.`
    : "Технические параметры в исходных данных не указаны.";

  const paragraphs = [
    `${input.name} производства «${input.manufacturer}» — контрольно-измерительный прибор для промышленных предприятий, сервисных организаций и проектных бюро.`,
    input.description,
    specSentence,
    "Прибор подходит для включения в спецификации оборудования, комплектации объектов и замены вышедших из строя средств измерений. Перед заказом рекомендуем сверить исполнение с требованиями проекта и условиями эксплуатации на объекте.",
    "Поставляем приборы для юридических лиц с полным комплектом документов. Менеджер поможет подобрать исполнение, уточнит сроки поставки и подготовит коммерческое предложение под вашу задачу. Возможна поставка партиями и под конкретный проект.",
    "Оставьте заявку на сайте или позвоните нам — специалист проконсультирует по совместимости, документации и условиям доставки в ваш регион.",
  ].filter(Boolean);

  let seoDescription = "";
  for (const p of paragraphs) {
    const next = seoDescription ? `${seoDescription} ${p}` : p;
    if (next.length > 1200) break;
    seoDescription = next;
  }
  if (seoDescription.length < 800) {
    warnings.push(`SEO-описание ${seoDescription.length} символов — ниже диапазона 800–1200`);
  }

  const first = specs[0];
  const kind = (input.name.split(" ")[0] ?? input.name).toLowerCase();
  const search_queries = [
    `${input.name.toLowerCase()} купить`,
    `${input.name.toLowerCase()} ${input.manufacturer.toLowerCase()}`,
    first ? `${kind} ${first[1]}` : `${input.manufacturer} цена`,
    `${kind} ${input.manufacturer.toLowerCase()} цена`,
  ];

  const commercial_block = [
    `Кому подходит: службам КИПиА, инжиниринговым и монтажным компаниям, которым нужен ${kind} от «${input.manufacturer}».`,
    "Какие задачи решает: оснащение и модернизация объектов, замена приборов в рамках планового ТО.",
    missing.length
      ? `Перед КП уточните у клиента: ${missing.join(", ")}.`
      : "Все ожидаемые характеристики переданы.",
  ].join("\n");

  return {
    seo_title: seoTitle,
    seo_description: seoDescription,
    characteristics,
    search_queries,
    commercial_block,
    missing_fields: missing,
    warnings,
    prompt_version: "demo-mock",
  };
}
