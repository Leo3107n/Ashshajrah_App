"use client";

export default function ActiveHeadlinesBanner({ items = [] }) {
  if (!items.length) return null;
  const featured = items[0];
  const secondary = items.slice(1, 4);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white/90 px-4 py-3 shadow-[0_12px_36px_-24px_rgba(13,59,46,0.24)] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#C9A227] via-[#2D8A6A] to-[#C9A227]" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#B32C12]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B32C12]">Important Headline</p>
          </div>
          <h2 className="line-clamp-2 text-sm font-semibold leading-6 text-[#063F32] sm:text-base">{featured.headline}</h2>
        </div>
        {secondary.length ? (
          <div className="grid min-w-0 gap-2 lg:w-[42%]">
            {secondary.map((item, index) => (
              <article key={item.id} className="rounded-xl border border-[#2D8A6A]/15 bg-[#FAF7F0]/80 px-3 py-2">
                <p className="line-clamp-1 text-xs font-medium leading-5 text-[#245C4F]">
                  <span className="mr-1 font-bold text-[#C9A227]">{index + 2}.</span>
                  {item.headline}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
