# TCS System — Seed Reference (NO LIVE PASSWORDS)

> **Security:** Real passwords must never be committed. Demo credentials are generated
> only when you run the seeder locally with `ALLOW_SEED=1`. Rotate any previously
> published demo passwords immediately if this repo was shared.

## Quick Start

```bash
cd hrms-backend
ALLOW_SEED=1 npm run seed:tcs
```

The seeder prints one-time credentials to the console. Store them in a password manager — not in git.

## Expected accounts (emails only)

| Role | Email (typical) | Login path |
|------|-----------------|------------|
| Super Admin | `superadmin@hrms.com` | `/login/super-admin` |
| Company Admin | `admin@tcs.com` | `/login/company` |
| HR | `hr@tcs.com` | `/login/company` |
| Manager | `manager@tcs.com` | `/login/company` |
| Employee | `employee@tcs.com` | `/login/company` |

Passwords: **only from seeder output / your secrets store**.

## Notes

- Requires non-production `NODE_ENV` and `ALLOW_SEED=1`
- Prefer `FRONTEND_URL` and `BACKEND_URL` env vars for links
- After any credential leak, run password reset for all seeded users
