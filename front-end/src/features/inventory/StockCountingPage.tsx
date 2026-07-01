import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'

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
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<StockAdjustmentHistory[]>([])
  const [scanValue, setScanValue] = useState('')
  const [lines, setLines] = useState<CountingLine[]>([])
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  async function loadProducts() {
    const apiProducts = await apiGet<Product[]>('/products?view=inventory')
    setProducts(apiProducts)
    setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
  }

  async function loadHistory() {
    const transactions = await apiGet<StockAdjustmentHistory[]>('/inventory/transactions?limit=100')
    setHistory(transactions)
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

        const transactions = await apiGet<StockAdjustmentHistory[]>('/inventory/transactions?limit=100')
        if (active) {
          setHistory(transactions)
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
  }, [])

  const totalLines = lines.length
  const totalCounted = lines.reduce((sum, line) => sum + line.countedQuantity, 0)
  const totalDifference = lines.reduce(
    (sum, line) => sum + line.countedQuantity - line.product.stockQuantity,
    0,
  )
  const scanSuggestions = useMemo(
    () => products.map((product) => `${product.name} - ${product.barcode}`),
    [products],
  )

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

    if (products.some((product) => matchesProduct(product, value))) {
      addScannedProduct(value)
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

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.product.id !== productId))
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
      await loadHistory()
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
            <input
              aria-label="สแกนหรือค้นหาสินค้าเพื่อตรวจนับ"
              autoComplete="off"
              id="stock-counting-scan"
              list="stock-counting-product-options"
              placeholder="สแกน barcode หรือพิมพ์ชื่อสินค้า"
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => handleScanChange(event.target.value)}
            />
            <small>สแกนสินค้าซ้ำเพื่อเพิ่มจำนวนที่นับได้ทีละ 1 ชิ้น</small>
          </label>
          <datalist id="stock-counting-product-options">
            {scanSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion.split(' - ')[0]}>
                {suggestion}
              </option>
            ))}
          </datalist>
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

        <div className="stock-counting-main-layout" aria-label="คิวตรวจนับ stock ซ้าย และประวัติการปรับ stock ขวา">
          <section
            className="panel receiving-queue-panel receiving-queue-panel-full stock-counting-queue-panel"
            aria-label="คิวตรวจนับ stock"
          >
            <div className="receiving-queue-header">
              <div>
                <h2>คิวตรวจนับ stock</h2>
                <p>รวม {formatNumber(totalLines)} รายการ</p>
                <p>นับได้ {formatNumber(totalCounted)} ชิ้น</p>
              </div>
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

          <section
            className="panel receiving-history-panel stock-counting-history-panel"
            aria-label="ประวัติการปรับ stock"
          >
            <div className="receiving-history-header">
              <div>
                <h2>ประวัติการปรับ stock</h2>
                <p>แสดง 50 รายการล่าสุด พร้อมยอดจริงปัจจุบันหลังการปรับ</p>
              </div>
              <strong>{formatNumber(history.length)} รายการ</strong>
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
                        <td>{formatNumber(index + 1)}</td>
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
          </section>
        </div>
      </div>
    </section>
  )
}
