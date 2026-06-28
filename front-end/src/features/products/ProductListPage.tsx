import { Link } from 'react-router-dom'
import { canAccessRoute } from '../../lib/auth/permissions'
import { readSession } from '../../lib/auth/session'

const products = [
  {
    id: 'product-water',
    name: 'Drinking Water',
    barcode: '8850002000010',
    sku: 'WATER-001',
    costPrice: '4.00',
    salePrice: '7.00',
    stockQuantity: 24,
    status: 'active',
  },
  {
    id: 'product-noodle',
    name: 'Instant Noodles',
    barcode: '8850001000011',
    sku: 'NOODLE-001',
    costPrice: '7.00',
    salePrice: '12.00',
    stockQuantity: 18,
    status: 'active',
  },
]

export function ProductListPage() {
  const session = readSession()
  const canCreateProduct = session ? canAccessRoute(session.user.role, 'product-create') : false

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
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <span>{product.sku}</span>
                </td>
                <td>{product.barcode}</td>
                <td>{product.costPrice}</td>
                <td>{product.salePrice}</td>
                <td>คงเหลือ {product.stockQuantity}</td>
                <td>{product.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
