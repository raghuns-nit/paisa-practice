# Bolt continuation instructions — Paisa Practice

Import this repository exactly as provided. It is a MOCK financial literacy platform with fictional Indian demo accounts and simulated balances. Do not connect real financial services or request real account data.

1. First run `npm install`, `npm run build`, and `npm test`. Report all errors and repair compilation/runtime/test failures while keeping the layout and current working flows intact.
2. Explore all navigation paths with browser checks on desktop and mobile. Verify bank deposits, withdrawals, RD transfers, UPI, ATM, cheque creation/presentation, SIP creation/pause and 1-month Time Travel, insurance claim, opening schemes, buy/sell investments, search, backup and quizzes. Correct problems, including profile ownership and money handling.
3. Fix the demo UPI wrong PIN lockout persistence (or remove any promise of persistent lockout). No production authentication is required.
4. Improve mock fidelity in stages: (a) seed-driven SSY quarterly rate-gap history and refusal, PPF/TD/MIS timeline transactions; (b) fractional MF units, FIFO, exit loads and deterministic market prices; (c) insurance claim decision trees and renewal/lapse; (d) more complete bank payment flows; (e) bond cashflows, maturity cascade reconciliation, statements; (f) rule-tagged tax instruction and missions.
5. Use only fictional data and show 'Sandbox. No real money.' everywhere. Financial rule claims unverified = Verify badges. Avoid unverified tax liability results. Money remains safe integer paise.
6. Persist in browser by default. Introduce Supabase only when requested, preserving user-owned data separation then.
7. Before each stage list exact files to edit, implement, test, show results, and only then move on. No unrelated refactoring.
8. Deploy via Bolt hosting after build/test/browser QA succeeds. Do not claim external hosting has occurred before it actually has.

See docs/IMPLEMENTATION_STATUS.md for known gaps. Do not silently convert them into completed checkboxes.
