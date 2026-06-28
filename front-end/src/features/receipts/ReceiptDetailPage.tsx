import { useParams } from 'react-router-dom'

export function ReceiptDetailPage() {
  const { receiptId } = useParams()

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
        <span>{receiptId ?? 'receipt'}</span>
        <strong>ยอดรวม 0.00 บาท</strong>
      </div>
      <button type="button" onClick={() => window.print()}>
        Print receipt
      </button>
    </section>
  )
}
