import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

test('비교 모달은 새 지표·차이·무자료 상태를 표시하고 모바일 A/B 탭으로 전환한다', async (t) => {
  const vite = await createServer({
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': '""',
      'import.meta.env.VITE_WMS_ENABLED': JSON.stringify('false'),
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
            import { CRIME_TYPES } from '/src/constants/crimeTypes.js'
            import '/src/styles/tokens.css'
            import '/src/styles/global.css'
            const root = ReactDOM.createRoot(document.getElementById('root'))
            window.renderMetrics = (empty = false) => {
              const A = summarizeCounts(empty ? Array(10).fill(0) : [259,698,326,403,457,325,86,28,0,0], empty ? 0 : 1565, 6717)
              const B = summarizeCounts([100,0,0,0,0,0,0,0,0,0], 0, 0)
              A.byCrimeType = Object.fromEntries(CRIME_TYPES.map(({id}, index) => [id, { ...A, score: empty ? null : 10 + index * 10 }]))
              B.byCrimeType = Object.fromEntries(CRIME_TYPES.map(({id}, index) => [id, { ...B, score: 20 + index * 10 }]))
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
  const types = A.getByRole('region', { name: 'A 범죄 유형별 점수' })
  for (const [label, score] of [
    ['강도', '20.0'],
    ['성폭력', '30.0'],
    ['폭력', '40.0'],
    ['절도', '50.0'],
    ['살인', '60.0'],
  ]) {
    const row = types
      .locator('dl > div')
      .filter({ has: page.getByText(label, { exact: true }) })
    assert.match(await row.innerText(), new RegExp(score.replace('.', '\\.')))
    assert.doesNotMatch(await row.innerText(), /%/)
  }
  const details = page
    .locator('details')
    .filter({ has: page.getByText('산식·분석 기준 확인', { exact: true }) })
  assert.equal(await details.getAttribute('open'), null)
  assert.equal(
    await page
      .getByRole('heading', { name: 'A/B 차이 · 예시', exact: true })
      .isVisible(),
    false,
  )
  assert.doesNotMatch(
    await A.innerText(),
    /판별 성공 비율|후보 중 미분류 비율|1등급/,
  )
  await details.locator('summary').click()
  const diagnostics = details.getByRole('region', {
    name: 'A 전체 유형 분석 상세',
  })
  assert.match(await diagnostics.innerText(), /1\.1%/)
  assert.match(await diagnostics.innerText(), /23\.8%/)
  assert.match(await diagnostics.innerText(), /37\.7%/)
  assert.equal(
    await details
      .getByRole('heading', { name: 'A/B 차이 · 예시', exact: true })
      .isVisible(),
    true,
  )
  await details.locator('summary').click()
  await page.setViewportSize({ width: 1440, height: 900 })
  assert.equal(
    await page.getByRole('region', { name: 'B 범죄 유형별 점수' }).isVisible(),
    true,
  )
  await page.setViewportSize({ width: 390, height: 844 })
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
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  )
  await page.screenshot({
    path: '/tmp/ansim-crime-type-scores-mobile.png',
    fullPage: true,
  })
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
