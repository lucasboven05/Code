# Practice Invest (private clone)

A private app for practising automated investing with **simulated money and fictional investments**. Clean-room rebuild of an automated-investing app's feature set from public information; no code, copy, images or branding from the original.

```bash
npm install
npm run dev        # http://localhost:3100  (data stays in this browser)
npm test           # engine unit tests
npm run build && npm start   # production build
node e2e/slice.cjs && node e2e/screens.cjs   # browser tests (needs the app running on :3100 and Playwright)
npm run tokens     # regenerate CSS/Tailwind tokens from ../replica/design/tokens.json
```

Not real: brokerage, prices, news, Allie's answers (scripted). See `../replica/build-log.md` for what is done and what is partial.
