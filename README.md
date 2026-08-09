# MATRIX NEON — 3D Shooter

Matrix-style FPS built with Three.js + Vite. Play in the browser or as a desktop Electron app.

## Controls

- **WASD** — move
- **Space** — jump
- **LMB** — shoot
- **RMB** — aim (ADS)
- **1–4 / scroll** — switch guns
- **R** — reload
- **Shift** — dash
- **M** — settings (sensitivity / FOV)
- **Esc** — pause

## Web

```bash
npm install
npm run dev
```

Production: https://matrix-neon-shooter.vercel.app

## Electron (desktop)

```bash
npm install
npm run electron:dev      # hot reload via Vite
npm run electron:dist     # build Windows portable + installer into release/
```

After `electron:dist`, grab the `.exe` from the `release/` folder.

## Admin (owner only)

1. Pause → **ADMIN ACCESS**, or **Ctrl+Shift+A**
2. Key from `VITE_ADMIN_PASSWORD` (set in `.env` / Vercel env)

## Deploy web

```bash
npm run build
npx vercel --prod
```
