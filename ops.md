# Ops

Family cookbook: **The Family Recipe Book**.
Private family book. Unlisted — `robots.txt` disallows everything. The baker writes. Family uses the URL. Not a blog. Sally is a source on some cards, not the name of the book. The line under the name is “Family favorites, all in one place.” Colors, header doodles, and monthly room artwork follow the Minnesota month (America/Chicago) on load. Family comes in with Google.

## Services

| What | Where | Status |
| --- | --- | --- |
| Source | GitHub `bytesofconnor/baking-addiction` | https://github.com/bytesofconnor/baking-addiction |
| App (SPA) | Vercel project `baking-addiction` | Vercel team `team_ynn7qy4sDXJcDEMHSuWLuXXo` / `connors-projects-408eaae2`. Project `prj_aFYDZXk50XMLtWsmraJ6lbd8eTAg` |
| Backend + DB | Convex project `baking-addiction` | Production deployment `beloved-lapwing-642` |
| Domain | `thefamilyrecipebook.app` | Live on Vercel. Old alias `baking-addiction.vercel.app` still works. |
| Kitchen AI | Vercel AI Gateway via Convex actions `kitchen.remix` and `extractCard` | `AI_GATEWAY_API_KEY` is **not** set. Ask the kitchen falls back to notes in `convex/lib/kitchenLetter.ts`. Add a recipe still saves; the scan is skipped until the key is set. |

Git remote: `github.com-personal:bytesofconnor/baking-addiction.git`

## Production

| Piece | Address |
| --- | --- |
| Site | https://thefamilyrecipebook.app |
| Vercel alias | https://baking-addiction.vercel.app |
| Vercel dashboard | https://vercel.com/connors-projects-408eaae2/baking-addiction |
| Vercel domains | https://vercel.com/connors-projects-408eaae2/baking-addiction/settings/domains |
| Convex HTTP | https://beloved-lapwing-642.convex.cloud |
| Convex dashboard | https://dashboard.convex.dev (production deployment `beloved-lapwing-642`) |
| Google OAuth credentials | https://console.cloud.google.com/apis/credentials |

Production cookbook starts **empty**. The baker writes the real bakes. Dummy seed is `internalMutation` only — never run it on prod.

### CI/CD Deployment

GitHub Actions automatically deploys to production when you push to `main`. The workflow:

1. Builds the project locally
2. Pulls Vercel environment information
3. Builds Vercel production artifacts
4. Deploys to Vercel production
5. Deploys Convex functions to production

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret | Value | How to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | Your Vercel API token | Vercel dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | `team_ynn7qy4sDXJcDEMHSuWLuXXo` | From Vercel project settings |
| `VERCEL_PROJECT_ID` | `prj_aFYDZXk50XMLtWsmraJ6lbd8eTAg` | From Vercel project settings |
| `CONVEX_DEPLOY_KEY` | Your Convex deploy key | Convex dashboard → Settings → API Keys |

### Manual Deployment

If you need to deploy manually without CI (for testing or emergencies):

```bash
npx vercel pull --yes --environment=production --scope connors-projects-408eaae2
npx vercel build --prod --yes --scope connors-projects-408eaae2
npx vercel deploy --prebuilt --prod --yes --scope connors-projects-408eaae2
```

## Local

Run both. Convex first, then the app. Local still uses the anonymous deployment in `.env.local` so dummy bakes stay on your machine.

```bash
npm run convex:dev   # http://127.0.0.1:3210
npm run dev          # http://localhost:4821
```

| Piece | Address |
| --- | --- |
| Site | http://localhost:4821 |
| Convex HTTP | http://127.0.0.1:3210 |
| Convex site | http://127.0.0.1:3211 |
| Convex deployment name | `anonymous:anonymous-baking-addiction` (in `.env.local`) |

`.env.local` (Vite / Convex CLI — not secrets for the kitchen door):

- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

Do not let `vercel env pull` overwrite this file’s local Convex URL.

Push functions to production without touching local:

```bash
printf 'CONVEX_DEPLOYMENT=prod:beloved-lapwing-642\n' > /tmp/convex-prod.env
npx convex deploy --env-file /tmp/convex-prod.env
rm /tmp/convex-prod.env
```

## Routes

| Path | Who |
| --- | --- |
| `/` | Public cookbook |
| `/bakes/:slug` | Public bake |
| `/slip/:token` | One recipe, if you have the unguessable link. No book, no profile, no sign-in. |
| `/about` | How she cooks. No recipes. |
| `/join` | Family door. `?code=` is an invite. |
| `/family` | People in the current kitchen. Invite lives here. |
| `/family/:userId` | What that person shared. |
| `/add` | Write desk. Family cooks, or the kitchen code. |
| `/add?code=…` | Magic link. Unlocks this device, then strips `code` from the URL. |
| `/admin` | Redirect to `/add` |
| `/write` | Redirect to `/add` |

