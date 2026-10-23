# baia

Personal desktop-style site, with Vercel API functions backed by Upstash Redis.

## Local development

Use Node.js 18 or later. Run `npm ci`, then `npm start`, and open
http://127.0.0.1:8080. Set `PORT` to change the port.

The local server serves the site and `/api/messages` and `/api/presence`.
Create an ignored `.env.local` containing:

```
KV_REST_API_URL=https://YOUR-DATABASE.upstash.io
KV_REST_API_TOKEN=YOUR-TOKEN
```

Use a separate development database: posting and deletion modify the configured
database. Without credentials, API routes return 503 and the desktop still works.
Never commit credentials. `npm run start:static` serves only static files.

`/gamelib` is routed to the separate GameShelf deployment by Vercel's
`microfrontends.json`; the local server does not proxy that application.
Pong is intentionally disabled until its Godot build is re-exported without threads.

## Checks

- `npm run check`: JavaScript syntax.
- `npm test`: API validation, authorization/rate limits, frontend failure recovery,
  accessibility state, and background polling. Tests mock Redis and HTTP and do
  not use credentials or contact production.
- Browser smoke check: desktop and narrow mobile layouts, opening/closing menus
  and windows with keyboard, modal Tab/Escape behavior, Wall posting/deletion,
  reduced motion, and returning from a hidden tab.

Vercel runs `api/*.js` in production; configure the same two environment variables
there. Presence and deletion use separate per-IP limits (60 and 10 per minute);
posting allows one message per 20 seconds. Forwarded IP headers must come from a
trusted hosting proxy. The local server discards client-supplied forwarding headers.

## Desktop games

Open **MENU → minesweeper.exe** or **solitaire.exe**. Games keep their state while
switching windows, until the page reloads.

- Minesweeper: 9×9, ten mines, safe opening area, flood reveal, flags, and win/loss
  detection. Use right-click, F, or the touch-friendly flag-mode button to flag.
- Solitaire: draw-one Klondike with unlimited stock recycling. Select a card or
  face-up run, then its destination. Foundations build by suit; columns alternate
  colors downward. Includes undo (last 200 moves), restart, and send-to-foundation.
  Deals are shuffled randomly and are not guaranteed solvable.

Game rules live in `games/engine.js`; `games/ui.js` renders the accessible button
controls. `npm test` covers rules, wins, illegal moves, undo, and menu integration.
