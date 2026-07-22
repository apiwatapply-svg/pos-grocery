import { Link } from 'react-router-dom'
import { readSession } from '../../lib/auth/session'

export function AccessDeniedPage() {
  const role = readSession()?.user.role
  const fallbackPath = role === 'super_admin' ? '/settings/store' : '/login'
  const fallbackLabel = role === 'super_admin' ? 'กลับหน้าจัดการร้าน' : 'กลับหน้า Login'

  return (
    <section className="route-page empty-state" aria-labelledby="access-denied-title">
      <h1 id="access-denied-title">ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p>บัญชีนี้ไม่ได้รับสิทธิ์สำหรับหน้านี้ กรุณาใช้เมนูที่ระบบแสดงให้เท่านั้น</p>
      <Link className="ghost-button" to={fallbackPath}>
        {fallbackLabel}
      </Link>
    </section>
  )
}
