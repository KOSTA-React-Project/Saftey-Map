import { Route, Routes } from 'react-router'
import AdminPage from './pages/AdminPage.jsx'
import { ROUTES } from './constants/routes.js'
import RootLayout from './layouts/RootLayout.jsx'
import MapLayout from './layouts/MapLayout.jsx'
import AuthLayout from './layouts/AuthLayout.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import CompareSetupPage from './pages/CompareSetupPage.jsx'
import NotePage from './pages/NotePage.jsx'
import NoteDetailPage from './pages/NoteDetailPage.jsx'
import NoteComposePage from './pages/NoteComposePage.jsx'
import PolicyPage from './pages/PolicyPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'

function App() {
  return (
    <Routes>
      <Route path={ROUTES.ADMIN} element={<AdminPage />} />
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
        {/* 소개 + 폼 화면 */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
