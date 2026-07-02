import type { LegalSection } from "@/lib/platform-legal";

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
      <p className="mt-1 text-sm text-ink-500">Последна актуализация: 3 юли 2026 г.</p>
      <div className="mt-8 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-xl font-bold text-ink-900">{section.title}</h2>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-700">
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
