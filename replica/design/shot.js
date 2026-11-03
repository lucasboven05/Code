const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light','dark']) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
    await p.goto('file://' + __dirname + '/preview.html'); await p.waitForTimeout(800);
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(scheme, 'horizontal overflow px:', ov, 'errors:', errs.length);
    await p.screenshot({ path: `/tmp/claude-0/-home-user-Code/b728ad40-0434-5164-b602-3636d108ad2c/scratchpad/design-${scheme}.png`, fullPage: true });
  }
  await b.close();
})();
