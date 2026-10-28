import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

test('비교 모달은 가상 점수 없이 두 지역 지도를 표시하고 모바일 탭으로 전환한다', async (t) => {
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
            import '/src/styles/tokens.css'
            import '/src/styles/global.css'
            const root = ReactDOM.createRoot(document.getElementById('root'))
            window.renderMaps = () => {
              const point = { lat: 37.5, lng: 127, address: '테스트 주소' }
              const result = { conditions: { A: point, B: point, radius: 1000 } }
              root.render(React.createElement(Modal, { result, crimeType: 'Tot', onClose: () => root.unmount() }))
            }
            window.renderMaps()
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
  const A = page.getByRole('region', { name: 'A 지역 지도' })
  assert.match(await A.innerText(), /반경 1km/)
  assert.doesNotMatch(
    await page.getByRole('dialog').innerText(),
    /예시|가상|점수|픽셀|fixture|NaN|Infinity/,
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  assert.equal(
    await page.getByRole('region', { name: 'B 지역 지도' }).isVisible(),
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
    await page.getByRole('region', { name: 'B 지역 지도' }).isVisible(),
    true,
  )
  await page.getByRole('tab', { name: 'A 지역' }).click()
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  )
  assert.deepEqual(errors, [])
  await page.getByRole('button', { name: '지점·반경 다시 선택 / 닫기' }).click()
  assert.equal(await page.getByRole('dialog').count(), 0)
})
