import {
  COLOR_INFERENCE,
  inferReviewedColor,
  REVIEWED_COLORS,
  REVIEWED_COLORS_VERSION,
  REVIEWED_PALETTE,
} from './reviewedColors.js'
import { PNG } from 'pngjs'
import { summarizeCounts, compareMetrics } from '../shared/colorMetrics.js'
import { CRIME_TYPES } from '../shared/crimeTypes.js'
import { validatePng } from './source.js'

// 평균 지구 반지름 구면 거리. 타원체 측지 거리와의 차이는 검증 문서에 기록.
export const EARTH_RADIUS = 6371008.8
export const CLASSIFICATION = Object.freeze({
  version: 'nearest-rgb-a96-d8-gap6-reviewed-inferred-v2',
  inference: COLOR_INFERENCE,
  reviewedColorsVersion: REVIEWED_COLORS_VERSION,
  alphaMin: 96,
  maxDistance: 8,
  minGap: 6,
})
const RAD = Math.PI / 180
export const ANALYSIS_VERSION = 'wms-nearest-rgba-sphere-reviewed-inferred-v3'

export function validConditions(value) {
  return (
    value &&
    [500, 1000].includes(value.radius) &&
    ['A', 'B'].every((slot) => {
      const point = value[slot]
      // 원천 서비스 범위 내 국내 좌표만 받는다. 숫자 문자열 자동 변환 안 함.
      return (
        point &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        point.lat >= 33 &&
        point.lat <= 39 &&
        point.lng >= 124 &&
        point.lng <= 132
      )
    })
  )
}

export function distanceMeters(a, b) {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) *
      Math.cos(b.lat * RAD) *
      Math.sin(((b.lng - a.lng) * RAD) / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

export function geometryFor(point, radius) {
  const angular = (radius + 4) / EARTH_RADIUS
  const dy = angular / RAD
  const dx = Math.asin(Math.sin(angular) / Math.cos(point.lat * RAD)) / RAD
  return {
    bbox: [point.lng - dx, point.lat - dy, point.lng + dx, point.lat + dy],
    size: radius === 500 ? 512 : 1024,
  }
}

export function radiusMask(point, radius, { bbox, size }) {
  const mask = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const lat = bbox[3] - ((y + 0.5) * (bbox[3] - bbox[1])) / size
    for (let x = 0; x < size; x++) {
      const lng = bbox[0] + ((x + 0.5) * (bbox[2] - bbox[0])) / size
      if (distanceMeters(point, { lat, lng }) <= radius) mask[y * size + x] = 1
    }
  }
  return mask
}

// 보고서와 실제 집계가 같은 분류 함수를 사용한다. profile 변경은 검증용만 허용.
export function createPixelClassifier(
  palette,
  profile = CLASSIFICATION,
  { useReviewedColors = true, useInferredColors = true } = {},
) {
  if (
    !Array.isArray(palette) ||
    palette.length !== 10 ||
    palette.some(
      (item, index) =>
        item.grade !== index + 1 || !/^#[0-9a-f]{6}$/i.test(item.color),
    ) ||
    new Set(palette.map((item) => item.color.toLowerCase())).size !== 10 ||
    !Number.isInteger(profile.alphaMin) ||
    profile.alphaMin < 1 ||
    profile.alphaMin > 255 ||
    !Number.isFinite(profile.maxDistance) ||
    profile.maxDistance < 0 ||
    !Number.isFinite(profile.minGap) ||
    profile.minGap < 0
  )
    throw new Error('classification settings')
  const colors = palette.map((item) =>
    item.color
      .slice(1)
      .match(/../g)
      .map((hex) => parseInt(hex, 16)),
  )
  const reviewed = new Map(
    useReviewedColors &&
      palette.every(
        (item, index) => item.color.toLowerCase() === REVIEWED_PALETTE[index],
      )
      ? REVIEWED_COLORS.map((item) => [item.rgba.join(','), item.grade])
      : [],
  )
  const reviewedAlpha = new Set(REVIEWED_COLORS.map((item) => item.rgba[3]))
  const inferenceAlpha = new Set(
    REVIEWED_COLORS.flatMap((item) =>
      Array.from(
        { length: COLOR_INFERENCE.maxAlphaDifference * 2 + 1 },
        (_, offset) =>
          item.rgba[3] + offset - COLOR_INFERENCE.maxAlphaDifference,
      ),
    ),
  )
  const cache = new Map()
  return (red, green, blue, alpha) => {
    if (alpha === 0) return { grade: null, reason: 'transparent' }
    // alpha까지 완전히 일치할 때만 우선. 비슷한 색이나 다른 팔레트에는 확장하지 않는다.
    const confirmed = reviewedAlpha.has(alpha)
      ? reviewed.get(`${red},${green},${blue},${alpha}`)
      : undefined
    if (confirmed !== undefined)
      return {
        grade: confirmed,
        reason: 'reviewed',
        reviewVersion: REVIEWED_COLORS_VERSION,
      }
    if (useInferredColors && reviewed.size && inferenceAlpha.has(alpha)) {
      const inferred = inferReviewedColor(red, green, blue, alpha)
      if (inferred) return inferred
    }
    if (alpha < profile.alphaMin) return { grade: null, reason: 'lowAlpha' }
    const key = (red << 16) | (green << 8) | blue
    if (cache.has(key)) return cache.get(key)
    let nearest = Infinity
    let second = Infinity
    let grade = null
    for (let index = 0; index < colors.length; index++) {
      const rgb = colors[index]
      const squared =
        (red - rgb[0]) ** 2 + (green - rgb[1]) ** 2 + (blue - rgb[2]) ** 2
      if (squared < nearest) {
        second = nearest
        nearest = squared
        grade = index + 1
      } else if (squared < second) second = squared
    }
    const distance = Math.sqrt(nearest)
    const gap = Math.sqrt(second) - distance
    const reason =
      distance > profile.maxDistance
        ? 'distance'
        : gap <= profile.minGap
          ? 'ambiguous'
          : 'classified'
    const result = {
      grade: reason === 'classified' ? grade : null,
      reason,
      distance,
      gap,
    }
    if (cache.size < 65536) cache.set(key, result)
    return result
  }
}

