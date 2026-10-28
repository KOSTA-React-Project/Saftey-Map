import { Outlet } from 'react-router'
import Header from '../components/layout/Header.jsx'
import styles from './RootLayout.module.css'

function RootLayout() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}

export default RootLayout
