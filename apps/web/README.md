# LOVE Andaman web shell

An isolated Next.js App Router and TypeScript shell for incremental modernization. It does not import, serve, or modify the legacy `allotment_v2` application or any persistence path.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The shell is available at `http://localhost:3000`; its static health page is at `/health`.

## Validation / CI commands

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

`NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_ENV` are optional public display labels. Do not put secrets in `NEXT_PUBLIC_*` variables.
