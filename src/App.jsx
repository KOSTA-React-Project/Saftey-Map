import { Route, Routes } from 'react-router'
import { ROUTES } from './constants/routes.js'
import RootLayout from './layouts/RootLayout.jsx'
import MapLayout from './layouts/MapLayout.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import CompareSetupPage from './pages/CompareSetupPage.jsx'
import { ROUTES } from './constants/routes.js'
import NotePage from './pages/NotePage.jsx'
import NoteDetailPage from './pages/NoteDetailPage.jsx'
import NoteComposePage from './pages/NoteComposePage.jsx'
import PolicyPage from './pages/PolicyPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* 사이드바 + 지도 화면 */}
        <Route element={<MapLayout />}>
          <Route index element={<ExplorePage />} />
          <Route path={ROUTES.COMPARE} element={<CompareSetupPage />} />
          <Route path={ROUTES.NOTES} element={<NotePage />} />
          <Route path={`${ROUTES.NOTES}/:id`} element={<NoteDetailPage />} />
        </Route>
        <Route path={`${ROUTES.NOTES}/new`} element={<NoteComposePage />} />
        <Route path={ROUTES.POLICY} element={<PolicyPage />} />
      </Route>
    </Routes>
  )
}

export default App
