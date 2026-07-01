import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { apiGet, apiPost } from '../../lib/api/client'
import { formatBaht, formatNumber } from '../../lib/format/number'

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
  quantity: number
  unitCost: string
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
  return line.quantity * Number(line.unitCost || 0)
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

export function InventoryReceivingPage() {
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<ReceivingHistory[]>([])
  const [scanValue, setScanValue] = useState('')
  const [lines, setLines] = useState<ReceivingLine[]>([])
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

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const totalValue = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const scanSuggestions = useMemo(
    () => products.map((product) => `${product.name} - ${product.barcode}`),
    [products],
  )

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
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }

      return [
        ...current,
        {
          product,
          quantity: 1,
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

    if (products.some((product) => matchesProduct(product, value))) {
      addScannedProduct(value)
    }
  }

  function updateLine(productId: string, field: 'quantity' | 'unitCost', value: string) {
    setLines((current) =>
      current.map((line) => {
        if (line.product.id !== productId) {
          return line
        }

        if (field === 'quantity') {
          return { ...line, quantity: Math.max(1, Number(value || 1)) }
        }

        return { ...line, unitCost: value }
      }),
    )
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.product.id !== productId))
    scanInputRef.current?.focus()
  }

  async function saveReceivingQueue() {
    if (lines.length === 0) {
      setMessage('สแกนสินค้าเข้าคิวก่อนบันทึกรับของ')
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
            quantity: line.quantity,
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
            <input
              aria-label="สแกนหรือค้นหาสินค้า"
              autoComplete="off"
              id="receiving-scan"
              list="receiving-product-options"
              placeholder="สแกน barcode หรือพิมพ์ชื่อสินค้า"
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => handleScanChange(event.target.value)}
            />
            <small>สแกนหรือเลือกสินค้าจากช่องค้นหาแล้วระบบจะเพิ่มเข้าคิวทันที</small>
          </label>
          <datalist id="receiving-product-options">
            {scanSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion.split(' - ')[0]}>
                {suggestion}
              </option>
            ))}
          </datalist>
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
                            min="1"
                            type="number"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.product.id, 'quantity', event.target.value)}
                          />
                        </td>
                        <td>{formatNumber(line.product.stockQuantity + line.quantity)}</td>
                        <td>
                          <input
                            aria-label={`ต้นทุนต่อหน่วย ${line.product.name}`}
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
