# Paisa Practice — expanded demonstration implementation

All people, institutions, cash, rates, policies and securities are fictional. Browser-local, single-device family learning mock, not a financial service.

## Implemented interactive flows
- Responsive family portal, role selector, dashboard, bank deposits and withdrawals, RD transfers, simulation clock, transaction ledger, statements, tax-tag summaries, quiz cards, scam scenario, and settings/reset.
- Bond A/B demo coupon and principal timeline, RD standing-instruction failures and fees, maturity alert, plus a worked illustrative XIRR example.
- Simplified Post Office PPF/TD/MIS/SSY products: opening and principal-backed projections. Separate SSY opening-age, age-18 and maturity-date eligibility exploration.
- Insurance mock health/term/vehicle purchases, premium posting, simple claims, e-insurance overview.
- Demat/mock mutual fund purchases and redemptions, fictional static quote list, recurring monthly SIP instructions that run during Time Travel (simplified whole-unit purchases).
- Additional UPI transaction, ATM withdrawal, write/present a cheque; all debit the fictional bank account when executed. Mock PIN is 1234. No real identifiers or PINs.
- Transaction search, JSON backup and restore.
- Unit tests in engine.test.ts, extended.test.ts and labs.test.ts.

## Significant deliberate simplifications / not implemented
- No Supabase, multi-device auth or persistent secure identity. LocalStorage is for fictional progress only.
- No full 2015–2026 SSY historical rate backfill; no computed withdrawal entitlement or historical interest. Tax rules and many rates unverified.
- PPF/TD/MIS/SSY projections do not generate timeline accrual/payout transactions; scheme-specific account validation and regulatory restrictions incomplete.
- Payment rail and card simulations simplified. UPI wrong-PIN blocking is not persistent because rejected operations do not save failure count; this is NOT a security system.
- SIP buys only whole units at fixed prices; no FIFO, four-decimal fund NAV units, taxes, exit loads, STP, SWP, dividend mode or market-price PRNG.
- No realistic medical claim rules, waiting periods, renewal/lapse simulation, room rent or insurance adjudication.
- Bonds do not have full XIRR per holding, bond-sale process, reinvestment simulation, or detailed cumulative cashflow history.
- No executable tax-return computation, actual OTP/TOTP/authentication, detailed learning mission verification, or formal tax advice.
- No atomic Postgres transactions; browser storage only.

## Verification status
Source created and new regression fixtures authored, but npm dependency installation timed out in the authoring environment. Neither `npm run build` nor `npm test` has a verified PASS result. Run those commands in Bolt before deployment and correct failures. Treat every number as educational and simulated.
