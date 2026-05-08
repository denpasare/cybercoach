import { ExternalLink, Phone, Globe, Mail, MapPin } from 'lucide-react';
import ScoreBar from './ScoreBar';
import StarRating from './StarRating';

function TagBadge({ tag }) {
  if (tag === 'hot') {
    return (
      <span className="badge-hot">
        🔥 Hot
      </span>
    );
  }
  return <span className="badge-normal">Normal</span>;
}

function TextCell({ value, icon: Icon, href, truncate = false }) {
  if (!value) return <span className="text-gray-300 text-sm">—</span>;

  const content = (
    <span className={`text-sm ${truncate ? 'max-w-[160px] truncate block' : ''}`}>{value}</span>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 group"
      >
        {Icon && <Icon size={13} className="flex-shrink-0" />}
        {content}
        <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </a>
    );
  }

  return (
    <div className="flex items-center gap-1 text-gray-700">
      {Icon && <Icon size={13} className="flex-shrink-0 text-gray-400" />}
      {content}
    </div>
  );
}

export default function LeadsTable({ leads, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading leads...
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="text-center py-24 text-gray-400">
        <Globe size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No leads found</p>
        <p className="text-sm mt-1">Run a scrape job to populate leads.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr className="bg-gray-50">
            {['Business', 'Address', 'Phone', 'Website', 'Email', 'Rating', 'Score', 'Tag', 'Maps'].map(h => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {leads.map(lead => (
            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px]">
                <span className="block truncate" title={lead.name}>{lead.name}</span>
              </td>
              <td className="px-4 py-3 max-w-[200px]">
                <TextCell value={lead.address} icon={MapPin} truncate />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <TextCell
                  value={lead.phone}
                  icon={Phone}
                  href={lead.phone ? `tel:${lead.phone.replace(/\s/g, '')}` : null}
                />
              </td>
              <td className="px-4 py-3 max-w-[180px]">
                <TextCell
                  value={lead.website ? new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname.replace('www.', '') : null}
                  icon={Globe}
                  href={lead.website}
                  truncate
                />
              </td>
              <td className="px-4 py-3 max-w-[180px]">
                <TextCell
                  value={lead.email}
                  icon={Mail}
                  href={lead.email ? `mailto:${lead.email}` : null}
                  truncate
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StarRating rating={lead.rating} count={lead.reviews_count} />
              </td>
              <td className="px-4 py-3">
                <ScoreBar score={lead.score ?? 0} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {(lead.tags || []).map(tag => <TagBadge key={tag} tag={tag} />)}
              </td>
              <td className="px-4 py-3">
                {lead.google_maps_url ? (
                  <a
                    href={lead.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-500 hover:text-brand-700 transition-colors"
                  >
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
