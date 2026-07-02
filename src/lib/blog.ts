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

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export interface BlogPost extends BlogPostMeta {
  html: string;
}

function parseFile(fileName: string): BlogPost {
  const slug = fileName.replace(/\.md$/, "");
  const raw = readFileSync(join(BLOG_DIR, fileName), "utf-8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    html: marked.parse(content, { async: false }),
  };
}

export function getAllPosts(): BlogPostMeta[] {
  return readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseFile)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ slug, title, description, date }) => ({ slug, title, description, date }));
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
