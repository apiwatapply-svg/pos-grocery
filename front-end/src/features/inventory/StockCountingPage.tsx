import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  SearchableDropdown,
  type SearchableDropdownHandle,
  type SearchableDropdownOption,
} from '../../components/ui/SearchableDropdown'
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '../../components/ui/Tabs'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'
import { confirmDeleteAction } from '../../lib/ui/confirm'

type Product = {
  id: string
  name: string
  barcode: string
  unit?: string
  stockQuantity: number
}

type CountingLine = {
  product: Product
  countedQuantity: number
}

type StockAdjustmentHistory = {
  id: string
  productId: string
  productName: string
  barcode: string
  type: 'receive' | 'count' | 'sale' | 'void'
  quantityChange: number
  balanceAfterChange: number
  createdAt: string
  createdBy?: string
}

type StockAdjustmentHistoryPage = {
  items: StockAdjustmentHistory[]
  total: number
  page: number
  pageSize: number
}

const STOCK_ADJUSTMENT_HISTORY_PAGE_SIZE = 20

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

function matchesProduct(product: Product, value: string) {
  const normalizedValue = value.trim().toLowerCase()

  const candidateValues = [
    product.barcode,
    product.name,
    `${product.name} - ${product.barcode}`,
  ]

  return candidateValues.some((field) => field.toLowerCase() === normalizedValue)
}

function formatHistoryDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  })

  return formatter.format(date).replace(',', '')
}

function stockTransactionTypeLabel(type: StockAdjustmentHistory['type']) {
  if (type === 'receive') {
    return 'รับของเข้า'
  }

  if (type === 'sale') {
    return 'ขายสินค้า'
  }

  if (type === 'void') {
    return 'ยกเลิกบิล'
  }

  return 'ตรวจนับ'
}

function signedQuantity(value: number) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

