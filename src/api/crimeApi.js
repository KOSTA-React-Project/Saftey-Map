// 원천 API 키는 서버에만 두고 브라우저에서는 같은 출처 API를 호출한다.
export const hasSafemapKey = import.meta.env.VITE_WMS_ENABLED !== 'false'

export function getCrimeImageUrl(bbox, size, style) {
  const params = new URLSearchParams({
    bbox: bbox.join(','),
    size: String(size),
    style,
  })
  return `/api/public-data/crime-image?${params}`
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
    legendRequest = fetch('/api/public-data/crime-legend', {
      credentials: 'omit',
    })
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
