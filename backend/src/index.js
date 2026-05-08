require('dotenv').config();
const express = require('express');
const cors = require('cors');

const leadsRouter = require('./routes/leads');
const scrapeRouter = require('./routes/scrape');

const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/leads', leadsRouter);
app.use('/api/scrape', scrapeRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Airbnb Lead Scraper API running on http://localhost:${PORT}`);
});

module.exports = app;
