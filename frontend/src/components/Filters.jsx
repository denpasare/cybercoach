import { Search, X } from 'lucide-react';

export default function Filters({ filters, onChange, onClear }) {
  const handle = (key, val) => onChange({ ...filters, [key]: val, page: 1 });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Text search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-8 w-52"
          placeholder="Search name or address..."
          value={filters.search || ''}
          onChange={e => handle('search', e.target.value)}
        />
      </div>

      {/* Website filter */}
      <select
        className="input w-44"
        value={filters.hasWebsite || ''}
        onChange={e => handle('hasWebsite', e.target.value)}
      >
        <option value="">All websites</option>
        <option value="true">Has website</option>
        <option value="false">No website</option>
      </select>

      {/* Rating filter */}
      <select
        className="input w-44"
        value={filters.minRating || ''}
        onChange={e => handle('minRating', e.target.value)}
      >
        <option value="">Any rating</option>
        <option value="4.5">4.5+</option>
        <option value="4.0">4.0+</option>
        <option value="3.5">3.5+</option>
      </select>

      {/* Hot leads toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => handle('hotOnly', filters.hotOnly === 'true' ? '' : 'true')}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            filters.hotOnly === 'true' ? 'bg-brand-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              filters.hotOnly === 'true' ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">🔥 Hot only</span>
      </label>

      {/* Clear */}
      {Object.values(filters).some(v => v && v !== '1' && v !== '50') && (
        <button onClick={onClear} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <X size={14} /> Clear filters
        </button>
      )}
    </div>
  );
}
