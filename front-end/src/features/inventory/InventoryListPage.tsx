import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

type Product = {
  id: string
  name: string
  barcode: string
  stockQuantity: number
}

export function InventoryListPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('กำลังโหลดสินค้า')

  useEffect(() => {
    let active = true

    apiGet<Product[]>('/products')
      .then((apiProducts) => {
        if (active) {
          setProducts(apiProducts)
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

  return (
    <section className="route-page" aria-labelledby="inventory-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="inventory-title">สินค้าคงคลัง</h1>
        </div>
        <a className="export-link" href={`${apiBaseUrl}/inventory/export.xlsx`}>
          Export inventory Excel
        </a>
      </div>
      <div className="panel inventory-list">
        {products.length > 0 ? products.map((product) => (
          <div className="inventory-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{product.barcode}</span>
            </div>
            <strong>คงเหลือ {product.stockQuantity}</strong>
          </div>
        )) : (
          <p className="empty-hint">{message}</p>
        )}
      </div>
    </section>
  )
}
