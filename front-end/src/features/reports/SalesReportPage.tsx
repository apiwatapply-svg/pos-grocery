import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, dateRangeQuery, todayDateInputValue, type SalesReport } from './reportApi'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

export function SalesReportPage() {
  const today = todayDateInputValue()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลดรายงาน')
  const query = dateRangeQuery(from, to)

  useEffect(() => {
    let active = true

    apiGet<SalesReport>(`/reports/sales${query}`)
      .then((nextReport) => {
        if (active) {
          setReport(nextReport)
          setMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดรายงานไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [query])

  return (
    <section className="route-page" aria-labelledby="sales-report-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="sales-report-title">รายงานยอดขาย</h1>
        </div>
        <a className="export-link" href={`${apiBaseUrl}/reports/export.xlsx${query}`}>
          Export report Excel
        </a>
      </div>
      <div className="panel">
        <div className="date-row">
          <input aria-label="วันที่เริ่ม" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input aria-label="วันที่สิ้นสุด" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <dl className="summary-list">
          <div>
            <dt>จำนวนบิล</dt>
            <dd>{report?.summary.orderCount ?? 0}</dd>
          </div>
          <div>
            <dt>ยอดขาย</dt>
            <dd>{bahtFromSatang(report?.summary.totalSalesSatang ?? 0)} บาท</dd>
          </div>
          <div>
            <dt>จำนวนชิ้น</dt>
            <dd>{report?.summary.itemsSold ?? 0}</dd>
          </div>
        </dl>
        {report?.sales.length ? (
          <div className="inventory-list">
            {report.sales.map((sale) => (
              <div className="inventory-row" key={sale.id}>
                <div>
                  <strong>{sale.receiptNumber}</strong>
                  <span>{sale.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}</span>
                </div>
                <strong>{bahtFromSatang(sale.totalSatang)} บาท</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
        )}
      </div>
    </section>
  )
}
