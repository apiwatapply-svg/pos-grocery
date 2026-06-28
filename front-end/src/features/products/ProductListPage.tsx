import { type FormEvent, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api/client'
import { canAccessRoute } from '../../lib/auth/permissions'
import { readSession } from '../../lib/auth/session'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

type Product = {
  id: string
  name: string
  barcode: string
  sku?: string
  unit?: string
  images?: Array<{
    thumbnailUrl?: string
    secureUrl?: string
  }>
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

function productImageUrl(product: Product) {
  return product.images?.[0]?.thumbnailUrl ?? product.images?.[0]?.secureUrl
}

function stockStatus(product: Product) {
  if (product.stockQuantity <= 0) {
    return 'หมดสต็อก'
  }

  return 'พร้อมขาย'
}

function productStatusLabel(product: Product) {
  return product.status === 'inactive' ? 'ปิดขาย' : 'เปิดขาย'
}

export function ProductListPage() {
  const session = readSession()
  const canCreateProduct = session ? canAccessRoute(session.user.role, 'product-create') : false
  const [products, setProducts] = useState<Product[]>([])
  const [productFilter, setProductFilter] = useState('')
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

  const normalizedFilter = productFilter.trim().toLowerCase()
  const filteredProducts = normalizedFilter
    ? products.filter((product) =>
        [
          product.name,
          product.barcode,
          product.sku ?? '',
          product.unit ?? '',
          product.status,
          stockStatus(product),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedFilter),
      )
    : products

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
          <a className="export-link compact" href={`${apiBaseUrl}/inventory/export.xlsx`}>
            Export Excel
          </a>
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
      <section className="panel product-filter-panel" aria-label="ตัวกรองสินค้า">
        <label className="field product-filter-field" htmlFor="product-filter">
          <span>ค้นหา/กรองสินค้า</span>
          <input
            autoComplete="off"
            id="product-filter"
            list="product-filter-options"
            placeholder="เลือกหรือพิมพ์ชื่อ, SKU, barcode, สถานะ"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          />
        </label>
        <datalist id="product-filter-options">
          {products.map((product) => (
            <option
              key={product.id}
              value={product.sku ?? product.name}
            >{`${product.name} - ${product.barcode}`}</option>
          ))}
        </datalist>
        <button className="ghost-button compact product-filter-clear" onClick={() => setProductFilter('')} type="button">
          ล้างตัวกรอง
        </button>
      </section>
      <div className="table-wrap panel">
        <table className="product-inventory-table">
          <thead>
            <tr>
              <th>No</th>
              <th>รูป</th>
              <th>สินค้า</th>
              <th>SKU</th>
              <th>Barcode</th>
              <th>หน่วย</th>
              <th>ต้นทุน</th>
              <th>ราคาขาย</th>
              <th>คงเหลือ</th>
              <th>สถานะสต็อก</th>
              <th>สถานะสินค้า</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? filteredProducts.map((product, index) => (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td>
                  {productImageUrl(product) ? (
                    <img className="product-thumb" src={productImageUrl(product)} alt={product.name} />
                  ) : (
                    <span className="product-thumb product-thumb-empty" aria-label="ไม่มีรูป" />
                  )}
                </td>
                <td><strong>{product.name}</strong></td>
                <td>{product.sku ?? '-'}</td>
                <td>{product.barcode}</td>
                <td>{product.unit ?? '-'}</td>
                <td>{bahtFromSatang(product.costPriceSatang)}</td>
                <td>{bahtFromSatang(product.salePriceSatang)}</td>
                <td>{product.stockQuantity}</td>
                <td>{stockStatus(product)}</td>
                <td>{productStatusLabel(product)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={11}>{products.length > 0 ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง' : message}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
