import { useState } from 'react';
import { Download, RefreshCw, Users, Flame, Globe, Star } from 'lucide-react';
import { useLeads, exportCsv } from '../hooks/useLeads';
import LeadsTable from '../components/LeadsTable';
import Filters from '../components/Filters';

const DEFAULT_FILTERS = { page: 1, limit: 50 };

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { leads, total, pages, loading, error, refetch } = useLeads(filters);

  const { leads: allLeads } = useLeads({});
  const hotCount = allLeads.filter(l => l.tags?.includes('hot')).length;
  const withWebsite = allLeads.filter(l => l.website).length;
  const avgRating =
    allLeads.filter(l => l.rating).reduce((s, l) => s + l.rating, 0) /
    (allLeads.filter(l => l.rating).length || 1);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Miami Airbnb property managers & vacation rental agencies</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={15} />
            Refresh
          </button>
          <button onClick={exportCsv} className="btn-primary flex items-center gap-1.5">
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={allLeads.length} color="bg-blue-500" />
        <StatCard icon={Flame} label="Hot Leads" value={hotCount} color="bg-brand-500" />
        <StatCard icon={Globe} label="Have Website" value={withWebsite} color="bg-purple-500" />
        <StatCard
          icon={Star}
          label="Avg Rating"
          value={isNaN(avgRating) ? '—' : avgRating.toFixed(1)}
          color="bg-yellow-400"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <Filters filters={filters} onChange={setFilters} onClear={clearFilters} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-800">{leads.length}</span> of{' '}
            <span className="font-semibold text-gray-800">{total}</span> leads
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary py-1 text-xs"
                disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                {filters.page} / {pages}
              </span>
              <button
                className="btn-secondary py-1 text-xs"
                disabled={filters.page >= pages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </button>
            </div>
          )}
        </div>
        <LeadsTable leads={leads} loading={loading} />
      </div>
    </div>
  );
}
