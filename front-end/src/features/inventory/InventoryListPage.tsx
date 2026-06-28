const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

const inventory = [
  { id: 'product-water', name: 'Drinking Water', barcode: '8850002000010', stockQuantity: 24 },
  { id: 'product-noodle', name: 'Instant Noodles', barcode: '8850001000011', stockQuantity: 18 },
]

export function InventoryListPage() {
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
        {inventory.map((product) => (
          <div className="inventory-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{product.barcode}</span>
            </div>
            <strong>คงเหลือ {product.stockQuantity}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
