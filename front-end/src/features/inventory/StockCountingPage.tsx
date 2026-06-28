import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api/client'

type Product = {
  id: string
  name: string
  barcode: string
  stockQuantity: number
}

export function StockCountingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  useEffect(() => {
    let active = true

    apiGet<Product[]>('/products')
      .then((apiProducts) => {
        if (active) {
          setProducts(apiProducts)
          setCounts(Object.fromEntries(apiProducts.map((product) => [product.id, product.stockQuantity])))
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

  async function adjustStock(product: Product) {
    try {
      await apiPost('/inventory/count', {
        productId: product.id,
        countedQuantity: counts[product.id] ?? product.stockQuantity,
      })
      setMessage(`ปรับยอด ${product.name} แล้ว`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ปรับยอดไม่สำเร็จ')
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
      <div className="panel inventory-list">
        {products.length > 0 ? products.map((product) => (
          <div className="inventory-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{product.barcode}</span>
            </div>
            <div className="stepper">
              <input
                aria-label={`จำนวนที่นับได้ ${product.name}`}
                type="number"
                value={counts[product.id] ?? product.stockQuantity}
                onChange={(event) =>
                  setCounts((current) => ({ ...current, [product.id]: Number(event.target.value) }))
                }
              />
              <button className="warning-button" type="button" onClick={() => void adjustStock(product)}>
                ปรับยอด
              </button>
            </div>
          </div>
        )) : (
          <p className="empty-hint">{message}</p>
        )}
        {products.length > 0 ? <p className="summary">{message}</p> : null}
      </div>
    </section>
  )
}
