import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet } from '../../lib/api/client'
import { type ApiSale } from '../reports/reportApi'
import { ReceiptPaper } from './ReceiptPaper'

type CurrentStore = {
  name: string
  address?: string
  logoUrl?: string
  phone?: string
}

export function ReceiptDetailPage() {
  const { receiptId } = useParams()
  const [sale, setSale] = useState<ApiSale | null>(null)
  const [currentStore, setCurrentStore] = useState<CurrentStore>({ name: 'POS Grocery' })
  const [message, setMessage] = useState('กำลังโหลดใบเสร็จ')

  useEffect(() => {
    let active = true

    apiGet<CurrentStore>('/store/current?includeLogo=true')
      .then((store) => {
        if (active) {
          setCurrentStore({
            address: store.address,
            name: store.name || 'POS Grocery',
            logoUrl: store.logoUrl,
            phone: store.phone,
          })
        }
      })
      .catch(() => {
        if (active) {
          setCurrentStore({ name: 'POS Grocery' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    apiGet<ApiSale>(`/sales/${receiptId ?? ''}`)
      .then((nextSale) => {
        if (active) {
          setSale(nextSale)
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
  }, [receiptId])

  return (
    <section className="route-page" aria-labelledby="receipt-detail-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="receipt-detail-title">รายละเอียดใบเสร็จ</h1>
        </div>
      </div>
      {sale ? (
        <ReceiptPaper
          cashReceivedSatang={sale.cashReceivedSatang}
          changeDueSatang={sale.changeDueSatang}
          items={sale.items}
          receiptNumber={sale.receiptNumber}
          soldAt={sale.soldAt}
          status={sale.status}
          storeAddress={currentStore.address}
          storeLogoUrl={currentStore.logoUrl}
          storeName={currentStore.name}
          storePhone={currentStore.phone}
          totalSatang={sale.totalSatang}
        />
      ) : (
        <section className="thermal-receipt" aria-label="ใบเสร็จมาตรฐาน 80 มม." data-print-size="80mm">
          <p>{message || 'ไม่พบใบเสร็จ'}</p>
        </section>
      )}
      <button className="info-button compact no-print" type="button" onClick={() => window.print()}>
        พิมพ์ใบเสร็จ
      </button>
    </section>
  )
}
