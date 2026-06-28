import { type FormEvent, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api/client'
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

type ProductDraft = {
  id: string
  name: string
  barcode: string
  sku: string
  unit: string
  costPrice: string
  salePrice: string
}

const emptyDraft = (): ProductDraft => ({
  id: crypto.randomUUID(),
  name: '',
  barcode: '',
  sku: '',
  unit: '',
  costPrice: '',
  salePrice: '',
})

function bahtFromSatang(value: number) {
  return (value / 100).toFixed(2)
}

function satangFromBaht(value: string) {
  return Math.round(Number(value || 0) * 100)
}

export function ProductListPage() {
  const session = readSession()
  const canCreateProduct = session ? canAccessRoute(session.user.role, 'product-create') : false
  const [products, setProducts] = useState<Product[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [drafts, setDrafts] = useState<ProductDraft[]>([emptyDraft()])
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

  function updateDraft(id: string, field: keyof Omit<ProductDraft, 'id'>, value: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)),
    )
  }

  function resetCreateModal() {
    setDrafts([emptyDraft()])
    setIsCreateModalOpen(false)
  }

  async function createProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validDrafts = drafts.filter(
      (draft) =>
        draft.name.trim() &&
        draft.barcode.trim() &&
        draft.unit.trim() &&
        draft.costPrice.trim() &&
        draft.salePrice.trim(),
    )

    if (validDrafts.length === 0) {
      setMessage('กรอกสินค้าอย่างน้อย 1 รายการ')
      return
    }

    try {
      const createdProducts = await Promise.all(
        validDrafts.map((draft) =>
          apiPost<Product>('/products', {
            name: draft.name.trim(),
            barcode: draft.barcode.trim(),
            ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
            unit: draft.unit.trim(),
            costPriceSatang: satangFromBaht(draft.costPrice),
            salePriceSatang: satangFromBaht(draft.salePrice),
            status: 'active',
          }),
        ),
      )
      setProducts((current) => [...createdProducts, ...current])
      setMessage('')
      resetCreateModal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เพิ่มสินค้าไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="products-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="products-title">สินค้า</h1>
        </div>
        <div className="page-actions">
          {canCreateProduct ? (
            <button
              className="success-button compact page-action-button"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              เพิ่มสินค้า
            </button>
          ) : null}
        </div>
      </div>
      {isCreateModalOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="create-products-title"
            aria-modal="true"
            className="modal-panel product-bulk-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="create-products-title">เพิ่มสินค้าหลายรายการ</h2>
                <p>เพิ่มสินค้าได้หลายแถว แล้วบันทึกเข้าฐานข้อมูลพร้อมกัน</p>
              </div>
              <button className="ghost-button compact" onClick={resetCreateModal} type="button">
                ปิด
              </button>
            </div>
            <form className="modal-form product-bulk-form" onSubmit={(event) => void createProducts(event)}>
              <div className="product-bulk-list">
                {drafts.map((draft, index) => (
                  <fieldset className="product-bulk-row" key={draft.id}>
                    <legend>รายการที่ {index + 1}</legend>
                    <label className="field">
                      <span>ชื่อสินค้า</span>
                      <input
                        aria-label="ชื่อสินค้า"
                        required
                        value={draft.name}
                        onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Barcode</span>
                      <input
                        aria-label="Barcode"
                        required
                        value={draft.barcode}
                        onChange={(event) => updateDraft(draft.id, 'barcode', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>SKU</span>
                      <input
                        aria-label="SKU"
                        value={draft.sku}
                        onChange={(event) => updateDraft(draft.id, 'sku', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>หน่วย</span>
                      <input
                        aria-label="หน่วย"
                        required
                        value={draft.unit}
                        onChange={(event) => updateDraft(draft.id, 'unit', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>ต้นทุน</span>
                      <input
                        aria-label="ต้นทุน"
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={draft.costPrice}
                        onChange={(event) => updateDraft(draft.id, 'costPrice', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>ราคาขาย</span>
                      <input
                        aria-label="ราคาขาย"
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={draft.salePrice}
                        onChange={(event) => updateDraft(draft.id, 'salePrice', event.target.value)}
                      />
                    </label>
                    {drafts.length > 1 ? (
                      <button
                        className="danger-button compact"
                        onClick={() => setDrafts((current) => current.filter((row) => row.id !== draft.id))}
                        type="button"
                      >
                        ลบแถว
                      </button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="info-button compact"
                  onClick={() => setDrafts((current) => [...current, emptyDraft()])}
                  type="button"
                >
                  เพิ่มแถว
                </button>
                <div className="modal-actions-right">
                  <button className="ghost-button compact" onClick={resetCreateModal} type="button">
                    ยกเลิก
                  </button>
                  <button className="success-button compact" type="submit">
                    บันทึก {drafts.length} รายการ
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
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
