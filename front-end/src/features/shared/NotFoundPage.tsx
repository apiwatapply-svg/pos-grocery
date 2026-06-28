import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="route-page empty-state" aria-labelledby="not-found-title">
      <h1 id="not-found-title">ไม่พบหน้านี้</h1>
      <p>URL นี้ไม่มีในระบบ POS Grocery</p>
      <Link className="ghost-button" to="/dashboard">
        กลับ Dashboard
      </Link>
    </section>
  )
}