// alpha=0만 미표시 E. 낮은 투명도·먼 색상·등급 간 애매한 색상은 각각 U로 남긴다.
export function countPixels(
  pngBuffer,
  size,
  mask,
  palette,
  profile = CLASSIFICATION,
  reviewOptions,
) {
  validatePng(pngBuffer, size)
  if (mask.length !== size * size) throw new Error('mask size')
  if (pngBuffer[24] > 8) throw new Error('unsupported bit depth')
  const { data } = PNG.sync.read(pngBuffer, { checkCRC: true })
  const classify = createPixelClassifier(palette, profile, reviewOptions)
  const counts = Array(10).fill(0)
  const diagnostics = { lowAlpha: 0, distance: 0, ambiguous: 0 }
  let unpainted = 0
  const evidence = { reviewed: 0, inferred: 0 }
  for (let pixel = 0; pixel < mask.length; pixel++) {
    if (!mask[pixel]) continue
    const offset = pixel * 4
    const { grade, reason } = classify(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3],
    )
    if (grade !== null) {
      counts[grade - 1]++
      if (reason === 'reviewed' || reason === 'inferred') evidence[reason]++
    } else if (reason === 'transparent') unpainted++
    else diagnostics[reason]++
  }
  const unclassified =
    diagnostics.lowAlpha + diagnostics.distance + diagnostics.ambiguous
  return {
    ...summarizeCounts(counts, unclassified, unpainted),
    diagnostics,
    evidence,
  }
}

export async function analyzeComparison(
  conditions,
  source,
  { signal, expectedPalette } = {},
) {
  const palette = await source.legend(signal)
  if (
    expectedPalette &&
    JSON.stringify(palette.map((item) => item.color)) !==
      JSON.stringify(expectedPalette)
  )
    throw new Error('palette changed')
  const output = {}
  for (const slot of ['A', 'B']) {
    signal.throwIfAborted()
    const geometry = geometryFor(conditions[slot], conditions.radius)
    const mask = radiusMask(conditions[slot], conditions.radius, geometry)
    const byCrimeType = {}
    // 12장을 동시에 요청하지 않고 원본 이미지 한 장씩 처리한다.
    for (const type of CRIME_TYPES) {
      signal.throwIfAborted()
      const body = await source.image({
        ...geometry,
        style: type.style,
        signal,
      })
      signal.throwIfAborted()
      byCrimeType[type.id] = countPixels(body, geometry.size, mask, palette)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    output[slot] = { ...byCrimeType.TOT, byCrimeType, geometry }
  }
  signal.throwIfAborted()
  return {
    conditions,
    ...output,
    comparison: compareMetrics(output.A, output.B),
    synthetic: false,
    queriedAt: new Date().toISOString(),
    version: ANALYSIS_VERSION,
    source: {
      name: '생활안전지도 · 경찰청',
      interface: 'IF_0087_WMS',
      crs: 'EPSG:4326',
      axisOrder: 'longitude,latitude',
      palette,
      classifier: CLASSIFICATION,
      distanceModel: 'mean-earth-sphere',
      earthRadius: EARTH_RADIUS,
    },
  }
}
