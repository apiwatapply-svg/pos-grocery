import { type ChangeEvent, useState } from 'react'
import {
  customerDisplayStorageKey,
  hasSecondScreen,
  readCustomerDisplayPreference,
} from './customerDisplay'

export function CustomerDisplayPage() {
  const [hasCustomerScreen, setHasCustomerScreen] = useState(hasSecondScreen)
  const [customerDisplayEnabled, setCustomerDisplayEnabled] = useState(
    readCustomerDisplayPreference,
  )

  function refreshCustomerDisplayAvailability() {
    const nextHasCustomerScreen = hasSecondScreen()
    setHasCustomerScreen(nextHasCustomerScreen)

    if (!nextHasCustomerScreen) {
      localStorage.removeItem(customerDisplayStorageKey)
      setCustomerDisplayEnabled(false)
    }
  }

  function updateCustomerDisplayPreference(event: ChangeEvent<HTMLInputElement>) {
    if (!hasCustomerScreen) {
      localStorage.removeItem(customerDisplayStorageKey)
      setCustomerDisplayEnabled(false)
      return
    }

    setCustomerDisplayEnabled(event.target.checked)
    localStorage.setItem(customerDisplayStorageKey, String(event.target.checked))
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
          <p>
            {hasCustomerScreen
              ? 'พร้อมแสดงหน้าจอสำหรับลูกค้าเมื่อมีจอที่สอง'
              : 'ใช้ได้เมื่อพบการต่อ 2 จอเท่านั้น'}
          </p>
        </div>
        <div className="customer-display-actions">
          <label className="toggle-field">
            <input
              checked={customerDisplayEnabled}
              disabled={!hasCustomerScreen}
              onChange={updateCustomerDisplayPreference}
              type="checkbox"
            />
            เปิดหน้าจอลูกค้า
          </label>
          <button
            className="warning-button"
            onClick={refreshCustomerDisplayAvailability}
            type="button"
          >
            ตรวจจออีกครั้ง
          </button>
        </div>
      </section>
    </section>
  )
}
