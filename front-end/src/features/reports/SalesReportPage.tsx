import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, dateRangeQuery, todayDateInputValue, type SalesReport } from './reportApi'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

function saleItemCount(sale: SalesReport['sales'][number]) {
  return sale.itemCount ?? sale.items.reduce((sum, item) => sum + item.quantity, 0)
}

function saleCostSatang(sale: SalesReport['sales'][number]) {
  return sale.totalCostSatang ?? sale.items.reduce((sum, item) => {
    const itemCost = item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity
    return sum + itemCost
  }, 0)
}

function saleProfitSatang(sale: SalesReport['sales'][number]) {
  return sale.profitSatang ?? sale.totalSatang - saleCostSatang(sale)
}

function saleProfitMarginPercent(sale: SalesReport['sales'][number]) {
  if (typeof sale.profitMarginPercent === 'number') {
    return sale.profitMarginPercent.toFixed(2)
  }

  return sale.totalSatang > 0 ? ((saleProfitSatang(sale) / sale.totalSatang) * 100).toFixed(2) : '0.00'
}

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
          <div>
            <dt>ต้นทุน</dt>
            <dd>{bahtFromSatang(report?.summary.totalCostSatang ?? 0)} บาท</dd>
          </div>
          <div>
            <dt>กำไร</dt>
            <dd>{bahtFromSatang(report?.summary.profitSatang ?? 0)} บาท</dd>
          </div>
          <div>
            <dt>กำไร%</dt>
            <dd>{(report?.summary.profitMarginPercent ?? 0).toFixed(2)}%</dd>
          </div>
        </dl>
        {report?.sales.length ? (
          <div className="table-wrap sales-report-table-wrap">
            <table className="sales-report-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>เลขที่บิล</th>
                  <th>รายการสินค้า</th>
                  <th>จำนวนบิล</th>
                  <th>ยอดขาย</th>
                  <th>จำนวนชิ้น</th>
                  <th>ต้นทุน</th>
                  <th>กำไร</th>
                  <th>กำไร%</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {report.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.billNumber ?? '-'}</td>
                    <td>{sale.receiptNumber}</td>
                    <td>
                      {sale.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}
                    </td>
                    <td>{sale.orderCount ?? (sale.status === 'completed' ? 1 : 0)}</td>
                    <td>{bahtFromSatang(sale.status === 'completed' ? sale.totalSatang : 0)} บาท</td>
                    <td>{saleItemCount(sale)}</td>
                    <td>{bahtFromSatang(saleCostSatang(sale))} บาท</td>
                    <td>{bahtFromSatang(saleProfitSatang(sale))} บาท</td>
                    <td>{saleProfitMarginPercent(sale)}%</td>
                    <td>{sale.status === 'completed' ? 'ขายสำเร็จ' : 'ยกเลิกบิล'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
        )}
      </div>
    </section>
  )
}
