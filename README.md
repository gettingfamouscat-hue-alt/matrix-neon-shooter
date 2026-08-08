# MATRIX NEON — 3D Shooter

A browser-based Matrix-style FPS built with Three.js + Vite.

## Play

- **WASD** — move
- **Mouse** — aim
- **Click** — shoot
- **R** — reload
- **Shift** — dash
- **Esc** — pause

Survive waves of agents, runners, tanks, and drones. Every **5th wave** summons a boss.

## Admin panel (owner only)

1. Pause (`Esc`) → **ADMIN ACCESS**, or press **Ctrl+Shift+A**
2. Enter the admin key from `VITE_ADMIN_PASSWORD`

On Vercel, set the env var `VITE_ADMIN_PASSWORD` in Project Settings → Environment Variables, then redeploy.

## Local

```bash
npm install
npm run dev
```

Create a `.env` file:

```
VITE_ADMIN_PASSWORD=your-secret-admin-key
```

## Deploy

```bash
npm run build
npx vercel --prod
```
