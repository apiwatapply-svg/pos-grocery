import { useEffect, useRef, useState } from 'react'
import {
  baht,
  buildCustomerDisplayHtml,
  customerDisplayPayloadEvent,
  customerDisplayPayloadStorageKey,
  readCustomerDisplayPayload,
  customerDisplayStorageKey,
  hasSecondScreen,
  readCustomerDisplayPreference,
} from './customerDisplay'

export function CustomerDisplayPage() {
  const customerDisplayWindowRef = useRef<Window | null>(null)
  const [hasCustomerScreen, setHasCustomerScreen] = useState(hasSecondScreen)
  const [customerDisplayEnabled, setCustomerDisplayEnabled] = useState(
    readCustomerDisplayPreference,
  )
  const [displayPayload, setDisplayPayload] = useState(readCustomerDisplayPayload)

  useEffect(() => {
    function refreshDisplayPayload(event?: Event) {
      if (event instanceof StorageEvent && event.key !== customerDisplayPayloadStorageKey) {
        return
      }
      setDisplayPayload(readCustomerDisplayPayload())
    }

    window.addEventListener('storage', refreshDisplayPayload)
    window.addEventListener(customerDisplayPayloadEvent, refreshDisplayPayload)

    return () => {
      window.removeEventListener('storage', refreshDisplayPayload)
      window.removeEventListener(customerDisplayPayloadEvent, refreshDisplayPayload)
    }
  }, [])

  useEffect(() => {
    if (!customerDisplayEnabled || !customerDisplayWindowRef.current) {
      return
    }

    if (customerDisplayWindowRef.current.closed) {
      customerDisplayWindowRef.current = null
      return
    }

    customerDisplayWindowRef.current.document.open()
    customerDisplayWindowRef.current.document.write(
      buildCustomerDisplayHtml({
        store: displayPayload.store,
        cart: displayPayload.cart,
        cartTotal: displayPayload.cartTotal,
        cashReceived: displayPayload.cashReceived,
        changeDue: displayPayload.changeDue,
        lastSale: displayPayload.lastSale,
      }),
    )
    customerDisplayWindowRef.current.document.close()
  }, [customerDisplayEnabled, displayPayload])

  useEffect(() => {
    if (customerDisplayEnabled || !customerDisplayWindowRef.current) {
      return
    }

    if (!customerDisplayWindowRef.current.closed) {
      customerDisplayWindowRef.current.close()
    }
    customerDisplayWindowRef.current = null
  }, [customerDisplayEnabled])

  function refreshCustomerDisplayAvailability() {
    const nextHasCustomerScreen = hasSecondScreen()
    setHasCustomerScreen(nextHasCustomerScreen)

    if (!nextHasCustomerScreen) {
      localStorage.removeItem(customerDisplayStorageKey)
      setCustomerDisplayEnabled(false)
    }
  }

  function openCustomerDisplayWindow() {
    if (!hasCustomerScreen) {
      return
    }

    if (!customerDisplayEnabled) {
      setCustomerDisplayEnabled(true)
      localStorage.setItem(customerDisplayStorageKey, 'true')
    }

    const displayWindow = window.open(
      '',
      'pos-grocery-customer-display',
      'popup,width=900,height=700',
    )

    if (!displayWindow) {
      return
    }

    customerDisplayWindowRef.current = displayWindow
    displayWindow.document.open()
    displayWindow.document.write(
      buildCustomerDisplayHtml({
        store: displayPayload.store,
        cart: displayPayload.cart,
        cartTotal: displayPayload.cartTotal,
        cashReceived: displayPayload.cashReceived,
        changeDue: displayPayload.changeDue,
        lastSale: displayPayload.lastSale,
      }),
    )
    displayWindow.document.close()
  }

  return (
    <section className="route-page" aria-labelledby="customer-display-page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="customer-display-page-title">จอลูกค้า</h1>
        </div>
      </div>
      <section className="customer-display-control" aria-labelledby="customer-display-control-title">
        <div>
          <h2 id="customer-display-control-title">หน้าจอลูกค้า</h2>
          <p>{hasCustomerScreen ? 'สถานะจอ: พบจอที่สอง' : 'สถานะจอ: ยังไม่พบจอที่สอง'}</p>
          <p>
            {hasCustomerScreen
              ? 'พร้อมแสดงหน้าจอสำหรับลูกค้าเมื่อมีจอที่สอง'
              : 'ใช้ได้เมื่อพบการต่อ 2 จอเท่านั้น'}
          </p>
        </div>
        <div className="customer-display-actions">
          <button
            className="warning-button"
            onClick={refreshCustomerDisplayAvailability}
            type="button"
          >
            ตรวจสอบจอ
          </button>
          <button
            className="info-button"
            disabled={!hasCustomerScreen}
            onClick={openCustomerDisplayWindow}
            type="button"
          >
            เปิดหน้าต่างจอลูกค้า
          </button>
        </div>
      </section>
      {customerDisplayEnabled ? (
        <section className="customer-display-screen" aria-labelledby="customer-display-title">
          <div>
            <p>POS Grocery</p>
            <h2 id="customer-display-title">จอลูกค้า</h2>
          </div>
          <div className="customer-cart">
            {displayPayload.cart.length > 0 ? (
              <table className="customer-cart-table" aria-label="รายการสินค้าสำหรับลูกค้า">
                <thead>
                  <tr>
                    <th scope="col">ลำดับ</th>
                    <th scope="col">สินค้า</th>
                    <th scope="col">ราคา</th>
                    <th scope="col">จำนวน</th>
                    <th scope="col">ราคารวม</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPayload.cart.map((item, index) => (
                    <tr key={item.productName}>
                      <td>{index + 1}</td>
                      <td>{item.productName}</td>
                      <td>{baht(item.unitPrice)} บาท</td>
                      <td>{item.quantity}</td>
                      <td>{baht(item.quantity * item.unitPrice)} บาท</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>รอรายการสินค้า</p>
            )}
          </div>
          <div className="customer-payment-summary">
            <strong className="customer-total">
              ยอดที่ต้องชำระ {baht(displayPayload.cartTotal)} บาท
            </strong>
            <span>รับเงิน {baht(displayPayload.cashReceived)} บาท</span>
            <span>เงินทอน {baht(Math.max(displayPayload.changeDue, 0))} บาท</span>
          </div>
          {displayPayload.lastSale ? (
            <span>บิลล่าสุด {displayPayload.lastSale.receiptNumber}</span>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
