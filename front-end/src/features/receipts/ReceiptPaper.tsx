import { formatNumber } from '../../lib/format/number'
import { bahtFromSatang } from '../reports/reportApi'
import { displayReceiptNumber } from './receiptNumber'

type ReceiptItem = {
  productId: string
  productName: string
  quantity: number
  unitPriceSatang: number
  totalSatang: number
}

type ReceiptPaperProps = {
  cancelledBy?: string
  cashReceivedSatang?: number
  changeDueSatang?: number
  items: ReceiptItem[]
  receiptNumber: string
  soldAt?: string
  status?: 'completed' | 'void' | 'cancelled'
  storeAddress?: string
  storeLogoUrl?: string
  storeName?: string
  storePhone?: string
  totalSatang: number
}

function receiptDate(value?: string) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ReceiptPaper({
  cancelledBy,
  cashReceivedSatang,
  changeDueSatang = 0,
  items,
  receiptNumber,
  soldAt,
  status = 'completed',
  storeAddress,
  storeLogoUrl,
  storeName = 'POS Grocery',
  storePhone,
  totalSatang,
}: ReceiptPaperProps) {
  const displayCashReceivedSatang = cashReceivedSatang ?? totalSatang + changeDueSatang
  const readableReceiptNumber = displayReceiptNumber(receiptNumber)
  const isCancelled = status === 'void' || status === 'cancelled'

  return (
    <section
      aria-label="ใบเสร็จมาตรฐาน 80 มม."
      className="thermal-receipt"
      data-print-size="80mm"
    >
      <header className="thermal-receipt-header">
        {storeLogoUrl ? (
          <img className="thermal-receipt-logo" src={storeLogoUrl} alt={`Logo ${storeName}`} />
        ) : null}
        <strong>{storeName}</strong>
        <span>ใบเสร็จรับเงิน</span>
        {storeAddress || storePhone ? (
          <div className="thermal-receipt-store-detail">
            {storeAddress ? <span>{storeAddress}</span> : null}
            {storePhone ? <span>โทร {storePhone}</span> : null}
          </div>
        ) : null}
      </header>

      <dl className="thermal-receipt-meta">
        <div>
          <dt>เลขที่</dt>
          <dd>{readableReceiptNumber}</dd>
        </div>
        <div>
          <dt>วันที่</dt>
          <dd>{receiptDate(soldAt)}</dd>
        </div>
        <div>
          <dt>สถานะ</dt>
          <dd>{isCancelled ? 'ยกเลิกแล้ว' : 'ขายสำเร็จ'}</dd>
        </div>
      </dl>

      <div className="thermal-receipt-items" role="table" aria-label="รายการสินค้าในใบเสร็จ">
        <div className="thermal-receipt-items-head" role="row">
          <span role="columnheader">สินค้า</span>
          <span role="columnheader">จำนวน</span>
          <span role="columnheader">รวม</span>
        </div>
        {items.length ? items.map((item) => (
          <div className="thermal-receipt-item" key={item.productId} role="row">
            <span role="cell">{item.productName}</span>
            <span role="cell">{formatNumber(item.quantity)} x {bahtFromSatang(item.unitPriceSatang)}</span>
            <span role="cell">{bahtFromSatang(item.totalSatang)}</span>
          </div>
        )) : (
          <p className="thermal-receipt-empty">ยังไม่มีรายการสินค้า</p>
        )}
      </div>

      <dl className="thermal-receipt-totals">
        <div>
          <dt>ยอดรวม</dt>
          <dd>{bahtFromSatang(totalSatang)}</dd>
        </div>
        <div>
          <dt>รับเงินสด</dt>
          <dd>{bahtFromSatang(displayCashReceivedSatang)}</dd>
        </div>
        <div>
          <dt>เงินทอน</dt>
          <dd>{bahtFromSatang(changeDueSatang)}</dd>
        </div>
      </dl>

      {cancelledBy ? <p className="thermal-receipt-note">ยกเลิกโดย {cancelledBy}</p> : null}
      <footer className="thermal-receipt-footer">ขอบคุณที่ใช้บริการ</footer>
    </section>
  )
}
