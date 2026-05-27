export function ScoreBadge({ score, label = "Tripwise score" }: { score: number; label?: string }) {
  const tone = score >= 84 ? "bg-sea text-white" : score >= 72 ? "bg-ink text-white" : "bg-coral text-white";

  return (
    <div className={`inline-flex min-w-20 flex-col items-center rounded-lg px-3 py-2 shadow-sm ${tone}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      <span className="text-2xl font-black leading-none">{score}</span>
    </div>
  );
}
