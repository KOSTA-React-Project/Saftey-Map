import {
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { searchPlaces } from '../../utils/placeSearch.js'
import styles from './PlaceSearchBox.module.css'

// 주소·장소명 검색. 결과를 고르면 onSelect({ lat, lng, label, address }) 호출
// value·onValueChange를 주면 입력값을 바깥에서 관리 (예: 고른 위치의 주소 표시)
// selectFirst면 검색하자마자 첫 결과를 고르고, 나머지 후보는 목록으로 남김
function PlaceSearchBox({
  ref,
  onSelect,
  value,
  onValueChange,
  selectFirst = false,
  placeholder = '주소나 장소명을 입력하세요',
}) {
  const inputId = useId()
  const [innerQuery, setInnerQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  // 검색 중 입력이 바뀌면 늦게 온 결과를 버리기 위한 요청 번호
  const requestRef = useRef(0)

  const query = value ?? innerQuery

  // 지도 클릭처럼 입력 바깥에서 위치를 고를 때도 진행 중인 검색을 무효화한다.
  const cancelSearch = useCallback(() => {
    requestRef.current += 1
    setStatus('idle')
    setResults([])
    setMessage('')
  }, [])

  useImperativeHandle(ref, () => ({ cancelSearch }), [cancelSearch])

  const setQuery = (next) => {
    cancelSearch()
    if (onValueChange) onValueChange(next)
    else setInnerQuery(next)
  }

  const search = async () => {
    const keyword = query.trim()
    if (!keyword || status === 'loading') return

    const requestId = ++requestRef.current
    setStatus('loading')
    setResults([])
    try {
      const found = await searchPlaces(keyword)
      if (requestId !== requestRef.current) return
      setStatus('done')
      setMessage(found.length === 0 ? '검색 결과가 없어요.' : '')
      if (selectFirst && found.length > 0) {
        onSelect(found[0])
        setResults(found.length > 1 ? found : [])
      } else {
        setResults(found)
      }
    } catch (err) {
      if (requestId !== requestRef.current) return
      setStatus('done')
      setMessage(err.message)
    }
  }

  const handleKeyDown = (e) => {
    // 바깥 폼 안에 있어도 Enter가 폼 제출 대신 검색이 되게 함
    // 일부 IME는 조합 확정 시 isComposing=false, keyCode=229로 전달된다.
    if (
      e.key !== 'Enter' ||
      e.nativeEvent.isComposing ||
      e.nativeEvent.keyCode === 229
    )
      return
    e.preventDefault()
    search()
  }

  const handleSelect = ({ lat, lng, label, address }) => {
    onSelect({ lat, lng, label, address })
    setResults([])
    setMessage('')
  }

  return (
    <div className={styles.searchBox}>
      <div className={styles.form} role="search">
        <label htmlFor={inputId} className={styles.hidden}>
          주소 또는 장소 검색
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          className={styles.button}
          onClick={search}
          disabled={status === 'loading'}
        >
          검색
        </button>
      </div>

      <div role="status">
        {status === 'loading' && <p className={styles.message}>검색 중…</p>}
        {message && <p className={styles.message}>{message}</p>}
      </div>

      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((result) => (
            <li key={`${result.label}-${result.lat}-${result.lng}`}>
              <button
                type="button"
                className={styles.result}
                onClick={() => handleSelect(result)}
              >
                <span className={styles.label}>{result.label}</span>
                {result.address !== result.label && (
                  <span className={styles.address}>{result.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PlaceSearchBox
