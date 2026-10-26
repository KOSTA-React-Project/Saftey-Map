import { createContext, useContext } from 'react'
import { DEFAULT_CRIME_TYPE } from '../constants/crimeTypes.js'

// MapLayout이 지도에 표시할 범죄 유형을 들고 페이지에 공유
export const CrimeTypeContext = createContext({
  crimeType: DEFAULT_CRIME_TYPE,
  setCrimeType: () => {},
})

export function useCrimeType() {
  return useContext(CrimeTypeContext)
}
