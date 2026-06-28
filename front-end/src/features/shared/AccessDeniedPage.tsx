import { Link } from 'react-router-dom'

export function AccessDeniedPage() {
  return (
    <section className="route-page empty-state" aria-labelledby="access-denied-title">
      <h1 id="access-denied-title">ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p>บัญชีนี้ไม่ได้รับสิทธิ์สำหรับหน้านี้ กรุณาใช้เมนูที่ระบบแสดงให้เท่านั้น</p>
      <Link className="ghost-button" to="/dashboard">
        กลับ Dashboard
      </Link>
    </section>
  )
}
