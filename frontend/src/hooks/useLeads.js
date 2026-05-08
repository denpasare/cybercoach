import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = '/api';

export function useLeads(filters = {}) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      const { data } = await axios.get(`${API}/leads`, { params });
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, total, pages, loading, error, refetch: fetchLeads };
}

export async function startScrapeJob(payload) {
  const { data } = await axios.post(`${API}/scrape/start`, payload);
  return data;
}

export function exportCsv() {
  window.open(`${API}/leads/export/csv`, '_blank');
}
