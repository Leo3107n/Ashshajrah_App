"use client";

export default function CoordinatorPortalSection({
  id,
  title,
  description,
  children,
  className = "",
  showBrand = true,
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            {showBrand ? (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">
                Coordinator Portal
              </p>
            ) : null}
            <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm leading-7 text-[#245C4F]">
                {description}
              </p>
            ) : null}
          </div>
        </header>

        <div>{children}</div>
      </div>
    </section>
  );
}
