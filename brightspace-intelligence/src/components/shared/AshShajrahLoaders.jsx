"use client";

function LoadingTitle({ title, subtitle }) {
  return (
    <div className="mt-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">
        {title}
      </p>
      {subtitle ? <p className="mt-2 text-sm text-[#245C4F]">{subtitle}</p> : null}
    </div>
  );
}

export function OpenBookLoader({ title = "Loading", subtitle = "Opening your classroom..." }) {
  return (
    <div className="grid place-items-center gap-3 py-10">
      <div className="ash-book-loader relative h-[126px] w-[170px] perspective-[700px]">
        <div className="book-base absolute left-1/2 bottom-[18px] h-[72px] w-[150px] -translate-x-1/2 rounded-[10px_10px_18px_18px] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.12),rgba(201,162,39,0.14))]" />
        <div className="ash-book-page-left absolute bottom-[28px] left-[15px] h-[82px] w-[70px] origin-right rounded-[14px_4px_8px_14px] border border-[#2D8A6A]/10 bg-[#fffaf0] shadow-[0_12px_26px_rgba(13,59,46,0.1)]" />
        <div className="ash-book-page-right absolute bottom-[28px] right-[15px] h-[82px] w-[70px] origin-left rounded-[4px_14px_14px_8px] border border-[#2D8A6A]/10 bg-[#fffaf0] shadow-[0_12px_26px_rgba(13,59,46,0.1)]" />
        <div className="ash-book-line absolute left-[20px] right-[20px] bottom-0 h-[5px] overflow-hidden rounded-full bg-[#2D8A6A]/10">
          <span className="ash-book-line-bar block h-full w-[45%] rounded-full bg-[linear-gradient(90deg,#2D8A6A,#C9A227,#E4C766)]" />
        </div>
      </div>
      <LoadingTitle title={title} subtitle={subtitle} />
    </div>
  );
}

export function LeafSpinnerLoader({ title = "Working", subtitle = "Please wait..." }) {
  return (
    <div className="grid place-items-center gap-3 py-8">
      <div className="flex items-center justify-center">
        <div className="relative h-[96px] w-[96px] rounded-full border-4 border-[#2D8A6A]/15 border-t-[#C9A227] animate-spin">
          <div className="absolute left-1/2 top-1/2 h-[40px] w-[28px] -translate-x-1/2 -translate-y-1/2 rotate-[-28deg] rounded-[70%_0_70%_0] bg-[#2D8A6A] shadow-[0_0_22px_rgba(45,138,106,0.28)]" />
        </div>
      </div>
      <LoadingTitle title={title} subtitle={subtitle} />
    </div>
  );
}

export function LeafSpinnerInline({ className = "" }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#FFF5D6]/35 border-t-[#FFF5D6] animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}
