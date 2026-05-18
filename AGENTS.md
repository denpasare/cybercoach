<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Cloud environment bootstrap is defined in `.cursor/environment.json`.
- Startup install command runs `npm install && npm run prisma:generate`.
- Set `DATABASE_URL` in Cursor secrets/environment settings so Prisma migrations and runtime DB access work.
