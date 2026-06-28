import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api/client'
import { canAccessRoute } from '../../lib/auth/permissions'
import { readSession } from '../../lib/auth/session'

type Product = {
  id: string
  name: string
  barcode: string
  sku?: string
  costPriceSatang: number
  salePriceSatang: number
  stockQuantity: number
  status: string
}

function bahtFromSatang(value: number) {
  return (value / 100).toFixed(2)
}

export function ProductListPage() {
  const session = readSession()
  const canCreateProduct = session ? canAccessRoute(session.user.role, 'product-create') : false
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
    <section className="route-page" aria-labelledby="products-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="products-title">สินค้า</h1>
        </div>
        {canCreateProduct ? (
          <Link className="primary-button compact" to="/products/new">
            เพิ่มสินค้า
          </Link>
        ) : null}
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>Barcode</th>
              <th>ต้นทุน</th>
              <th>ขาย</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <span>{product.sku}</span>
                </td>
                <td>{product.barcode}</td>
                <td>{bahtFromSatang(product.costPriceSatang)}</td>
                <td>{bahtFromSatang(product.salePriceSatang)}</td>
                <td>คงเหลือ {product.stockQuantity}</td>
                <td>{product.status}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>{message}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
