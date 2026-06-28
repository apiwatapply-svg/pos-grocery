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
      <form className="panel compact-form" onSubmit={(event) => void handleSubmit(event)}>
        <select
          aria-label="สินค้า"
          value={selectedProductId}
          onChange={(event) => setSelectedProductId(event.target.value)}
        >
          {products.length > 0 ? products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          )) : (
            <option value="">{message}</option>
          )}
        </select>
        <input
          aria-label="จำนวนรับเข้า"
          min="1"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
        <input
          aria-label="ราคาต้นทุนต่อหน่วย"
          min="0"
          step="0.01"
          type="number"
          value={unitCost}
          onChange={(event) => setUnitCost(Number(event.target.value))}
        />
        <button className="success-button" disabled={!selectedProductId} type="submit">
          บันทึกรับของ
        </button>
        <p className="summary">{message}</p>
      </form>
    </section>
  )
}
