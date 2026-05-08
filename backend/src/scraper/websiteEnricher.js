const axios = require('axios');
const cheerio = require('cheerio');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const CONTACT_PAGE_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/reach-us', '/support'];

async function fetchPage(url, timeout = 8000) {
  try {
    const resp = await axios.get(url, {
      timeout,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    return resp.data;
  } catch {
    return null;
  }
}

function extractEmails(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  // Remove script/style tags
  $('script, style, noscript').remove();
  const text = $.text();
  const matches = text.match(EMAIL_REGEX) || [];
  // Remove duplicates and filter out common false positives
  return [...new Set(matches)].filter(
    e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('.gif') && e.length < 80
  );
}

function buildFallbackEmails(domain) {
  const clean = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  return [`info@${clean}`, `contact@${clean}`];
}

async function extractEmailFromWebsite(website) {
  if (!website) return null;

  let baseUrl = website.startsWith('http') ? website : `https://${website}`;
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  // Try main page first
  let html = await fetchPage(baseUrl);
  let emails = extractEmails(html);
  if (emails.length > 0) return emails[0];

  // Try contact pages
  for (const path of CONTACT_PAGE_PATHS) {
    html = await fetchPage(`${baseUrl}${path}`);
    emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
  }

  // Fallback: try common patterns
  const domain = baseUrl.replace(/^https?:\/\//, '');
  const fallbacks = buildFallbackEmails(domain);
  // We return first fallback as a "guessed" email — caller can mark it differently
  return null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  try {
    const parsed = parsePhoneNumberFromString(phone, 'US');
    if (parsed && parsed.isValid()) {
      return parsed.formatNational();
    }
  } catch {}
  // Return cleaned version if can't parse
  return phone.replace(/[^\d\s\-().+]/g, '').trim() || null;
}

async function enrichLead(lead, onProgress) {
  const enriched = { ...lead };

  // Normalize phone
  enriched.phone = normalizePhone(lead.phone);

  // Extract email from website
  if (lead.website) {
    onProgress && onProgress(`  Enriching: checking website for email: ${lead.website}`);
    enriched.email = await extractEmailFromWebsite(lead.website);
    if (enriched.email) {
      onProgress && onProgress(`  Found email: ${enriched.email}`);
    }
  }

  return enriched;
}

module.exports = { enrichLead, normalizePhone, extractEmailFromWebsite };
