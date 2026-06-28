import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet } from '../../lib/api/client'
import { bahtFromSatang, type SalesReport } from '../reports/reportApi'

export function ReceiptDetailPage() {
  const { receiptId } = useParams()
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

  const sale = report?.sales.find((candidate) => candidate.id === receiptId || candidate.receiptNumber === receiptId)

  return (
    <section className="route-page" aria-labelledby="receipt-detail-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="receipt-detail-title">รายละเอียดใบเสร็จ</h1>
        </div>
      </div>
      <div className="receipt-paper">
        <strong>POS Grocery</strong>
        <span>{sale?.receiptNumber ?? receiptId ?? 'receipt'}</span>
        {sale ? sale.items.map((item) => (
          <span key={`${sale.id}-${item.productId}`}>
            {item.productName} x{item.quantity} = {bahtFromSatang(item.totalSatang)} บาท
          </span>
        )) : (
          <span>{message || 'ไม่พบใบเสร็จ'}</span>
        )}
        <strong>ยอดรวม {bahtFromSatang(sale?.totalSatang ?? 0)} บาท</strong>
      </div>
      <button className="info-button compact" type="button" onClick={() => window.print()}>
        Print receipt
      </button>
    </section>
  )
}
