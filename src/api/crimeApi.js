import { CRIME_LAYER } from '../constants/crimeTypes.js'

const WMS_URL = 'https://www.safemap.go.kr/openapi2/IF_0087_WMS'
const SAFEMAP_KEY = import.meta.env.VITE_SAFEMAP_KEY

export const hasSafemapKey = Boolean(SAFEMAP_KEY)

// 생활안전지도 범죄주의구간 WMS 그림 주소 (bbox: EPSG:5181, size: px, style: 유형별 스타일)
export function getCrimeImageUrl(bbox, size, style) {
  const params = new URLSearchParams({
    serviceKey: SAFEMAP_KEY,
    layers: CRIME_LAYER,
    styles: style,
    srs: 'EPSG:5181',
    bbox: bbox.join(','),
    format: 'image/png',
    width: String(size),
    height: String(size),
    transparent: 'TRUE',
  })
  return `${WMS_URL}?${params}`
}

// 서버가 캐시를 막아서(no-store) 받은 그림을 직접 보관해 같은 그림은 한 번만 요청
const images = new Map()
const MAX_IMAGES = 150

export function fetchCrimeImage(url) {
  if (!images.has(url)) {
    const request = fetch(url, { credentials: 'omit' })
      .then((response) => {
        const type = response.headers.get('content-type') ?? ''
        if (!response.ok || !type.includes('image/png')) {
          throw new Error('범죄주의구간 그림을 받지 못했어요.')
        }
        return response.blob()
      })
      .then((blob) => URL.createObjectURL(blob))
      .catch((error) => {
        images.delete(url)
        throw error
      })
    images.set(url, request)

    // 오래된 그림부터 정리
    if (images.size > MAX_IMAGES) {
      const [oldestUrl, oldest] = images.entries().next().value
      images.delete(oldestUrl)
      oldest.then(URL.revokeObjectURL, () => {})
    }
  }
  return images.get(url)
}

let legendRequest = null

// 공식 10등급 범례 색상 [{ grade, color }]. 앱에서 한 번만 요청
export function fetchCrimeLegend() {
  if (!legendRequest) {
    const params = new URLSearchParams({
      serviceKey: SAFEMAP_KEY,
      intId: 'IF_0087',
    })
    legendRequest = fetch(
      `https://www.safemap.go.kr/openapi2/lgdInfo?${params}`,
      { credentials: 'omit' },
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.header?.resultCode !== '00') {
          throw new Error('범례를 받지 못했어요.')
        }
        return data.body.items.item
          .map((item) => ({ grade: Number(item.LGD_NO), color: item.IMAGE }))
          .sort((a, b) => a.grade - b.grade)
      })
      .catch((error) => {
        legendRequest = null
        throw error
      })
  }
  return legendRequest
}
