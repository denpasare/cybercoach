import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function ProgressLog({ logs, done }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
        <Terminal size={14} className="text-gray-400" />
        <span className="text-xs font-mono text-gray-400 font-semibold">Scrape Log</span>
        {!done && logs.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Running
          </span>
        )}
        {done && logs.length > 0 && (
          <span className="ml-auto text-xs text-blue-400 font-medium">Complete</span>
        )}
      </div>
      <div className="h-80 overflow-y-auto p-4 font-mono text-xs text-green-300 space-y-0.5">
        {logs.length === 0 ? (
          <span className="text-gray-600">Awaiting start...</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="leading-relaxed whitespace-pre-wrap break-all">
              <span className="text-gray-600 select-none mr-2">
                {String(i + 1).padStart(3, '0')}
              </span>
              <span className={
                line.includes('✓') ? 'text-green-400' :
                line.includes('✗') || line.includes('Error') || line.includes('FAIL') ? 'text-red-400' :
                line.includes('⚠') ? 'text-yellow-400' :
                line.includes('complete') || line.includes('done') ? 'text-blue-300' :
                'text-green-300'
              }>
                {line}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
