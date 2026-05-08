import { Star } from 'lucide-react';

export default function StarRating({ rating, count }) {
  if (!rating) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Star size={13} className="text-yellow-400 fill-yellow-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {count != null && (
        <span className="text-xs text-gray-400">({count.toLocaleString()})</span>
      )}
    </div>
  );
}
