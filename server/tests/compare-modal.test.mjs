import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

test('비교 모달은 새 지표·차이·무자료 상태를 표시하고 모바일 A/B 탭으로 전환한다', async (t) => {
  const vite = await createServer({
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': '""',
      'import.meta.env.VITE_WMS_ENABLED': 'false',
    },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'compare-preview',
        configureServer(server) {
          server.middlewares.use(
            '/__compare_preview',
            async (req, res, next) => {
              try {
                const html = await server.transformIndexHtml(
                  '/__compare_preview',
                  `<html><body><div id="root"></div><script type="module">
            import React from '/node_modules/.vite/deps/react.js'
            import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js'
            import Modal from '/src/pages/CompareResultModal.jsx'
            import { summarizeCounts, compareMetrics } from '/src/services/colorMetrics.js'
            import '/src/styles/tokens.css'
            const root = ReactDOM.createRoot(document.getElementById('root'))
            window.renderMetrics = (empty = false) => {
              const A = summarizeCounts(empty ? Array(10).fill(0) : [259,698,326,403,457,325,86,28,0,0], empty ? 0 : 1565, 6717)
              const B = summarizeCounts([100,0,0,0,0,0,0,0,0,0], 0, 0)
              const point = { lat: 37.5, lng: 127, address: '테스트 주소' }
              const result = { A, B, comparison: compareMetrics(A,B), conditions: { A: point, B: point, radius: 1000 }, queriedAt: new Date().toISOString(), version: 'browser-fixture' }
              root.render(React.createElement(Modal, { result, crimeType: 'Tot', onClose: () => root.unmount() }))
            }
            window.renderMetrics()
          </script></body></html>`,
                )
                res.setHeader('content-type', 'text/html')
                res.end(html)
              } catch (error) {
                next(error)
              }
            },
          )
        },
      },
    ],
  })
  await vite.listen()
  t.after(() => vite.close())
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
  })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(
    `http://127.0.0.1:${vite.httpServer.address().port}/__compare_preview`,
  )
  await page.getByRole('dialog').waitFor()
  const A = page.getByRole('region', { name: 'A 지역 예시 결과' })
  assert.match(await A.innerText(), /28\.9/)
  assert.match(await A.innerText(), /1\.1%/)
  assert.match(await A.innerText(), /23\.8%/)
  assert.match(await A.innerText(), /37\.7%/)
  await page.getByRole('tab', { name: 'B 지역' }).click()
  assert.equal(
    await page
      .getByRole('tab', { name: 'B 지역' })
      .getAttribute('aria-selected'),
    'true',
  )
  assert.equal(
    await page.getByRole('region', { name: 'B 지역 예시 결과' }).isVisible(),
    true,
  )
  await page.getByRole('tab', { name: 'A 지역' }).click()
  await page.evaluate(() => window.renderMetrics(true))
  await page.getByText('판별된 자료가 없어 지수를 제공하지 않습니다.').waitFor()
  assert.match(await A.innerText(), /분석 불가/)
  assert.doesNotMatch(
    await page.getByRole('dialog').innerText(),
    /NaN|Infinity/,
  )
  assert.deepEqual(errors, [])
  await page.getByRole('button', { name: '지점·반경 다시 선택 / 닫기' }).click()
  assert.equal(await page.getByRole('dialog').count(), 0)
})
