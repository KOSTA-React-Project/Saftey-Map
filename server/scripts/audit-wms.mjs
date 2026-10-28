import {
  COLOR_INFERENCE,
  REVIEWED_COLORS,
  REVIEWED_COLORS_VERSION,
} from '../src/crime/reviewedColors.js'
import process from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { PNG } from 'pngjs'
import { createCrimeSource } from '../src/crime/source.js'
import { CRIME_TYPES } from '../src/shared/crimeTypes.js'
import {
  CLASSIFICATION,
  countPixels,
  createPixelClassifier,
  geometryFor,
  radiusMask,
  distanceMeters,
} from '../src/crime/analyze.js'

const [mode, directory] = process.argv.slice(2)
if (!['--live', '--cached'].includes(mode) || !directory) {
  console.error(
    '사용법: node --env-file=server/.env server/scripts/audit-wms.mjs --live /tmp/ansim-wms-audit 또는 --cached 동일폴더',
  )
  process.exit(1)
}
const output = resolve(directory)
const samples = [
  {
    id: 'A500',
    name: '서울시청 인근 · 500m',
    point: { lat: 37.5665, lng: 126.978 },
    radius: 500,
  },
  {
    id: 'B500',
    name: '경복궁 인근 · 500m',
    point: { lat: 37.5759, lng: 126.9768 },
    radius: 500,
  },
  {
    id: 'A1000',
    name: '서울시청 인근 · 1km',
    point: { lat: 37.5665, lng: 126.978 },
    radius: 1000,
  },
  {
    id: 'B1000',
    name: '경복궁 인근 · 1km',
    point: { lat: 37.5759, lng: 126.9768 },
    radius: 1000,
  },
]
const profiles = [
  { name: '엄격 비교', alphaMin: 128, maxDistance: 4, minGap: 8 },
  { name: '현재 기준', ...CLASSIFICATION },
  { name: '완화 비교', alphaMin: 64, maxDistance: 12, minGap: 4 },
  { name: '5% 목표 후보 · 미적용', alphaMin: 16, maxDistance: 20, minGap: 2 },
]
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  )
const fixed = (value) =>
  Number.isFinite(value) ? value.toFixed(2) : '자료 없음'
const digest = (body) => createHash('sha256').update(body).digest('hex')

