# Enlightened Beauty

Salon booking and studio desk for Enlightened Beauty — 1226 Merryman St, Marinette, WI.

Public site covers the menu, team, online booking, shop, and gift cards. Studio covers calendar, clients, register, inventory, hours, payments (Stripe + Affirm), and reports.

## Run locally

Photos and logos are stored with [Git LFS](https://git-lfs.com). Install it once, then clone:

```bash
git lfs install
git clone https://github.com/krlloyd/enlightenedbeauty.git
cd enlightenedbeauty
npm install
npm run dev
```

App: [http://127.0.0.1:8080](http://127.0.0.1:8080)

Staff sign in at `/login` (email, Google, or X). Guests book without an account.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests |

Deposits, Affirm eligibility, hours, and the service menu are edited in Studio after you sign in.
