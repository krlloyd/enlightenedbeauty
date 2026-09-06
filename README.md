# Enlightened Beauty

Salon booking and studio desk for Enlightened Beauty — 1226 Merryman St, Marinette, WI.

Public site covers the menu, team, online booking, shop, and gift cards. Guests book without an account.

Studio is the staff desk: calendar, clients, register, inventory, hours, payments (Stripe + Affirm), and reports. Who can open which pages depends on their role.

The live site is served over HTTPS. HTTP visitors are redirected, and browsers are told to keep using HTTPS after that.

## Studio access

Staff sign in at `/login`. The first sign-in claims the desk as **Owner**. After that, new people stay off the desk until the owner adds them under **Access** (email and password). Google and X are only offered for that first owner claim.

A specialist login should be linked to a chair on Access so their calendar column and today's book show only their visits.

| Role | What they can do |
| --- | --- |
| **Owner** | Full studio. Today, calendar, clients, menu, register, payments, stock, hours, reports, and Access (who can sign in). Can reset the demo seed. |
| **Manager** | Floor and book: today, calendar, clients, menu, register, stock, hours, and reports. Cannot open payments or Access. |
| **Front desk** | The book and the till: today, calendar, clients, and the register. Cannot edit the menu, stock, hours, payments, or reports. |
| **Specialist** | Their own chair: today and calendar, filtered to the linked specialist. Cannot open the client file, register, or back-office pages. |

Deposits, Affirm eligibility, hours, and the service menu are edited in Studio (owner or manager). Payments settings are owner-only.

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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests |
