import { useState, useRef, useEffect } from 'react';
import { Play, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { startScrapeJob } from '../hooks/useLeads';
import ProgressLog from '../components/ProgressLog';

const PRESET_QUERIES = [
  'Airbnb property management Miami',
  'vacation rental agency Miami',
  'short term rental management Miami',
  'property manager Airbnb Miami Beach',
  'VRBO property management Miami',
];

export default function Scrape() {
  const [query, setQuery] = useState(PRESET_QUERIES[0]);
  const [maxResults, setMaxResults] = useState(40);
  const [enrich, setEnrich] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const esRef = useRef(null);

  const appendLog = line => setLogs(prev => [...prev, line]);

  function connectSSE(id) {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/scrape/progress/${id}`);
    esRef.current = es;

    es.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log') {
        appendLog(msg.message);
      } else if (msg.type === 'done') {
        setStats(msg.stats);
        setIsDone(true);
        setIsRunning(false);
        es.close();
      }
    };

    es.onerror = () => {
      if (isDone) return;
      es.close();
    };
  }

  async function handleStart() {
    setLogs([]);
    setStats(null);
    setError(null);
    setIsDone(false);
    setIsRunning(true);

    try {
      const { jobId: id } = await startScrapeJob({ query, maxResults, enrich });
      setJobId(id);
      connectSSE(id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setIsRunning(false);
    }
  }

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Start a Scrape Job</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Extract leads from Google Maps based on your search query.
        </p>
      </div>

      {/* Query Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Search Query
          </label>
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Airbnb property management Miami"
            disabled={isRunning}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESET_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                disabled={isRunning}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  query === q
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            disabled={isRunning}
          >
            <Settings size={14} />
            {showAdvanced ? 'Hide' : 'Show'} advanced settings
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Max Results
                </label>
                <input
                  type="number"
                  className="input w-32"
                  min={5}
                  max={200}
                  value={maxResults}
                  onChange={e => setMaxResults(parseInt(e.target.value))}
                  disabled={isRunning}
                />
                <p className="text-xs text-gray-400 mt-1">Recommended: 20–60 to avoid blocks</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enrich}
                  onChange={e => setEnrich(e.target.checked)}
                  disabled={isRunning}
                  className="w-4 h-4 text-brand-500 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enrich leads (extract email from website)
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={handleStart}
            disabled={isRunning || !query.trim()}
            className="btn-primary flex items-center gap-2 w-full justify-center py-3"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scraping in progress...
              </>
            ) : (
              <>
                <Play size={16} />
                Start Scraping
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results stats banner */}
      {isDone && stats && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3">
          <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-green-600" />
          <div>
            <p className="font-semibold text-sm">Scrape complete!</p>
            <p className="text-sm">
              {stats.saved ?? stats.total} leads saved to database.{' '}
              <a href="/dashboard" className="underline font-medium">View in Dashboard →</a>
            </p>
          </div>
        </div>
      )}

      {/* Log output */}
      {(logs.length > 0 || isRunning) && (
        <ProgressLog logs={logs} done={isDone} />
      )}
    </div>
  );
}
