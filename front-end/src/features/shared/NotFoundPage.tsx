import { Link } from 'react-router-dom'
import { readSession } from '../../lib/auth/session'

export function NotFoundPage() {
  const role = readSession()?.user.role
  const fallbackPath = role === 'super_admin' ? '/settings/store' : '/login'
  const fallbackLabel = role === 'super_admin' ? 'กลับหน้าจัดการร้าน' : 'กลับหน้า Login'

  return (
    <section className="route-page empty-state" aria-labelledby="not-found-title">
      <h1 id="not-found-title">ไม่พบหน้านี้</h1>
      <p>URL นี้ไม่มีในระบบ POS Grocery</p>
      <Link className="ghost-button" to={fallbackPath}>
        {fallbackLabel}
      </Link>
    </section>
  )
}
