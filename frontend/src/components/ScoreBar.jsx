export default function ScoreBar({ score, max = 6 }) {
  const pct = Math.min((score / max) * 100, 100);
  const color =
    score >= 5 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-400' : 'bg-gray-300';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden w-16">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-4">{score}</span>
    </div>
  );
}
