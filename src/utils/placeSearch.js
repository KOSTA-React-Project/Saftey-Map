const MAX_RESULTS = 8

// 주소(Geocoder.addressSearch)와 장소명(Places.keywordSearch)을 함께 검색해
// [{ label, address, lat, lng }]로 돌려줌. 카카오 SDK에 libraries=services 필요
export function searchPlaces(query) {
  const services = window.kakao?.maps?.services
  if (!services) {
    return Promise.reject(new Error('검색 기능을 불러오지 못했어요.'))
  }

  const run = (search) =>
    new Promise((resolve) =>
      search((result, status) =>
        resolve(status === services.Status.OK ? result : []),
      ),
    )

  const addresses = run((done) =>
    new services.Geocoder().addressSearch(query, done),
  ).then((items) =>
    items.map((item) => ({
      label: item.road_address?.address_name ?? item.address_name,
      address: item.address_name,
      lat: Number(item.y),
      lng: Number(item.x),
    })),
  )

  const places = run((done) =>
    new services.Places().keywordSearch(query, done),
  ).then((items) =>
    items.map((item) => ({
      label: item.place_name,
      address: item.road_address_name || item.address_name,
      lat: Number(item.y),
      lng: Number(item.x),
    })),
  )

  return Promise.all([addresses, places]).then(([a, p]) =>
    [...a, ...p].slice(0, MAX_RESULTS),
  )
}
