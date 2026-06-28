import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, type DashboardReport } from './reportApi'

export function BestSellersReportPage() {
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลดสินค้าขายดี')

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
          setMessage(error instanceof Error ? error.message : 'โหลดสินค้าขายดีไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="route-page" aria-labelledby="best-sellers-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="best-sellers-title">สินค้าขายดี</h1>
        </div>
      </div>
      <section className="panel">
        <h2>ตามช่วงเวลาที่เลือก</h2>
        {dashboard?.bestSellers.length ? dashboard.bestSellers.map((item) => (
          <div className="inventory-row" key={item.productId}>
            <div>
              <strong>{item.productName}</strong>
              <span>{item.quantity} ชิ้น</span>
            </div>
            <strong>{bahtFromSatang(item.totalSalesSatang)} บาท</strong>
          </div>
        )) : (
          <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
        )}
      </section>
    </section>
  )
}
