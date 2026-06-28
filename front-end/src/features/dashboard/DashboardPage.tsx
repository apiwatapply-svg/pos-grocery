import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, type DashboardReport } from '../reports/reportApi'

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลด Dashboard')

  useEffect(() => {
    let active = true

    apiGet<DashboardReport>('/reports/dashboard')
      .then((report) => {
        if (active) {
          setDashboard(report)
          setMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลด Dashboard ไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const topSeller = dashboard?.bestSellers[0]
  const bestTimeSlot = dashboard?.bestTimeSlots[0]
  const averageOrderSatang = dashboard?.summary.orderCount
    ? Math.round(dashboard.summary.totalSalesSatang / dashboard.summary.orderCount)
    : 0
  const dayStatus = dashboard?.summary.orderCount
    ? `มีการขายแล้ว ${dashboard.summary.orderCount} บิล`
    : 'ยังไม่มีบิลวันนี้'

  return (
    <section className="route-page" aria-labelledby="dashboard-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="dashboard-title">Dashboard</h1>
        </div>
      </div>
      <section className="metric-strip" aria-label="สรุป Dashboard">
        <div>
          <span>ยอดขายวันนี้</span>
          <strong>{bahtFromSatang(dashboard?.summary.totalSalesSatang ?? 0)} บาท</strong>
        </div>
        <div>
          <span>จำนวนบิลวันนี้</span>
          <strong>{dashboard?.summary.orderCount ?? 0}</strong>
        </div>
        <div>
          <span>จำนวนชิ้นที่ขาย</span>
          <strong>{dashboard?.summary.itemsSold ?? 0}</strong>
        </div>
      </section>
      <section className="dashboard-card-grid" aria-label="การ์ดภาพรวม Dashboard">
        <article className="dashboard-card dashboard-card-green">
          <span>สินค้าท็อปวันนี้</span>
          <strong>{topSeller?.productName ?? 'ยังไม่มีสินค้าขายดี'}</strong>
          <small>
            {topSeller
              ? `${topSeller.quantity} ชิ้น / ${bahtFromSatang(topSeller.totalSalesSatang)} บาท`
              : 'รอข้อมูลจากยอดขาย'}
          </small>
        </article>
        <article className="dashboard-card dashboard-card-blue">
          <span>ช่วงที่ขายดีที่สุด</span>
          <strong>
            {bestTimeSlot ? `${String(bestTimeSlot.hour).padStart(2, '0')}:00` : 'ยังไม่มีช่วงเวลาขายดี'}
          </strong>
          <small>
            {bestTimeSlot
              ? `${bestTimeSlot.orderCount} บิล / ${bahtFromSatang(bestTimeSlot.totalSalesSatang)} บาท`
              : 'รอข้อมูลจากยอดขาย'}
          </small>
        </article>
        <article className="dashboard-card dashboard-card-orange">
          <span>ค่าเฉลี่ยต่อบิล</span>
          <strong>{bahtFromSatang(averageOrderSatang)} บาท</strong>
          <small>คำนวณจากยอดขายวันนี้</small>
        </article>
        <article className="dashboard-card dashboard-card-purple">
          <span>สถานะวันนี้</span>
          <strong>{dayStatus}</strong>
          <small>
            {dashboard?.summary.itemsSold ? `ขายสินค้าแล้ว ${dashboard.summary.itemsSold} ชิ้น` : 'เริ่มขายเพื่อดูภาพรวม'}
          </small>
        </article>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>สินค้าขายดี</h2>
          {dashboard?.bestSellers.length ? dashboard.bestSellers.map((item) => (
            <div className="inventory-row" key={item.productId}>
              <strong>{item.productName}</strong>
              <span>{item.quantity} ชิ้น / {bahtFromSatang(item.totalSalesSatang)} บาท</span>
            </div>
          )) : (
            <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
          )}
        </section>
        <section className="panel">
          <h2>ช่วงเวลาขายดี</h2>
          {dashboard?.bestTimeSlots.length ? dashboard.bestTimeSlots.map((slot) => (
            <div className="inventory-row" key={slot.hour}>
              <strong>{String(slot.hour).padStart(2, '0')}:00</strong>
              <span>{slot.orderCount} บิล / {bahtFromSatang(slot.totalSalesSatang)} บาท</span>
            </div>
          )) : (
            <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
          )}
        </section>
      </div>
    </section>
  )
}
