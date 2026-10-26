// 좌표 → 주소 변환. 카카오 SDK에 libraries=services가 있어야 동작하고,
// 없거나 실패하면 null을 돌려줌. 팀 공용 검색 기능이 생기면 그쪽으로 교체
export function getAddress({ lat, lng }) {
  const services = window.kakao?.maps?.services
  if (!services) return Promise.resolve(null)

  return new Promise((resolve) => {
    new services.Geocoder().coord2Address(lng, lat, (result, status) => {
      if (status !== services.Status.OK || !result[0]) {
        resolve(null)
        return
      }
      const { road_address: road, address } = result[0]
      resolve(road?.address_name ?? address?.address_name ?? null)
    })
  })
}
