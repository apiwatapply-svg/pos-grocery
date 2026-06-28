import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, type SalesReport } from '../reports/reportApi'

export function ReceiptListPage() {
  const [report, setReport] = useState<SalesReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลดใบเสร็จ')

  useEffect(() => {
    let active = true

    apiGet<SalesReport>('/reports/sales')
      .then((nextReport) => {
        if (active) {
          setReport(nextReport)
          setMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดใบเสร็จไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="route-page" aria-labelledby="receipts-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="receipts-title">ประวัติใบเสร็จ</h1>
        </div>
      </div>
      <section className="panel">
        {report?.sales.length ? report.sales.map((sale) => (
          <Link className="inventory-row" key={sale.id} to={`/receipts/${sale.id}`}>
            <div>
              <strong>{sale.receiptNumber}</strong>
              <span>{sale.status === 'void' ? 'ยกเลิกแล้ว' : 'ขายสำเร็จ'}</span>
            </div>
            <strong>{bahtFromSatang(sale.totalSatang)} บาท</strong>
          </Link>
        )) : (
          <p>{message || 'ยังไม่มีบิลล่าสุด'}</p>
        )}
      </section>
    </section>
  )
}
