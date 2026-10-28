import test from 'node:test'
import assert from 'node:assert/strict'
import {
  summarizeCounts,
  compareMetrics,
} from '../../src/services/colorMetrics.js'
import { comparePlaces } from '../../src/services/compareService.js'
import {
  compareReducer,
  initialCompareState,
} from '../../src/utils/compareState.js'

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`)
const point = { lat: 37.5, lng: 127 }
const conditions = { A: point, B: { lat: 37.6, lng: 127.1 }, radius: 1000 }

test('첨부 예시 집계의 평균·분포·비율과 미분류 조건부 범위를 재현한다', () => {
  const result = summarizeCounts(
    [259, 698, 326, 403, 457, 325, 86, 28, 0, 0],
    1565,
    6717,
  )
  assert.equal(result.status, 'OK')
  assert.equal(result.valid, 2582)
  assert.equal(result.total, 10864)
  near(result.score, 28.935364489198726)
  near(result.highGradeRatio, (100 * 28) / 2582)
  near(result.displayRatio, (100 * 2582) / 10864)
  near(result.unclassifiedRatio, (100 * 1565) / 4147)
  near(
    result.distribution.reduce((a, b) => a + b),
    100,
  )
  near(
    result.displayRatio + result.unclassifiedTotalRatio + result.unpaintedRatio,
    100,
  )
  near(result.scoreBounds.lower, 18.015700774321463)
  near(result.scoreBounds.upper, 55.753824719341964)
})

test('전부 1등급은 유효한 0점, 전부 10등급은 100점이다', () => {
  const low = summarizeCounts([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 0)
  const high = summarizeCounts([0, 0, 0, 0, 0, 0, 0, 0, 0, 100], 0, 0)
  assert.equal(low.score, 0)
  assert.equal(low.status, 'OK')
  assert.equal(high.score, 100)
  assert.equal(low.highGradeRatio, 0)
  assert.equal(high.highGradeRatio, 100)
  assert.deepEqual(high.scoreBounds, { lower: 100, upper: 100 })
})

test('8등급 이상에만 포함하고 E/U를 평균 분모에 넣지 않는다', () => {
  const counts = [10, 0, 0, 0, 0, 0, 20, 30, 0, 40]
  const clean = summarizeCounts(counts, 0, 0)
  const noisy = summarizeCounts(counts, 20, 80)
  assert.equal(noisy.score, clean.score)
  assert.equal(noisy.highGradeRatio, 70)
  assert.equal(noisy.displayRatio, 50)
  near(noisy.unclassifiedRatio, (100 * 20) / 120)
  const reversed = summarizeCounts([...counts].reverse(), 0, 0)
  near(clean.score + reversed.score, 100)
})

test('전부 미표시 또는 미분류면 점수는 null이고 정의되는 비율만 제공한다', () => {
  const counts = Array(10).fill(0)
  const transparent = summarizeCounts(counts, 0, 100)
  const unknown = summarizeCounts(counts, 100, 0)
  for (const result of [transparent, unknown]) {
    assert.equal(result.status, 'NO_DATA')
    for (const name of [
      'score',
      'distribution',
      'highGradeRatio',
      'scoreBounds',
    ])
      assert.equal(result[name], null)
    assert.equal(result.displayRatio, 0)
  }
  assert.equal(transparent.unclassifiedRatio, null)
  assert.equal(unknown.unclassifiedRatio, 100)
  assert.equal(summarizeCounts(counts, 0, 0).status, 'EMPTY_AREA')
})

test('잘못된 개수·누락·소수·음수·정밀도 초과는 계산하지 않는다', () => {
  for (const counts of [
    null,
    [],
    Array(9).fill(1),
    Array(11).fill(1),
    Array(10).fill(-1),
    Array(10).fill(0.1),
    Array(10).fill(NaN),
    Array(10).fill(Infinity),
    Array(10).fill('1'),
    Array(10).fill(Number.MAX_SAFE_INTEGER),
  ]) {
    const result = summarizeCounts(counts, 0, 0)
    assert.equal(result.status, 'INVALID_DATA')
    assert.equal(result.score, null)
    assert.equal(result.displayRatio, null)
  }
  for (const invalid of [undefined, -1, 1.5, Infinity]) {
    assert.equal(
      summarizeCounts(Array(10).fill(1), invalid, 0).status,
      'INVALID_DATA',
    )
    assert.equal(
      summarizeCounts(Array(10).fill(1), 0, invalid).status,
      'INVALID_DATA',
    )
  }
})

test('A−B 지수와 %p 차이, 미분류에 따른 방향 변경 가능 여부를 계산한다', () => {
  const A = summarizeCounts([0, 0, 0, 0, 0, 0, 0, 0, 0, 100], 0, 0)
  const B = summarizeCounts([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 0)
  const difference = compareMetrics(A, B)
  assert.equal(difference.scoreDifference, 100)
  assert.equal(difference.highGradeDifference, 100)
  assert.equal(difference.directionMayChange, false)
  assert.equal(compareMetrics(B, A).scoreDifference, -100)
  const uncertain = summarizeCounts([50, 0, 0, 0, 0, 0, 0, 0, 0, 50], 100, 0)
  assert.equal(compareMetrics(uncertain, uncertain).directionMayChange, true)
  assert.equal(
    compareMetrics(A, { ...B, version: 'other' }).status,
    'NOT_COMPARABLE',
  )
  assert.equal(
    compareMetrics(A, summarizeCounts(Array(10).fill(0), 0, 100))
      .scoreDifference,
    null,
  )
})

test('입력 배열을 나중에 변경해도 계산 결과의 집계는 유지한다', () => {
  const counts = Array(10).fill(1)
  const result = summarizeCounts(counts, 0, 0)
  counts[0] = 999
  assert.equal(result.counts[0], 1)
})

test('비교 서비스는 서버 결과만 사용하고 조건·가상 응답을 검증한다', async () => {
  const metrics = summarizeCounts(Array(10).fill(1), 0, 0)
  const payload = {
    conditions,
    synthetic: false,
    A: { ...metrics, byCrimeType: {} },
    B: { ...metrics, byCrimeType: {} },
  }
  let sent
  const fetchImpl = async (url, options) => {
    assert.equal(url, '/api/public-data/crime-compare')
    assert.equal(options.method, 'POST')
    sent = JSON.parse(options.body)
    return Response.json(payload)
  }
  const result = await comparePlaces(conditions, { fetchImpl })
  assert.equal(result.synthetic, false)
  assert.deepEqual(sent, conditions)
  await assert.rejects(
    comparePlaces({ ...conditions, radius: 250 }, { fetchImpl }),
  )
  await assert.rejects(
    comparePlaces(conditions, {
      fetchImpl: async () => Response.json({ ...payload, synthetic: true }),
    }),
    /일치/,
  )
  await assert.rejects(
    comparePlaces(conditions, {
      fetchImpl: async () =>
        Response.json({ message: '설정 필요' }, { status: 503 }),
    }),
    /설정 필요/,
  )
  await assert.rejects(
    comparePlaces(conditions, {
      fetchImpl: async () =>
        Response.json({
          ...payload,
          conditions: { ...conditions, radius: 500 },
        }),
    }),
    /일치/,
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    comparePlaces(conditions, {
      signal: controller.signal,
      fetchImpl: async (_url, { signal }) => {
        signal.throwIfAborted()
      },
    }),
    { name: 'AbortError' },
  )
})

test('지점·반경 변경 시 결과 무효화하고 늦은 이전 결과를 거절한다', () => {
  let state = compareReducer(initialCompareState, {
    type: 'select',
    position: point,
  })
  state = compareReducer(state, { type: 'select', position: conditions.B })
  const revision = state.revision
  state = compareReducer(state, { type: 'start', requestId: 'old' })
  state = compareReducer(state, { type: 'radius', radius: 500 })
  state = compareReducer(state, {
    type: 'success',
    requestId: 'old',
    revision,
    result: {},
  })
  assert.equal(state.result, null)
  state = compareReducer(state, { type: 'start', requestId: 'new' })
  assert.equal(
    compareReducer(state, {
      type: 'success',
      requestId: 'old',
      revision: state.revision,
      result: {},
    }).result,
    null,
  )
  state = compareReducer(state, {
    type: 'success',
    requestId: 'new',
    revision: state.revision,
    result: { version: 'new' },
  })
  assert.equal(state.result.version, 'new')
  state = compareReducer(state, { type: 'select', position: point })
  assert.equal(state.result, null)
})
