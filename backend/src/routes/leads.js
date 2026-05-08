const express = require('express');
const router = express.Router();
const { getLeads, getLeadById, getAllLeadsForExport } = require('../services/leadService');
const { format } = require('@fast-csv/format');

// GET /api/leads
router.get('/', (req, res) => {
  try {
    const result = getLeads(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const lead = getLeadById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// GET /api/leads/export/csv
router.get('/export/csv', (req, res) => {
  try {
    const leads = getAllLeadsForExport();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');

    const csvStream = format({ headers: true });
    csvStream.pipe(res);

    for (const lead of leads) {
      csvStream.write({
        id: lead.id,
        name: lead.name,
        address: lead.address || '',
        phone: lead.phone || '',
        website: lead.website || '',
        google_maps_url: lead.google_maps_url || '',
        rating: lead.rating ?? '',
        reviews_count: lead.reviews_count ?? '',
        email: lead.email || '',
        tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : lead.tags,
        score: lead.score ?? 0,
        created_at: lead.created_at,
      });
    }

    csvStream.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
