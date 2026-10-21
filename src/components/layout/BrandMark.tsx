export function BrandMark({ className = 'h-8 w-8 p-1.5' }: { className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-0.5 rounded-lg bg-gradient-to-br from-brand to-violet-600 shadow-lg shadow-brand/20 ${className}`}
      aria-hidden="true"
    >
      <span className="rounded-[2px] bg-white/90" />
      <span className="rounded-[2px] bg-white/50" />
      <span className="rounded-[2px] bg-white/50" />
      <span className="rounded-[2px] bg-white/90" />
    </div>
  )
}
