# XRP Paper Desk (iPhone web app) — PAPER ONLY
$1,000 fake bankroll · fees 20 bps/side netted · edge_claimed=false · no exchange keys, no live orders. Education/simulation only.

## Install on iPhone
1. Open the app URL in **Safari** (not Chrome).
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
3. Launch from the "XRP Paper" icon. Journal, news log and knobs are saved on the phone (localStorage); app shell works offline, prices need internet.

## Tabs
- **Desk**: live XRP/BTC from Coinbase public candles; 4h change; price shock gate (BTC ≤−3%/4h, XRP ≤−4%/4h, S&P futures ≤−1.5% — S&P is **manual entry**, no free CORS feed; blank = `spx_unavailable`, BTC/XRP still checked); daily best guess (STAND ASIDE / LEAN LONG / LEAN SHORT / EXIT / HOLD) with entry, 2×ATR stop, trailing stop, breakeven level; paper open/exit.
- **News**: log a headline; XRP-relevance gate (else log only unless market shock); same story from several outlets counted once (Jaccard ≥0.5 / entity pair within 36h, ported from news_watch.py); a scary headline starts the 60-min no-panic-exit cool-off (exceptions: stop hit, real high-severity XRP event, market shock).
- **Psych**: FOMO checklist; must be clear before entry/exit.
- **Journal**: fee-net W/L, net, fees, NAV; CSV copy.
- **Knobs**: dials + sliders for every VARIANT KNOB; live-updates logic, persisted, Reset to desk defaults.

## Dev
`node --test tests/` (13 tests). Serve locally: `python3 -m http.server`.
Logic: `logic.js` (pure, tested). UI: `app.js`.
