import { useId, useState } from 'react'
import { searchPlaces } from '../../utils/placeSearch.js'
import styles from './PlaceSearchBox.module.css'

// 주소·장소명 검색. 결과를 고르면 onSelect({ lat, lng, label }) 호출
function PlaceSearchBox({
  onSelect,
  placeholder = '주소나 장소명을 입력하세요',
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const keyword = query.trim()
    if (!keyword) return

    setStatus('loading')
    setResults([])
    try {
      const found = await searchPlaces(keyword)
      setResults(found)
      setStatus('done')
      setMessage(found.length === 0 ? '검색 결과가 없어요.' : '')
    } catch (err) {
      setStatus('done')
      setMessage(err.message)
    }
  }

  const handleSelect = ({ lat, lng, label }) => {
    onSelect({ lat, lng, label })
    setResults([])
    setMessage('')
  }

  return (
    <div className={styles.searchBox}>
      <form className={styles.form} onSubmit={handleSubmit} role="search">
        <label htmlFor={inputId} className={styles.hidden}>
          주소 또는 장소 검색
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={status === 'loading'}
        >
          검색
        </button>
      </form>

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
