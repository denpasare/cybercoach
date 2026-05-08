# Email Abuse Detection System
## SMTP + SES Intelligence Layer

A government-ready, passive email infrastructure risk analysis platform for SMEs and organizations.

---

## Overview

This Laravel 11 / PHP 8.3 application detects and scores risky email sending infrastructure using **passive, metadata-only analysis** — no active scanning, no exploitation, no brute force.

### Detected Abuse Vectors

**SMTP Misconfiguration Abuse**
- Open SMTP relay indicators (via banner metadata)
- Misconfigured Postfix / Exim / Sendmail (MX hostname pattern matching)
- PHP `mail()` abuse (Laravel / legacy apps)
- Exposed SMTP endpoints
- Laravel queue mail misconfiguration (email queue explosion risk)

**Cloud Email API / SES Abuse**
- AWS SES usage anomalies (heuristic-based)
- SendGrid / Mailgun / SMTP API abuse patterns
- API key compromise indicators
- Sudden outbound email volume spikes (10x+ baseline)
- Reputation degradation signals (blacklists, RBLs, etc.)

---

## Architecture

```
app/
├── Services/
│   ├── DnsAnalyzer.php           # SPF, DMARC, MX passive DNS checks
│   ├── SmtpMisconfigDetector.php # SMTP banner + metadata risk scoring
│   ├── SesAbuseDetector.php      # SES/API heuristic abuse detection
│   ├── RiskEngine.php            # Aggregate 0–100 risk scoring
│   └── EmailAbuseAnalyzer.php    # Orchestrator service
├── Models/
│   ├── EmailRiskAsset.php
│   └── AnalysisRun.php
└── Http/Controllers/
    ├── DashboardController.php
    └── AnalysisController.php
```

---

## Risk Scoring

| Signal | Score |
|---|---|
| Open relay detected | +30 |
| PHP mail() / insecure SMTP | +25 |
| Missing auth indicators | +20 |
| Abnormal sending patterns | +30 |
| Suspicious API/provider behavior | +25 |
| Reputation degradation signals | +20 |
| Missing SPF | +25 |
| Missing DMARC | +25 |

**Final Score Levels:**
- `0–24` → Low
- `25–49` → Medium
- `50–74` → High
- `75–100` → Critical

---

## Setup

### Requirements
- PHP 8.3+
- Composer
- SQLite (default) or MySQL

### Installation

```bash
cd email-abuse-detection
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed --class=DemoDataSeeder  # optional demo data
php artisan serve
```

Visit `http://localhost:8000`

---

## Usage

### Single Domain Analysis
Navigate to **Analyze** → fill in the domain and any known infrastructure metadata (email provider, volume, risk flags) → Run Analysis.

### CSV Batch Upload
Upload a CSV with the following columns:

```
domain,ip,email_provider,daily_send_volume,baseline_volume,
uses_php_mail,uses_laravel_queue,open_relay_banner,
has_api_key_exposed,reputation_signals
```

Boolean columns accept: `yes/no`, `1/0`, `true/false`.  
Reputation signals separated by `|` (pipe character).

### Dashboard
- Filter by risk level, SMTP score, SES score, or analysis run
- Export all results to CSV
- Critical abuse candidates highlighted at the top

---

## Modules

### 1. DNS Email Security Analyzer
Performs live DNS lookups to check:
- **SPF**: Evaluates enforcement level (`-all` = pass, `~all` = weak, no `all` = fail)
- **DMARC**: Checks `_dmarc.<domain>` for policy (`reject`/`quarantine` = pass, `none` = weak)
- **MX**: Validates mail exchanger presence and detects cloud ESP providers from hostnames

### 2. SMTP Misconfiguration Detector
Passive analysis using:
- MX hostname pattern matching against known insecure MTAs (Sendmail, Exim, Postfix, qmail, IIS SMTP)
- Open relay indicator patterns
- User-supplied flags: `uses_php_mail`, `open_relay_banner`, `uses_laravel_queue`, `exposed_smtp`

### 3. SES / Email API Abuse Detector
Heuristic scoring based on:
- API key exposure flag
- Volume spike ratio (current vs. baseline)
- Cloud ESP detection and associated risk
- Reputation signal keyword matching (blacklist, RBL, Spamhaus, suspended, etc.)

### 4. Risk Engine
Weighted aggregate scoring:
- SMTP contribution: 40%
- SES/API contribution: 40%
- DNS contribution: 20%
- Convergence boost: 1.2× multiplier when both SMTP and SES exceed 40

---

## Testing

```bash
php artisan test
# or
php vendor/bin/phpunit --testdox
```

31 tests, 72 assertions covering all core detection modules.

---

## Security Notes

- **No active scanning** — all DNS checks are passive read-only lookups
- **No exploitation** — the system only reads and scores; never connects to SMTP
- **No credential storage** — API keys are never stored; only boolean exposure flags
- **Passive only** — all risk signals are derived from DNS metadata and user-supplied inputs

---

## License

MIT
