const express = require('express');
const router = express.Router();
const { scrapeGoogleMaps } = require('../scraper/googleMapsScraper');
const { enrichLead } = require('../scraper/websiteEnricher');
const { upsertLead, createScrapeJob, updateScrapeJob } = require('../services/leadService');

// In-memory SSE clients map: jobId -> [res, ...]
const sseClients = new Map();

function broadcastLog(jobId, message) {
  const clients = sseClients.get(String(jobId)) || [];
  const data = JSON.stringify({ type: 'log', message, timestamp: new Date().toISOString() });
  clients.forEach(res => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {}
  });
}

function broadcastDone(jobId, stats) {
  const clients = sseClients.get(String(jobId)) || [];
  const data = JSON.stringify({ type: 'done', stats, timestamp: new Date().toISOString() });
  clients.forEach(res => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {}
  });
}

// GET /api/scrape/progress/:jobId  (SSE)
router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keep alive ping
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 15000);

  const key = String(jobId);
  if (!sseClients.has(key)) sseClients.set(key, []);
  sseClients.get(key).push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    const list = sseClients.get(key) || [];
    const idx = list.indexOf(res);
    if (idx > -1) list.splice(idx, 1);
  });
});

// POST /api/scrape/start
router.post('/start', async (req, res) => {
  const {
    query = 'Airbnb property management Miami',
    maxResults = 40,
    enrich = true,
  } = req.body;

  const job = createScrapeJob(query);
  res.json({ jobId: job.id, message: 'Scrape job started' });

  // Run scraping in background (don't await in request handler)
  setImmediate(async () => {
    const log = msg => broadcastLog(job.id, msg);
    log(`Job #${job.id} started — Query: "${query}"`);
    updateScrapeJob(job.id, { status: 'running' });

    try {
      const rawLeads = await scrapeGoogleMaps(query, log, parseInt(maxResults));
      log(`\nScraping done. ${rawLeads.length} leads found. Starting enrichment...`);

      let saved = 0;
      for (const lead of rawLeads) {
        try {
          const enriched = enrich ? await enrichLead(lead, log) : lead;
          upsertLead(enriched);
          saved++;
        } catch (err) {
          log(`  ✗ Failed to save lead "${lead.name}": ${err.message}`);
        }
      }

      const stats = { total: rawLeads.length, saved };
      updateScrapeJob(job.id, {
        status: 'completed',
        leads_found: saved,
        finished_at: new Date().toISOString(),
      });
      broadcastDone(job.id, stats);
      log(`\nJob complete! ${saved} leads saved to database.`);
    } catch (err) {
      log(`\nJob FAILED: ${err.message}`);
      updateScrapeJob(job.id, { status: 'failed', finished_at: new Date().toISOString() });
      broadcastDone(job.id, { error: err.message });
    } finally {
      // Clean up SSE clients after a delay
      setTimeout(() => sseClients.delete(String(job.id)), 60000);
    }
  });
});

// GET /api/scrape/jobs
router.get('/jobs', (req, res) => {
  const db = require('../db/database');
  const jobs = db.prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT 20').all();
  res.json(jobs);
});

module.exports = router;
