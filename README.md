# EventOps Frontend

Static frontend (HTML / CSS / JS) for EventOps.

## Point it to the backend
Edit `assets/js/api.js`:

```js
const DEPLOY_API_BASE = "https://your-backend-url";
```

Leave it empty (`""`) for local development (`http://localhost:3000`).

## Deploy
Vercel / Netlify / Cloudflare Pages:
- Framework preset: **Other** (no build step)
- Publish / Output directory: `.` (this repo root)
