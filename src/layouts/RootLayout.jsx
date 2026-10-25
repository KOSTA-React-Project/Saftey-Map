import { Outlet } from 'react-router'
import Header from '../components/layout/Header.jsx'

function RootLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  )
}

export default RootLayout
