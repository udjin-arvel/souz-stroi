import type { ProductCardOutput, ProductInput } from "./api";

export function characteristicsToText(out: ProductCardOutput): string {
  return out.characteristics.map((c) => `${c.name}: ${c.value}`).join("\n");
}

export function queriesToText(out: ProductCardOutput): string {
  return out.search_queries.join("\n");
}

export function toMarkdown(input: ProductInput, out: ProductCardOutput): string {
  const lines: string[] = [
    `# ${input.name}`,
    "",
    `**Производитель:** ${input.manufacturer}  `,
    `**Версия промпта:** ${out.prompt_version}`,
    "",
    "## SEO-заголовок",
    "",
    out.seo_title,
    "",
    "## SEO-описание",
    "",
    out.seo_description,
    "",
    "## Характеристики",
    "",
    "| Характеристика | Значение |",
    "|---|---|",
    ...out.characteristics.map((c) => `| ${escapeCell(c.name)} | ${escapeCell(c.value)} |`),
    "",
    "## Поисковые запросы",
    "",
    ...out.search_queries.map((q) => `- ${q}`),
    "",
    "## Commercial-блок",
    "",
    out.commercial_block,
  ];

  if (out.missing_fields.length) {
    lines.push("", "## Требуют уточнения", "", ...out.missing_fields.map((f) => `- ${f}`));
  }
  if (out.warnings.length) {
    lines.push("", "## Предупреждения", "", ...out.warnings.map((w) => `- ${w}`));
  }
  return lines.join("\n") + "\n";
}

function escapeCell(v: string) {
  return v.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function markdownFileName(input: ProductInput): string {
  const slug = input.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `kartochka-${slug || "tovar"}.md`;
}

export function downloadText(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
