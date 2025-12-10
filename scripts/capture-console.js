const playwright = require('playwright');
const fs = require('fs');

(async () => {
  const out = []
  const browser = await playwright.chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('console', (msg) => {
    try {
      const args = msg.args().map(a => a._remoteObject && a._remoteObject.preview ? a._remoteObject.preview : (a._remoteObject && a._remoteObject.value ? a._remoteObject.value : String(a)))
      out.push({ type: 'console', level: msg.type(), text: msg.text(), args })
      console.log('[console]', msg.type(), msg.text())
    } catch (e) { console.log('console event error', e) }
  })

  page.on('pageerror', (err) => {
    out.push({ type: 'pageerror', error: String(err), stack: err.stack })
    console.log('[pageerror]', err.stack)
  })

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 })
    // wait a bit for SW messages or delayed errors
    await page.waitForTimeout(4000)
  } catch (e) {
    out.push({ type: 'goto-error', error: String(e) })
    console.error('goto error', e)
  }

  await browser.close()
  fs.writeFileSync('capture-console-output.json', JSON.stringify(out, null, 2))
  console.log('captured console output to capture-console-output.json')
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
