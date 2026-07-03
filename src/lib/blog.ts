import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * Файлов блог: .md файлове в content/blog/ с frontmatter.
 * Съдържанието е наше (в repo-то) → рендерът на HTML е доверен.
 */

const BLOG_DIR = join(process.cwd(), "content", "blog");

/** Раздел на статията — за баджове и филтриране в списъка. */
export type BlogCategory = "Продажби" | "Право" | "Доставки" | "Растеж" | "Маркетинг";

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: BlogCategory;
  /** Приблизително време за четене в минути (200 думи/мин). */
  readingMinutes: number;
}

/** Заглавие от статията (##) за навигацията в дясната колона. */
export interface BlogHeading {
  id: string;
  text: string;
}

export interface BlogPost extends BlogPostMeta {
  html: string;
  headings: BlogHeading[];
}

const CATEGORIES: BlogCategory[] = ["Продажби", "Право", "Доставки", "Растеж", "Маркетинг"];

function normalizeCategory(value: unknown): BlogCategory {
  const v = String(value ?? "").trim();
  return CATEGORIES.find((c) => c === v) ?? "Продажби";
}

/** Кирилско заглавие → латински slug за anchor (id на <h2>). */
function slugifyHeading(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
  };
  return text
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function parseFile(fileName: string): BlogPost {
  const slug = fileName.replace(/\.md$/, "");
  const raw = readFileSync(join(BLOG_DIR, fileName), "utf-8");
  const { data, content } = matter(raw);

  /* Anchor id-та на всяко ## заглавие — за навигацията и линковете. */
  const headings: BlogHeading[] = [];
  const usedIds = new Set<string>();
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }) => {
    if (depth === 2) {
      let id = slugifyHeading(text) || `sekciya-${headings.length + 1}`;
      while (usedIds.has(id)) id = `${id}-${headings.length + 1}`;
      usedIds.add(id);
      headings.push({ id, text });
      return `<h2 id="${id}">${text}</h2>\n`;
    }
    return `<h${depth}>${text}</h${depth}>\n`;
  };

  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    category: normalizeCategory(data.category),
    readingMinutes: readingMinutes(content),
    html: marked.parse(content, { async: false, renderer }),
    headings,
  };
}

export function getAllPosts(): BlogPostMeta[] {
  return readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseFile)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ slug, title, description, date, category, readingMinutes }) => ({
      slug,
      title,
      description,
      date,
      category,
      readingMinutes,
    }));
}

export function getPost(slug: string): BlogPost | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return parseFile(`${slug}.md`);
  } catch {
    return null;
  }
}

export function formatPostDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(parsed);
}
