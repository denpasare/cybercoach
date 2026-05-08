## Cursor Cloud specific instructions

### Project Structure

Single Laravel 13 application in `/workspace/email-abuse-detection/`. All commands below should be run from that directory.

### Services

| Service | Command | Port |
|---------|---------|------|
| Laravel Dev Server | `php artisan serve --host=0.0.0.0 --port=8000` | 8000 |
| Vite Dev Server (optional) | `npm run dev` | 5173 |
| Queue Worker (optional) | `php artisan queue:listen` | N/A |

The app uses SQLite (`database/database.sqlite`) for DB, cache, sessions, and queue — no external services needed.

### Key Commands

- **Lint:** `php vendor/bin/pint --test` (check) or `php vendor/bin/pint` (fix)
- **Tests:** `php artisan test` (31 tests, 72 assertions; uses in-memory SQLite)
- **Build frontend:** `npm run build`
- **Full dev mode (all services):** `composer dev` (runs server + queue + pail + vite concurrently)

### Non-obvious Notes

- PHP 8.3+ must be installed via `ppa:ondrej/php` on Ubuntu 24.04 (not available in default repos).
- The `.env` file and `database/database.sqlite` must exist before running `artisan` commands. The update script handles this automatically.
- `php artisan test` clears config cache before running; no manual cache clear needed.
- DNS analysis (`DnsAnalyzer`) performs live DNS lookups using PHP's `dns_get_record()` — requires network access but no external API keys.
- The linter (`pint --test`) exits with code 1 when style violations exist; this is expected for the current codebase.
