import { Route, Routes } from 'react-router'
import RootLayout from './layouts/RootLayout.jsx'
import MapLayout from './layouts/MapLayout.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import CompareSetupPage from './pages/CompareSetupPage.jsx'
import { ROUTES } from './constants/routes.js'

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* 사이드바 + 지도 화면 */}
        <Route element={<MapLayout />}>
          <Route index element={<ExplorePage />} />
          <Route path={ROUTES.COMPARE} element={<CompareSetupPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
