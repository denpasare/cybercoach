const db = require('../db/database');

function computeScore(lead) {
  let score = 0;
  if (lead.website) score += 2;
  if (lead.phone) score += 2;
  if (lead.rating && lead.rating > 4.0) score += 1;
  if (lead.reviews_count && lead.reviews_count > 10) score += 1;
  return score;
}

function computeTags(lead) {
  const tags = [];
  const isHot =
    lead.website &&
    lead.phone &&
    lead.rating &&
    lead.rating > 4.3;
  tags.push(isHot ? 'hot' : 'normal');
  return tags;
}

function upsertLead(leadData) {
  const score = computeScore(leadData);
  const tags = computeTags(leadData);

  const stmt = db.prepare(`
    INSERT INTO leads (name, address, phone, website, google_maps_url, rating, reviews_count, email, tags, score)
    VALUES (@name, @address, @phone, @website, @google_maps_url, @rating, @reviews_count, @email, @tags, @score)
    ON CONFLICT(name, address) DO UPDATE SET
      phone = COALESCE(excluded.phone, phone),
      website = COALESCE(excluded.website, website),
      google_maps_url = COALESCE(excluded.google_maps_url, google_maps_url),
      rating = COALESCE(excluded.rating, rating),
      reviews_count = COALESCE(excluded.reviews_count, reviews_count),
      email = COALESCE(excluded.email, email),
      tags = excluded.tags,
      score = excluded.score,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `);

  return stmt.get({
    ...leadData,
    tags: JSON.stringify(tags),
    score,
  });
}

function getLeads({ hasWebsite, minRating, hotOnly, search, page = 1, limit = 50 } = {}) {
  let conditions = [];
  let params = {};

  if (hasWebsite === 'true') conditions.push("website IS NOT NULL AND website != ''");
  if (hasWebsite === 'false') conditions.push("(website IS NULL OR website = '')");

  if (minRating) {
    conditions.push("rating >= @minRating");
    params.minRating = parseFloat(minRating);
  }

  if (hotOnly === 'true') {
    conditions.push("tags LIKE '%hot%'");
  }

  if (search) {
    conditions.push("(name LIKE @search OR address LIKE @search)");
    params.search = `%${search}%`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const rows = db.prepare(`
    SELECT * FROM leads ${where}
    ORDER BY score DESC, rating DESC
    LIMIT ${parseInt(limit)} OFFSET ${offset}
  `).all(params);

  const total = db.prepare(`SELECT COUNT(*) as count FROM leads ${where}`).get(params).count;

  return {
    leads: rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags || '["normal"]'),
    })),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / parseInt(limit)),
  };
}

function getLeadById(id) {
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, tags: JSON.parse(row.tags || '["normal"]') };
}

function getAllLeadsForExport() {
  const rows = db.prepare('SELECT * FROM leads ORDER BY score DESC').all();
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '["normal"]'),
  }));
}

function createScrapeJob(query) {
  const stmt = db.prepare(`INSERT INTO scrape_jobs (query) VALUES (?) RETURNING *`);
  return stmt.get(query);
}

function updateScrapeJob(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE scrape_jobs SET ${fields} WHERE id = @id`).run({ ...updates, id });
}

module.exports = {
  upsertLead,
  getLeads,
  getLeadById,
  getAllLeadsForExport,
  createScrapeJob,
  updateScrapeJob,
  computeScore,
  computeTags,
};