export function StockCountingPage() {
  const scanInputRef = useRef<SearchableDropdownHandle>(null)
  // Tracks the trailing Enter that barcode scanners append to a scan so we
  // can swallow it without re-running addScannedProduct (which would add
  // the same product twice to the counting queue).
  const isConsumingScanEnterRef = useRef(false)
  // Sliding window of timestamps for the most recent onChange calls on the
  // scan field. Used together with isScannerBurst to tell a scanner's
  // trailing Enter apart from a user pressing Enter after manually typing
  // a barcode.
  const scanCharTimestampsRef = useRef<number[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<StockAdjustmentHistory[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize] = useState(STOCK_ADJUSTMENT_HISTORY_PAGE_SIZE)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scanValue, setScanValue] = useState('')
  const [lines, setLines] = useState<CountingLine[]>([])
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  async function loadProducts() {
    const apiProducts = await apiGet<Product[]>('/products?view=inventory')
    setProducts(apiProducts)
    setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
  }

  async function loadHistory(page: number) {
    setHistoryLoading(true)
    try {
      const response = await apiGet<StockAdjustmentHistoryPage>(
        `/inventory/transactions?page=${page}&pageSize=${historyPageSize}`,
      )
      setHistory(response.items)
      setHistoryTotal(response.total)
      setHistoryPage(page)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialCountingData() {
      try {
        const apiProducts = await apiGet<Product[]>('/products?view=inventory')
        if (active) {
          setProducts(apiProducts)
          setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
        }

        const response = await apiGet<StockAdjustmentHistoryPage>(
          `/inventory/transactions?page=1&pageSize=${historyPageSize}`,
        )
        if (active) {
          setHistory(response.items)
          setHistoryTotal(response.total)
          setHistoryPage(1)
        }
      } catch (error: unknown) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดข้อมูลตรวจนับไม่สำเร็จ')
        }
      }
    }

    void loadInitialCountingData()

    return () => {
      active = false
    }
  }, [historyPageSize])

  const totalLines = lines.length
  const totalCounted = lines.reduce((sum, line) => sum + line.countedQuantity, 0)
  const totalDifference = lines.reduce(
    (sum, line) => sum + line.countedQuantity - line.product.stockQuantity,
    0,
  )
  const scanOptions = useMemo<SearchableDropdownOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
        description: `${product.barcode} · คงเหลือ ${formatNumber(product.stockQuantity)} ชิ้น`,
      })),
    [products],
  )

  const isCountingExactMatch = (option: SearchableDropdownOption, query: string) => {
    const product = products.find((current) => current.id === option.value)
    if (!product) {
      return false
    }
    return matchesProduct(product, query)
  }

  function addScannedProduct(value: string) {
    const normalizedValue = value.trim()

    if (!normalizedValue) {
      scanInputRef.current?.focus()
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
            ? { ...line, countedQuantity: line.countedQuantity + 1 }
            : line,
        )
      }

      return [...current, { product, countedQuantity: product.stockQuantity }]
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
      // product twice to the counting queue.
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
    // Mirror the scanner flow: if the typed value matches a product exactly,
    // add it to the queue. Otherwise re-focus the field.
    if (scanValue.trim() && products.some((product) => matchesProduct(product, scanValue))) {
      addScannedProduct(scanValue)
    } else {
      scanInputRef.current?.focus()
    }
  }

  function updateLine(productId: string, value: string) {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId
          ? { ...line, countedQuantity: Math.max(0, Number(value || 0)) }
          : line,
      ),
    )
  }

  async function removeLine(productId: string) {
    const line = lines.find((entry) => entry.product.id === productId)
    const { isConfirmed } = await confirmDeleteAction({
      title: 'เอารายการออกจากคิวตรวจนับ?',
      text: line
        ? `${line.product.name} จะถูกเอาออกจากคิวตรวจนับ (จำนวนที่นับได้: ${formatNumber(line.countedQuantity)})`
        : 'รายการนี้จะถูกเอาออกจากคิวตรวจนับ',
    })
    if (!isConfirmed) {
      return
    }
    setLines((current) => current.filter((entry) => entry.product.id !== productId))
    scanInputRef.current?.focus()
  }

  async function saveCountingQueue() {
    if (lines.length === 0) {
      setMessage('สแกนสินค้าเข้าคิวก่อนบันทึกตรวจนับ')
      scanInputRef.current?.focus()
      return
    }

    const result = await Swal.fire({
      title: 'ยืนยันบันทึกตรวจนับ stock',
      text: `ต้องการปรับยอด ${formatNumber(lines.length)} รายการใช่ไหม`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันบันทึก',
      cancelButtonText: 'กลับไปแก้ไข',
    })

    if (!result.isConfirmed) {
      scanInputRef.current?.focus()
      return
    }

    try {
      void Swal.fire({
        title: 'กำลังบันทึกข้อมูล',
        text: 'ระบบกำลังปรับยอด stock ไปยังฐานข้อมูล',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        },
      })
      await Promise.all(
        lines.map((line) =>
          apiPost('/inventory/count', {
            productId: line.product.id,
            countedQuantity: line.countedQuantity,
          }),
        ),
      )
      await loadProducts()
      // After a successful count, jump the user back to page 1 so the
      // new adjustments are at the top of the freshly fetched list.
      await loadHistory(1)
      setLines([])
      setMessage('บันทึกตรวจนับ stock แล้ว')
      await Swal.fire({
        title: 'บันทึกเรียบร้อย',
        text: 'ปรับยอด stock ในฐานข้อมูลแล้ว',
        icon: 'success',
        timer: 900,
        showConfirmButton: false,
      })
      scanInputRef.current?.focus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกตรวจนับไม่สำเร็จ')
      await Swal.fire({
        title: 'บันทึกไม่สำเร็จ',
        text: error instanceof Error ? error.message : 'บันทึกตรวจนับไม่สำเร็จ',
        icon: 'error',
      })
    }
  }

  return (
    <section className="route-page" aria-labelledby="stock-counting-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="stock-counting-title">ตรวจนับ stock</h1>
        </div>
      </div>

      <div className="stock-counting-workspace" aria-label="พื้นที่ตรวจนับ stock" role="region">
        <section className="panel receiving-scan-panel" aria-label="สแกนตรวจนับ stock">
          <label className="field receiving-scan-field" htmlFor="stock-counting-scan">
            <span>สแกนหรือค้นหาสินค้า</span>
            <SearchableDropdown
              ref={scanInputRef}
              ariaLabel="สแกนหรือค้นหาสินค้าเพื่อตรวจนับ"
              emptyMessage="ไม่พบสินค้าที่ค้นหา"
              hint="สแกนสินค้าซ้ำเพื่อเพิ่มจำนวนที่นับได้ทีละ 1 ชิ้น"
              id="stock-counting-scan"
              isExactMatch={isCountingExactMatch}
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
                    // scan field so the counter can keep scanning.
                    event.stopPropagation()
                  }
                  return
                }
                handleScanEnter()
              }}
              onSelect={(option) => handleScanSelect(option)}
            />
          </label>
        </section>

        <section className="panel receiving-summary-panel" aria-label="สรุปการตรวจนับ">
          <div className="receiving-stat receiving-stat-blue">
            <span>จำนวนรายการ</span>
            <strong>{formatNumber(totalLines)}</strong>
          </div>
          <div className="receiving-stat receiving-stat-green">
            <span>นับได้รวม</span>
            <strong>{formatNumber(totalCounted)}</strong>
          </div>
          <div className="receiving-stat receiving-stat-orange">
            <span>ผลต่างรวม</span>
            <strong>{formatNumber(totalDifference)}</strong>
          </div>
        </section>

        <Tabs
          ariaLabel="สลับระหว่างคิวตรวจนับ stock และประวัติการปรับ stock"
          className="stock-counting-tabs"
          defaultValue="queue"
        >
          <TabsList>
            <TabsTrigger value="queue">
              คิวตรวจนับ stock
              <span className="tabs-trigger-badge">{formatNumber(totalLines)}</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              ประวัติการปรับ stock
              <span className="tabs-trigger-badge">{formatNumber(historyTotal)}</span>
            </TabsTrigger>
          </TabsList>

          <TabsPanel value="queue">
            <section
              className="panel receiving-queue-panel receiving-queue-panel-full stock-counting-queue-panel"
              aria-label="คิวตรวจนับ stock"
            >
              <div className="receiving-queue-header">
                <p className="receiving-queue-meta">
                  รวม {formatNumber(totalLines)} รายการ · นับได้ {formatNumber(totalCounted)} ชิ้น
                </p>
                <button
                  className="success-button"
                  disabled={lines.length === 0}
                  onClick={() => void saveCountingQueue()}
                  type="button"
                >
                  บันทึกตรวจนับ {formatNumber(lines.length)} รายการ
                </button>
              </div>

              <div className="receiving-table-wrap receiving-table-wrap-full stock-counting-queue-table-wrap">
                <table className="receiving-table">
                  <thead>
                    <tr>
                      <th>อันดับ</th>
                      <th>สินค้า</th>
                      <th>Barcode</th>
                      <th>หน่วย</th>
                      <th>คงเหลือในระบบ</th>
                      <th>นับได้</th>
                      <th>ผลต่าง</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length > 0 ? (
                      lines.map((line, index) => {
                        const difference = line.countedQuantity - line.product.stockQuantity

                        return (
                          <tr key={line.product.id}>
                            <td>{formatNumber(index + 1)}</td>
                            <td><strong>{line.product.name}</strong></td>
                            <td>{line.product.barcode}</td>
                            <td>{line.product.unit ?? '-'}</td>
                            <td>{formatNumber(line.product.stockQuantity)}</td>
                            <td>
                              <input
                                aria-label={`จำนวนที่นับได้ ${line.product.name}`}
                                min="0"
                                type="number"
                                value={line.countedQuantity}
                                onChange={(event) => updateLine(line.product.id, event.target.value)}
                              />
                            </td>
                            <td className={difference === 0 ? 'stock-difference-even' : 'stock-difference-alert'}>
                              {formatNumber(difference)}
                            </td>
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
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8}>ยังไม่มีสินค้าในคิวตรวจนับ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="summary">{message}</p>
            </section>
          </TabsPanel>

          <TabsPanel value="history">
            <section
              className="panel receiving-history-panel stock-counting-history-panel"
              aria-label="ประวัติการปรับ stock"
            >
              <div className="receiving-history-header">
                <p className="receiving-history-meta">
                  {historyTotal > 0
                    ? `หน้า ${formatNumber(historyPage)} จาก ${formatNumber(Math.max(1, Math.ceil(historyTotal / historyPageSize)))}`
                    : 'ยังไม่มีประวัติการปรับ stock'}
                </p>
                <strong>{formatNumber(historyTotal)} รายการ</strong>
              </div>
              <div className="receiving-history-scroll stock-counting-history-scroll">
                <table aria-label="ประวัติการปรับ stock" className="receiving-history-table stock-counting-history-table">
                  <thead>
                    <tr>
                      <th>ลำดับ</th>
                      <th>วันที่เวลา</th>
                      <th>สินค้า</th>
                      <th>Barcode</th>
                      <th>ประเภท</th>
                      <th>ปรับ</th>
                      <th>ยอดจริงปัจจุบัน</th>
                      <th>ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length > 0 ? (
                      history.map((transaction, index) => (
                        <tr key={transaction.id}>
                          <td>{formatNumber((historyPage - 1) * historyPageSize + index + 1)}</td>
                          <td>{formatHistoryDateTime(transaction.createdAt)}</td>
                          <td><strong>{transaction.productName}</strong></td>
                          <td>{transaction.barcode}</td>
                          <td>{stockTransactionTypeLabel(transaction.type)}</td>
                          <td className={transaction.quantityChange >= 0 ? 'stock-difference-even' : 'stock-difference-alert'}>
                            {signedQuantity(transaction.quantityChange)}
                          </td>
                          <td><strong>{formatNumber(transaction.balanceAfterChange)}</strong></td>
                          <td>{transaction.createdBy ?? '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>ยังไม่มีประวัติการปรับ stock</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {historyTotal > 0 && (
                <div className="history-pagination" role="navigation" aria-label="เปลี่ยนหน้าประวัติการปรับ stock">
                  <button
                    className="ghost-button"
                    disabled={historyPage <= 1 || historyLoading}
                    type="button"
                    onClick={() => void loadHistory(historyPage - 1)}
                  >
                    ‹ ก่อนหน้า
                  </button>
                  <span className="history-pagination-info">
                    {historyLoading
                      ? 'กำลังโหลด...'
                      : `หน้า ${formatNumber(historyPage)} จาก ${formatNumber(Math.max(1, Math.ceil(historyTotal / historyPageSize)))} · แสดง ${formatNumber((historyPage - 1) * historyPageSize + 1)}-${formatNumber(Math.min(historyTotal, historyPage * historyPageSize))} จาก ${formatNumber(historyTotal)}`}
                  </span>
                  <button
                    className="ghost-button"
                    disabled={historyPage >= Math.ceil(historyTotal / historyPageSize) || historyLoading}
                    type="button"
                    onClick={() => void loadHistory(historyPage + 1)}
                  >
                    ถัดไป ›
                  </button>
                </div>
              )}
            </section>
          </TabsPanel>
        </Tabs>
      </div>
    </section>
  )
}
