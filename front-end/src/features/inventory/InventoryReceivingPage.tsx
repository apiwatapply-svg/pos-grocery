import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  SearchableDropdown,
  type SearchableDropdownHandle,
  type SearchableDropdownOption,
} from '../../components/ui/SearchableDropdown'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatBaht, formatNumber } from '../../lib/format/number'
import { confirmDeleteAction } from '../../lib/ui/confirm'

type Product = {
  id: string
  name: string
  barcode: string
  unit?: string
  costPriceSatang: number
  stockQuantity: number
}

type ReceivingLine = {
  product: Product
  quantity: string
  unitCost: string
}

const RECEIVING_QUEUE_STORAGE_KEY = 'pos-grocery:receiving-queue'

// Barcode scanners type a full barcode in a tight, even burst. Real
// wireless scanners can introduce one outlier interval because their HID
// buffer flushes in chunks (e.g. 4 chars + 200ms pause + 4 chars + Enter).
// Manual typing is much slower (200-500ms per character) and irregular, with
// pauses to look at the screen, so it produces two or more outlier
// intervals. We treat the trailing Enter as a scanner terminator when:
//   - at least 3 characters were typed
//   - the median of the inter-character intervals (with the trailing
//     char-to-Enter gap appended) represents a consistent scanner cadence,
//     AND the number of intervals that deviate from that median by more
//     than OUTLIER_THRESHOLD_MS (100ms) is at most MAX_OUTLIER_COUNT (1).
//     This tolerates a single flush-pause inside a wireless scanner burst
//     while still rejecting human typing, which has 2+ outliers.
const OUTLIER_THRESHOLD_MS = 100
const MAX_OUTLIER_COUNT = 1
const MIN_SCAN_CHAR_COUNT = 3
const MAX_SCAN_TIMESTAMP_BUFFER = 15

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function countOutliers(intervals: number[], threshold: number, median: number): number {
  let count = 0
  for (const interval of intervals) {
    if (Math.abs(interval - median) > threshold) {
      count += 1
    }
  }
  return count
}

function isScannerBurst(timestamps: number[], now: number): boolean {
  if (timestamps.length < MIN_SCAN_CHAR_COUNT) {
    return false
  }
  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) {
    intervals.push(timestamps[i] - timestamps[i - 1])
  }
  // Include the trailing char-to-Enter gap so a delayed Enter (manual typing
  // pattern) shows up as an outlier alongside the other intervals.
  intervals.push(now - timestamps[timestamps.length - 1])
  const median = medianOf(intervals)
  return countOutliers(intervals, OUTLIER_THRESHOLD_MS, median) <= MAX_OUTLIER_COUNT
}

type ReceivingHistory = {
  id: string
  productName: string
  barcode: string
  type: 'receive' | 'count' | 'sale' | 'void'
  quantityChange: number
  balanceAfterChange: number
  createdAt: string
}

function bahtFromSatang(value: number) {
  return formatBaht(value / 100)
}

function satangFromBaht(value: string) {
  return Math.round(Number(value || 0) * 100)
}

function lineTotal(line: ReceivingLine) {
  return Number(line.quantity || 0) * Number(line.unitCost || 0)
}

function matchesProduct(product: Product, value: string) {
  const normalizedValue = value.trim().toLowerCase()

  return [product.barcode, product.name, `${product.name} - ${product.barcode}`].some(
    (field) => field.toLowerCase() === normalizedValue,
  )
}

function historyDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).format(date).replace(',', '')
}

function previousStock(history: ReceivingHistory) {
  return history.balanceAfterChange - history.quantityChange
}

function loadPersistedQueue(): ReceivingLine[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(RECEIVING_QUEUE_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const restored: ReceivingLine[] = []
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        'product' in entry &&
        'quantity' in entry &&
        'unitCost' in entry
      ) {
        const product = (entry as ReceivingLine).product
        if (product && typeof product.id === 'string') {
          restored.push({
            product,
            quantity: String((entry as ReceivingLine).quantity ?? ''),
            unitCost: String((entry as ReceivingLine).unitCost ?? ''),
          })
        }
      }
    }
    return restored
  } catch {
    return []
  }
}