try {
  await mkdir(output, { recursive: true })
  let manifest
  if (mode === '--live') {
    // 실수로 기존 검증 원본을 덮어쓰지 않음. 재집계는 --cached로 수행.
    try {
      await readFile(resolve(output, 'manifest.json'))
      throw new Error('existing audit')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const source = createCrimeSource()
    if (!source.configured) throw new Error('key missing')
    const signal = AbortSignal.timeout(120000)
    const palette = await source.legend(signal)
    manifest = {
      queriedAt: new Date().toISOString(),
      period: '2025',
      periodBasis: '사용자 확인',
      palette,
      samples,
      files: [],
    }
    for (const sample of samples) {
      for (const type of CRIME_TYPES) {
        const body = await source.image({
          ...geometryFor(sample.point, sample.radius),
          style: type.style,
          signal,
        })
        const file = `${sample.id}-${type.id}.png`
        await writeFile(resolve(output, file), body)
        manifest.files.push({
          sample: sample.id,
          type: type.id,
          file,
          sha256: digest(body),
        })
        console.log(`원본 수신 ${sample.id} ${type.id}`)
      }
    }
    await writeFile(
      resolve(output, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    )
  } else {
    manifest = JSON.parse(
      await readFile(resolve(output, 'manifest.json'), 'utf8'),
    )
  }
  const cases = []
  for (const sample of samples) {
    const geometry = geometryFor(sample.point, sample.radius)
    const mask = radiusMask(sample.point, sample.radius, geometry)
    let farthest = 0
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue
      const point = {
        lat:
          geometry.bbox[3] -
          ((Math.floor(i / geometry.size) + 0.5) *
            (geometry.bbox[3] - geometry.bbox[1])) /
            geometry.size,
        lng:
          geometry.bbox[0] +
          (((i % geometry.size) + 0.5) *
            (geometry.bbox[2] - geometry.bbox[0])) /
            geometry.size,
      }
      farthest = Math.max(farthest, distanceMeters(sample.point, point))
    }
    for (const type of CRIME_TYPES) {
      const file = `${sample.id}-${type.id}.png`
      const body = await readFile(resolve(output, file))
      if (
        digest(body) !==
        manifest.files.find((entry) => entry.file === file)?.sha256
      )
        throw new Error('hash mismatch')
      const metrics = profiles.map((profile) => ({
        profile,
        ...countPixels(body, geometry.size, mask, manifest.palette, profile),
      }))
      const beforeReview = countPixels(
        body,
        geometry.size,
        mask,
        manifest.palette,
        CLASSIFICATION,
        { useReviewedColors: false },
      )
      const beforeInference = countPixels(
        body,
        geometry.size,
        mask,
        manifest.palette,
        CLASSIFICATION,
        { useInferredColors: false },
      )
      const original = PNG.sync.read(body)
      const marked = new PNG({ width: geometry.size, height: geometry.size })
      const targetMarked = new PNG({
        width: geometry.size,
        height: geometry.size,
      })
      const targetClassify = createPixelClassifier(
        manifest.palette,
        profiles[3],
      )
      const classify = createPixelClassifier(manifest.palette)
      const paint = (match) =>
        match.grade
          ? manifest.palette[match.grade - 1].color
              .slice(1)
              .match(/../g)
              .map((hex) => parseInt(hex, 16))
          : match.reason === 'transparent'
            ? [255, 255, 255]
            : match.reason === 'lowAlpha'
              ? [0, 170, 210]
              : match.reason === 'distance'
                ? [213, 35, 145]
                : [93, 71, 190]
      const histogram = new Map()
      for (let i = 0; i < mask.length; i++) {
        const offset = i * 4
        const rgba = [...original.data.subarray(offset, offset + 4)]
        if (!mask[i]) {
          marked.data.set([225, 230, 232, 255], offset)
          targetMarked.data.set([225, 230, 232, 255], offset)
          continue
        }
        const match = classify(...rgba)
        if (rgba[3] > 0) {
          const key = rgba.join(',')
          const entry = histogram.get(key) ?? { rgba, count: 0, ...match }
          entry.count++
          histogram.set(key, entry)
        }
        const rgb = paint(match)
        targetMarked.data.set([...paint(targetClassify(...rgba)), 255], offset)
        marked.data.set([...rgb, 255], offset)
      }
      cases.push({
        sample,
        type,
        geometry,
        farthest,
        metrics,
        beforeReview,
        beforeInference,
        inferredColors: [...histogram.values()]
          .filter((item) => item.reason === 'inferred')
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        topColors: [...histogram.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 18),
        original: `data:image/png;base64,${body.toString('base64')}`,
        targetMarked: `data:image/png;base64,${PNG.sync.write(targetMarked).toString('base64')}`,
        marked: `data:image/png;base64,${PNG.sync.write(marked).toString('base64')}`,
      })
    }
  }
  const rows = cases.map((item) => ({
    sample: item.sample.id,
    type: item.type.id,
    farthest: item.farthest,
    metrics: item.metrics,
    beforeReview: item.beforeReview,
    beforeInference: item.beforeInference,
    inferredColors: item.inferredColors,
  }))
  await writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        queriedAt: manifest.queriedAt,
        palette: manifest.palette,
        profiles,
        reviewedColorsVersion: REVIEWED_COLORS_VERSION,
        reviewedColors: REVIEWED_COLORS,
        colorInference: COLOR_INFERENCE,
        rows,
      },
      null,
      2,
    ),
  )
  const blocks = cases
    .map((item) => {
      const current = item.metrics[1]
      const target = item.metrics[3]
      const scoreValues = item.metrics
        .map((metric) => metric.score)
        .filter(Number.isFinite)
      const spread = scoreValues.length
        ? Math.max(...scoreValues) - Math.min(...scoreValues)
        : null
      return `<article data-case="${item.sample.id}-${item.type.id}"><h2>${escape(item.sample.name)} / ${escape(item.type.label)}</h2>
      <p>중심 ${item.sample.point.lat}, ${item.sample.point.lng} · ${item.geometry.size}×${item.geometry.size}px · 원 안 최대 중심 거리 ${item.farthest.toFixed(4)}m (현재 구면 모델)</p>
      <div class="images"><figure><img src="${item.original}" alt="수신 원본"><figcaption>① 실제 원본 · 체크무늬는 투명 배경</figcaption></figure><figure><img src="${item.marked}" alt="분류 결과"><figcaption>② 원 안 분류 · 원 밖 회색 · 미표시 흰색 · 낮은 alpha 청록 · 먼 색상 분홍 · 애매한 색상 보라</figcaption></figure><figure><img src="${item.targetMarked}" alt="5% 목표 완화 후보 분류 결과"><figcaption>③ 5% 목표 후보 · 시험용 · 운영 미적용</figcaption></figure></div>
      <p>완화 후보: 점수 <b>${fixed(target.score)}</b> · 미분류 후보 비율 <b>${fixed(target.unclassifiedRatio)}%</b> · 현재 대비 변화 <b>${fixed(target.score == null || current.score == null ? null : target.score - current.score)}</b>점</p>
      <p>사용자 지정 반영 전 → 후: 점수 <b>${fixed(item.beforeReview.score)} → ${fixed(current.score)}</b> · 미분류 <b>${fixed(item.beforeReview.unclassifiedRatio)}% → ${fixed(current.unclassifiedRatio)}%</b></p>
      <p>직접 지정만 → 유사색 추정 추가: 미분류 <b>${fixed(item.beforeInference.unclassifiedRatio)}% → ${fixed(current.unclassifiedRatio)}%</b> · 사용자 지정 ${current.evidence.reviewed}픽셀 · 유사색 추정 ${current.evidence.inferred}픽셀</p>
      <p>현재 점수 <b>${fixed(current.score)}</b> · 미분류 후보 비율 <b>${fixed(current.unclassifiedRatio)}%</b> · 기준 변경 시 점수 범위 폭 <b>${fixed(spread)}</b>점</p>
      <div class="scroll"><table><thead><tr><th>분류 기준</th><th>점수</th><th>후보 중 미분류</th><th>M 판별</th><th>U 미분류</th><th>E 미표시</th><th>직접 지정</th><th>유사색 추정</th><th>낮은 alpha</th><th>먼 색상</th><th>애매한 색상</th></tr></thead><tbody>${item.metrics.map((metric) => `<tr><td>${escape(metric.profile.name)}</td><td>${fixed(metric.score)}</td><td>${fixed(metric.unclassifiedRatio)}%</td><td>${metric.valid}</td><td>${metric.unclassified}</td><td>${metric.unpainted}</td><td>${metric.evidence.reviewed}</td><td>${metric.evidence.inferred}</td><td>${metric.diagnostics.lowAlpha}</td><td>${metric.diagnostics.distance}</td><td>${metric.diagnostics.ambiguous}</td></tr>`).join('')}</tbody></table></div>
      <details><summary>유사색으로 추정한 색상 ${item.inferredColors.length}개 보기</summary><p>추정 라벨이며 직접 확인된 정답은 아닙니다. 다른 등급이면 RGBA와 함께 알려주세요.</p><div class="scroll"><table><tr><th>실제 RGBA</th><th>개수</th><th>추정 등급</th><th>기준색과 RGB 거리</th></tr>${item.inferredColors.map((color) => `<tr><td><span class="swatch" style="background:rgb(${color.rgba.slice(0, 3).join(',')})"></span>${color.rgba.join(', ')}</td><td>${color.count}</td><td>${color.grade}등급</td><td>${fixed(color.distance)}</td></tr>`).join('')}</table></div></details>
      <details><summary>많이 등장한 실제 색상 18개와 판별 결과 보기</summary><div class="scroll"><table><tr><th>실제 RGBA</th><th>개수</th><th>판별 등급</th><th>처리 사유</th><th>색상 거리</th></tr>${item.topColors.map((color) => `<tr><td><span class="swatch" style="background:rgb(${color.rgba.slice(0, 3).join(',')})"></span>${color.rgba.join(', ')}</td><td>${color.count}</td><td>${color.grade ?? '-'}</td><td>${escape(color.reason)}</td><td>${fixed(color.distance)}</td></tr>`).join('')}</table></div></details></article>`
    })
    .join('')
  const populated = rows.filter(
    (row) => row.metrics[3].unclassifiedRatio !== null,
  )
  const belowTarget = populated.filter(
    (row) => row.metrics[3].unclassifiedRatio <= 5,
  ).length
  const worstUnknown = Math.max(
    ...populated.map((row) => row.metrics[3].unclassifiedRatio),
  )
  const worstShift = Math.max(
    ...populated
      .filter(
        (row) => row.metrics[1].score !== null && row.metrics[3].score !== null,
      )
      .map((row) => Math.abs(row.metrics[3].score - row.metrics[1].score)),
  )
  const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>WMS 색상 분류 검토</title><style>
    body{margin:0;background:#f3f6f4;color:#193b34;font:16px/1.6 system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:24px}article,header{background:white;border:1px solid #d5e0dc;border-radius:16px;padding:24px;margin-bottom:24px}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{display:block;width:100%;background:repeating-conic-gradient(#edf0f1 0% 25%,white 0% 50%) 0/20px 20px}figcaption{font-size:14px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}.swatch{display:inline-block;width:24px;height:18px;vertical-align:middle;border:1px solid #888;margin-right:8px}select{padding:12px;font:inherit;max-width:100%}.legend{display:flex;flex-wrap:wrap;gap:12px}details{margin-top:16px}summary{cursor:pointer;padding:10px}article[hidden]{display:none}@media(max-width:650px){main{padding:12px}article,header{padding:16px}.images{grid-template-columns:1fr}}
    </style><main><header><h1>실제 WMS 색상 분류를 함께 확인해요</h1><p>조회 ${escape(manifest.queriedAt)} · 기준 연도 2025 (사용자 확인) · 출처: 생활안전지도 / 경찰청</p><p>점수가 높을수록 주의 단계가 높다는 프로젝트 기준을 적용했습니다. 이 자료는 색상 분류 검토용이며, 실제 정답 등급 라벨과 대조한 정확도(%)는 아닙니다.</p><p><strong>5% 목표 후보: 자료가 있는 ${populated.length}개 중 ${belowTarget}개가 5% 이하, 최대 미분류 ${fixed(worstUnknown)}%. 자료 없음 ${rows.length - populated.length}개는 제외. 기존 대비 최대 점수 변화 ${fixed(worstShift)}점.</strong> 이는 이번 2지점 표본 결과이며 다른 지역의 5% 이하를 보장하지 않습니다.</p><p>사용자 확인 RGBA 5개는 모든 시험 조건에서 지정 등급을 우선 적용합니다. 상단 색상표와 같은 팔레트에서 alpha까지 완전히 일치하면 직접 지정으로, RGB 거리6 이하·alpha 차이3 이하·다른 등급과 거리차2 초과이면 유사색 추정으로 구분합니다. 추정은 사용자가 확인한 정답이 아닙니다. ②는 사용자 지정 반영 후 기본 규칙, ③은 추가 완화 후보이며 운영 미적용입니다.</p><ol><li>원본과 분류 결과를 비교합니다.</li><li>미분류 색상이 어디에 남았는지 확인합니다.</li><li>분류 조건 변경으로 점수가 얼마나 움직이는지 봅니다.</li></ol><div class="legend">${manifest.palette.map((item) => `<span><i class="swatch" style="background:${item.color}"></i>${item.grade}등급</span>`).join('')}</div><p>엄격: alpha128/거리4/차이8 · 현재: alpha96/거리8/차이6 · 완화: alpha64/거리12/차이4 · 5% 목표 후보: alpha16/거리20/차이2. 모두 시험 조건입니다. 목표 후보는 아주 흐릿한 픽셀까지 허용하므로 미분류 감소가 정확도 향상을 뜻하지 않습니다. 운영 계산 기준은 바꾸지 않았습니다.</p><label>확인할 지점·반경·유형 <select id="case">${cases.map((item) => `<option value="${item.sample.id}-${item.type.id}">${escape(item.sample.name)} / ${escape(item.type.label)}</option>`).join('')}</select></label><p>반경은 평균 지구 구면 거리로 계산합니다. 이 보고서의 최대 거리는 동일 모델 내부 확인이며 독립적인 WGS84 타원체 검증은 아닙니다.</p></header>${blocks}</main><script>const select=document.getElementById('case');function show(){document.querySelectorAll('article').forEach(article=>article.hidden=article.dataset.case!==select.value)}select.addEventListener('change',show);show()</script></html>`
  await writeFile(resolve(output, 'index.html'), page)
  console.log(`보고서: ${resolve(output, 'index.html')}`)
  console.log(
    JSON.stringify({
      images: cases.length,
      overall: rows
        .filter((row) => row.type === 'TOT')
        .map((row) => ({
          sample: row.sample,
          score: row.metrics[1].score,
          unknown: row.metrics[1].unclassifiedRatio,
          diagnostics: row.metrics[1].diagnostics,
          farthest: row.farthest,
        })),
    }),
  )
} catch {
  // 원천 오류의 URL/키를 출력하지 않는다.
  console.error(
    '검토 실패: 키 설정, 네트워크, 저장 경로, 원본 파일 무결성을 확인하세요. 기존 보고서가 있으면 --cached를 사용하세요.',
  )
  process.exitCode = 1
}