Family signs in with Google. Session cookie `mba_desk` + `localStorage` `mba-desk-session` is only the write-desk kitchen code, ~400 days.

Family gets `/join?code=` from the Family page. After Google, the invite opens that kitchen. The baker can still write at `/admin` with the kitchen code, or by signing in as a cook.

## Convex env

Set on the **Convex** deployment, not Vercel.

| Name | Required | Lives on |
| --- | --- | --- |
| `WRITER_PASSWORD` | Yes | Convex. Kitchen door code. Never commit it. Never put the value in this file. Set on local anonymous **and** production `beloved-lapwing-642`. |
| `SITE_URL` | Yes | Frontend origin. Local: `http://localhost:4821`. Prod: `https://thefamilyrecipebook.app`. |
| `JWT_PRIVATE_KEY` | Yes | Convex Auth. Generated once per deployment. |
| `JWKS` | Yes | Convex Auth public key. Generated with the private key. |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret. |
| `AI_GATEWAY_API_KEY` | No | Convex. Same key for Ask the kitchen and for reading a recipe off a photo, PDF, or link. If it is missing, both still work: Ask the kitchen answers from the baker's notes, and Add a recipe leaves the fields blank so a name and a photo are enough to save. No second secret. |

```bash
npx convex env set WRITER_PASSWORD --deployment <convex-team>:baking-addiction:production
npx convex env set AI_GATEWAY_API_KEY --deployment <convex-team>:baking-addiction:production
```

That one key turns on both Ask the kitchen and reading a recipe off photos, a PDF, a PowerPoint, or a link. There is no second secret. Set it on production `beloved-lapwing-642` (and on a local Convex deployment if you want the scan there). Without it, Add a recipe leaves the fields blank and a name plus a photo is enough to save.

Scanning stays cheap on purpose: one model call per pile or per link, photos are shrunk in the browser to a 1280px JPEG before upload, and any image over about 1.5MB is left out of that call (at most six photos go to the model). Sally links stay a title credit only. The book does not fetch or copy her page.

Google OAuth (Google Cloud → APIs & Services → Credentials → Web application):

- Authorized JavaScript origins:
  - `http://localhost:4821`
  - `https://thefamilyrecipebook.app`
  - `https://baking-addiction.vercel.app` (optional; keep while the alias is still used)
- Authorized redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`
  - Local: `http://127.0.0.1:3211/api/auth/callback/google`
  - Prod: `https://beloved-lapwing-642.convex.site/api/auth/callback/google`

```bash
npx convex env set SITE_URL https://thefamilyrecipebook.app
npx convex env set AUTH_GOOGLE_ID ...
npx convex env set AUTH_GOOGLE_SECRET ...
```

The Google account picker says "Choose an account to continue to beloved-lapwing-642.convex.site" because the callback host is `CONVEX_SITE_URL`. `SITE_URL` only sends the person back to the book after Google, so it does not change that sentence. Google prints the callback host there, not the book title.

Showing the family domain on that line needs a custom HTTP domain on the production Convex deployment. Custom domains require Convex Pro. `thefamilyrecipebook.app` already serves the Vercel site, so use a different hostname, such as `auth.thefamilyrecipebook.app`.

1. In the Convex dashboard, open production deployment `beloved-lapwing-642`, then Settings, then Custom domains. Add the hostname. Create the DNS records Convex shows, and wait until the domain has a green check.
2. On that same settings page, under Environment Variables, set `CUSTOM_AUTH_SITE_URL` to `https://auth.thefamilyrecipebook.app` with no trailing slash.
3. In Google Cloud, open APIs & Services, then Credentials, then the production web client. Add the authorized redirect URI `https://auth.thefamilyrecipebook.app/api/auth/callback/google`. Add `thefamilyrecipebook.app` under the OAuth consent screen's authorized domains if Google asks for it. Keep the existing `beloved-lapwing-642.convex.site` redirect until a sign-in through the new host works, then remove the old redirect.
4. Open `https://thefamilyrecipebook.app/join` and choose Continue with Google. The account picker should say "continue to auth.thefamilyrecipebook.app".

Convex Auth documents this under Custom callback and sign-in URLs. There is no in-repo switch that changes the host Google displays.

## Vercel env

| Name | Required | Notes |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Yes | `https://beloved-lapwing-642.convex.cloud` — baked in at build time |

## Recipe rule

Private kitchens. Anyone can make an account. Recipes stay inside a kitchen you were invited to. No family directory. Sources: Sally (credit + link), original, or family. Dummy seed is local only — first kitchen on that deployment claims leftover cards.

## Useful commands

```bash
npm run dev
npm run convex:dev
npm run typecheck
npm run lint
npx convex env list
npx convex run seed:ensureSamples   # local dummy data only; internal; never on prod
```