export function InventoryReceivingPage() {
  const scanInputRef = useRef<SearchableDropdownHandle>(null)
  // Tracks the trailing Enter that barcode scanners append to a scan so we
  // can swallow it without re-running addScannedProduct (which would add
  // the same product twice to the receiving queue).
  const isConsumingScanEnterRef = useRef(false)
  // Sliding window of timestamps for the most recent onChange calls on the
  // scan field. Used together with isScannerBurst to tell a scanner's
  // trailing Enter apart from a user pressing Enter after manually typing
  // a barcode.
  const scanCharTimestampsRef = useRef<number[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<ReceivingHistory[]>([])
  const [scanValue, setScanValue] = useState('')
  const [lines, setLines] = useState<ReceivingLine[]>(() => loadPersistedQueue())
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  async function loadProducts() {
    const apiProducts = await apiGet<Product[]>('/products?view=inventory')
    setProducts(apiProducts)
    setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
  }

  async function loadReceivingHistory() {
    const transactions = await apiGet<ReceivingHistory[]>('/inventory/transactions?limit=100')
    setHistory(transactions.filter((transaction) => transaction.type === 'receive').slice(0, 100))
  }

  useEffect(() => {
    let active = true

    async function loadInitialReceivingData() {
      try {
        const apiProducts = await apiGet<Product[]>('/products?view=inventory')
        if (active) {
          setProducts(apiProducts)
          setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
        }

        const transactions = await apiGet<ReceivingHistory[]>('/inventory/transactions?limit=100')
        if (active) {
          setHistory(transactions.filter((transaction) => transaction.type === 'receive').slice(0, 100))
        }
      } catch (error: unknown) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
        }
      }
    }

    void loadInitialReceivingData()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (lines.length === 0) {
      window.localStorage.removeItem(RECEIVING_QUEUE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(RECEIVING_QUEUE_STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const totalValue = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const scanOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
        description: `${product.barcode} · คงเหลือ ${formatNumber(product.stockQuantity)} ชิ้น`,
        trailing: <span>{bahtFromSatang(product.costPriceSatang)} บาท</span>,
      })),
    [products],
  )

  const isReceivingExactMatch = (option: SearchableDropdownOption, query: string) => {
    const product = products.find((current) => current.id === option.value)
    if (!product) {
      return false
    }
    return matchesProduct(product, query)
  }

  function addScannedProduct(value: string) {
    const normalizedValue = value.trim()

    if (!normalizedValue) {
      return
    }

    const product = products.find((currentProduct) => matchesProduct(currentProduct, normalizedValue))

    if (!product) {
      setMessage('ไม่พบสินค้าในฐานข้อมูล ตรวจสอบ barcode หรือชื่อสินค้าอีกครั้ง')
      setScanValue('')
      scanInputRef.current?.focus()
      return
    }

    setLines((current) => {
      const existingLine = current.find((line) => line.product.id === product.id)

      if (existingLine) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: String(Number(line.quantity || 0) + 1) }
            : line,
        )
      }

      return [
        ...current,
        {
          product,
          quantity: '1',
          unitCost: bahtFromSatang(product.costPriceSatang),
        },
      ]
    })
    setMessage('')
    setScanValue('')
    scanInputRef.current?.focus()
  }

  function handleScanChange(value: string) {
    setScanValue(value)
    const timestamps = scanCharTimestampsRef.current
    timestamps.push(Date.now())
    if (timestamps.length > MAX_SCAN_TIMESTAMP_BUFFER) {
      timestamps.splice(0, timestamps.length - MAX_SCAN_TIMESTAMP_BUFFER)
    }

    if (products.some((product) => matchesProduct(product, value))) {
      // The trailing Enter from a barcode scanner will arrive next. Mark it
      // so the keydown handler can ignore it instead of adding the same
      // product twice to the receiving queue.
      isConsumingScanEnterRef.current = true
      addScannedProduct(value)
    }
  }

  function handleScanSelect(option: SearchableDropdownOption) {
    const product = products.find((current) => current.id === option.value)
    if (!product) {
      return
    }
    addScannedProduct(`${product.name} - ${product.barcode}`)
  }

  function handleScanEnter() {
    if (scanValue.trim() && products.some((product) => matchesProduct(product, scanValue))) {
      addScannedProduct(scanValue)
    } else {
      scanInputRef.current?.focus()
    }
  }

  function updateLine(productId: string, field: 'quantity' | 'unitCost', value: string) {
    setLines((current) =>
      current.map((line) => {
        if (line.product.id !== productId) {
          return line
        }

        if (field === 'quantity') {
          return { ...line, quantity: value }
        }

        return { ...line, unitCost: value }
      }),
    )
  }

  async function removeLine(productId: string) {
    const line = lines.find((entry) => entry.product.id === productId)
    const { isConfirmed } = await confirmDeleteAction({
      title: 'เอารายการออกจากคิวรับของ?',
      text: line
        ? `${line.product.name} (${formatNumber(Number(line.quantity || 0))} ${line.product.unit}) จะถูกเอาออกจากคิวรับของ`
        : 'รายการนี้จะถูกเอาออกจากคิวรับของ',
    })
    if (!isConfirmed) {
      return
    }
    setLines((current) => current.filter((entry) => entry.product.id !== productId))
    scanInputRef.current?.focus()
  }

  async function saveReceivingQueue() {
    if (lines.length === 0) {
      setMessage('สแกนสินค้าเข้าคิวก่อนบันทึกรับของ')
      scanInputRef.current?.focus()
      return
    }

    const invalidLine = lines.find((line) => Number(line.quantity || 0) < 1)
    if (invalidLine) {
      await Swal.fire({
        title: 'จำนวนรับเข้าไม่ถูกต้อง',
        text: `กรุณาระบุจำนวนรับเข้าของ "${invalidLine.product.name}" อย่างน้อย 1 ${invalidLine.product.unit ?? 'ชิ้น'}`,
        icon: 'warning',
        confirmButtonText: 'รับทราบ',
      })
      scanInputRef.current?.focus()
      return
    }

    const confirmation = await Swal.fire({
      title: 'ยืนยันบันทึกรับของเข้า',
      text: `ต้องการบันทึกรับของ ${formatNumber(lines.length)} รายการ รวม ${formatNumber(totalQuantity)} ชิ้น มูลค่า ${formatBaht(totalValue)} บาท ใช่หรือไม่`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันบันทึก',
      cancelButtonText: 'กลับไปแก้ไข',
    })

    if (!confirmation.isConfirmed) {
      scanInputRef.current?.focus()
      return
    }

    try {
      await Promise.all(
        lines.map((line) =>
          apiPost('/inventory/receive', {
            productId: line.product.id,
            quantity: Number(line.quantity || 0),
            unitCostSatang: satangFromBaht(line.unitCost),
          }),
        ),
      )
      setLines([])
      setMessage('บันทึกรับของแล้ว')
      await loadProducts()
      await loadReceivingHistory()
      scanInputRef.current?.focus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกรับของไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page receiving-page" aria-labelledby="receiving-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="receiving-title">รับของเข้า</h1>
        </div>
      </div>

      <div className="receiving-workspace receiving-workspace-full" aria-label="พื้นที่รับของเข้าแบบเต็มหน้า" role="region">
        <section className="panel receiving-scan-panel" aria-label="สแกนรับของเข้า">
          <label className="field receiving-scan-field" htmlFor="receiving-scan">
            <span>สแกนหรือค้นหาสินค้า</span>
            <SearchableDropdown
              ref={scanInputRef}
              ariaLabel="สแกนหรือค้นหาสินค้า"
              emptyMessage="ไม่พบสินค้าที่ค้นหา"
              hint="สแกนหรือเลือกสินค้าจากช่องค้นหาแล้วระบบจะเพิ่มเข้าคิวทันที"
              id="receiving-scan"
              isExactMatch={isReceivingExactMatch}
              options={scanOptions}
              placeholder="สแกน barcode หรือพิมพ์ชื่อสินค้า"
              value={scanValue}
              onChange={handleScanChange}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return
                }
                event.preventDefault()
                if (isConsumingScanEnterRef.current) {
                  // The exact match was just added to the queue. Decide
                  // whether this Enter is the scanner's trailing key or a
                  // user pressing Enter after typing the barcode by hand
                  // by looking at the consistency of the recent keystrokes.
                  isConsumingScanEnterRef.current = false
                  const isScanner = isScannerBurst(
                    scanCharTimestampsRef.current,
                    Date.now(),
                  )
                  // Clear the burst window so the next typing starts fresh.
                  scanCharTimestampsRef.current = []
                  if (isScanner) {
                    // Scanner: swallow the Enter and keep focus on the
                    // scan field so the receiver can keep scanning.
                    event.stopPropagation()
                  }
                  return
                }
                handleScanEnter()
              }}
              onSelect={(option) => handleScanSelect(option)}
            />
            <small>สแกนหรือเลือกสินค้าจากช่องค้นหาแล้วระบบจะเพิ่มเข้าคิวทันที</small>
          </label>
        </section>

        <section className="panel receiving-summary-panel" aria-label="สรุปการรับของ">
          <div className="receiving-stat receiving-stat-blue">
            <span>จำนวนรายการ</span>
            <strong>{formatNumber(lines.length)}</strong>
          </div>
          <div className="receiving-stat receiving-stat-green">
            <span>จำนวนรวม</span>
            <strong>{formatNumber(totalQuantity)}</strong>
          </div>
          <div className="receiving-stat receiving-stat-orange">
            <span>มูลค่ารับเข้า</span>
            <strong>{formatBaht(totalValue)} บาท</strong>
          </div>
        </section>

        <div className="receiving-main-layout">
          <section
            aria-label="ตารางคิวรับของเข้าแบบเต็มหน้า"
            className="panel receiving-queue-panel receiving-queue-panel-full receiving-queue-panel-compact"
          >
            <div className="receiving-queue-header">
              <div>
                <h2 id="receiving-queue-title">คิวรับของเข้า</h2>
                <p>รวม {formatNumber(totalQuantity)} ชิ้น</p>
                <p>มูลค่ารับเข้า {formatBaht(totalValue)} บาท</p>
              </div>
              <button
                className="success-button"
                disabled={lines.length === 0}
                onClick={() => void saveReceivingQueue()}
                type="button"
              >
                บันทึกรับของ {formatNumber(lines.length)} รายการ
              </button>
            </div>

            <div aria-label="ตารางรับของเข้าแบบเต็มหน้า" className="receiving-table-wrap receiving-table-wrap-full">
              <table className="receiving-table">
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>สินค้า</th>
                    <th>คงเหลือเดิม</th>
                    <th>จำนวน</th>
                    <th>หลังรับเข้า</th>
                    <th>ต้นทุน/หน่วย</th>
                    <th>รวม</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length > 0 ? (
                    lines.map((line, index) => (
                      <tr key={line.product.id}>
                        <td>{formatNumber(index + 1)}</td>
                        <td><strong>{line.product.name}</strong></td>
                        <td>{formatNumber(line.product.stockQuantity)}</td>
                        <td>
                          <input
                            aria-label={`จำนวนรับเข้า ${line.product.name}`}
                            className="receiving-quantity-input"
                            min="0"
                            type="number"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.product.id, 'quantity', event.target.value)}
                          />
                        </td>
                        <td>{formatNumber(line.product.stockQuantity + Number(line.quantity || 0))}</td>
                        <td>
                          <input
                            aria-label={`ต้นทุนต่อหน่วย ${line.product.name}`}
                            className="receiving-cost-input"
                            min="0"
                            step="0.01"
                            type="number"
                            value={line.unitCost}
                            onChange={(event) => updateLine(line.product.id, 'unitCost', event.target.value)}
                          />
                        </td>
                        <td>{formatBaht(lineTotal(line))}</td>
                        <td>
                          <button
                            className="danger-button compact"
                            onClick={() => removeLine(line.product.id)}
                            type="button"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>ยังไม่มีสินค้าในคิวรับของ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="summary">{message}</p>
          </section>

          <section className="panel receiving-history-panel" aria-labelledby="receiving-history-title">
            <div className="receiving-history-header">
              <div>
                <h2 id="receiving-history-title">ประวัติรับของเข้า</h2>
                <p>100 รายการล่าสุด</p>
              </div>
              <strong>{formatNumber(history.length)} รายการ</strong>
            </div>
            <div className="receiving-history-scroll" role="region" aria-label="ประวัติรับของเข้าล่าสุด">
              <table aria-label="ประวัติรับของเข้า 100 รายการล่าสุด" className="receiving-history-table">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>ก่อนหน้า</th>
                    <th>เพิ่ม</th>
                    <th>หลังเพิ่ม</th>
                    <th>เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? history.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <strong>{transaction.productName}</strong>
                        <span>{transaction.barcode}</span>
                      </td>
                      <td>{formatNumber(previousStock(transaction))}</td>
                      <td>+{formatNumber(transaction.quantityChange)}</td>
                      <td>{formatNumber(transaction.balanceAfterChange)}</td>
                      <td>{historyDateTime(transaction.createdAt)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5}>ยังไม่มีประวัติรับของเข้า</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
