import { type FormEvent, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api/client'

type Product = {
  id: string
  name: string
}

export function InventoryReceivingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  useEffect(() => {
    let active = true

    apiGet<Product[]>('/products')
      .then((apiProducts) => {
        if (active) {
          setProducts(apiProducts)
          setSelectedProductId(apiProducts[0]?.id ?? '')
          setMessage(apiProducts.length > 0 ? '' : 'ยังไม่มีสินค้าในฐานข้อมูล')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProductId) {
      setMessage('กรุณาเลือกสินค้าจากฐานข้อมูล')
      return
    }

    try {
      await apiPost('/inventory/receive', {
        productId: selectedProductId,
        quantity,
        unitCostSatang: Math.round(unitCost * 100),
      })
      setMessage('บันทึกรับของแล้ว')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกรับของไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="receiving-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="receiving-title">รับของเข้า</h1>
        </div>
      </div>
      <form className="panel compact-form inventory-receiving-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="field" htmlFor="receiving-product">
          <span>สินค้าในคลัง</span>
          <select
            aria-label="สินค้า"
            id="receiving-product"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            <option value="">เลือกสินค้า</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
          <small>เลือกสินค้าที่ต้องการเพิ่มสต็อก</small>
        </label>
        <label className="field" htmlFor="receiving-quantity">
          <span>จำนวนที่รับเข้า</span>
          <input
            aria-label="จำนวนรับเข้า"
            id="receiving-quantity"
            min="1"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
          <small>จำนวนชิ้น/หน่วยที่รับเข้าร้าน</small>
        </label>
        <label className="field" htmlFor="receiving-unit-cost">
          <span>ต้นทุนต่อหน่วย (บาท)</span>
          <input
            aria-label="ราคาต้นทุนต่อหน่วย"
            id="receiving-unit-cost"
            min="0"
            step="0.01"
            type="number"
            value={unitCost}
            onChange={(event) => setUnitCost(Number(event.target.value))}
          />
          <small>ราคาทุนของสินค้า 1 หน่วย</small>
        </label>
        <button className="success-button inventory-receiving-submit" disabled={!selectedProductId} type="submit">
          บันทึกรับของ
        </button>
        <p className="summary">{message}</p>
      </form>
    </section>
  )
}
