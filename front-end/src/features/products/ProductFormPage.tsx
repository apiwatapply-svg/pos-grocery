import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPatch, apiPost } from '../../lib/api/client'

type ProductForm = {
  name: string
  barcode: string
  sku: string
  unit: string
  costPrice: string
  salePrice: string
  status: 'active' | 'inactive'
}

type ApiProduct = {
  id: string
  name: string
  barcode: string
  sku?: string
  unit: string
  costPriceSatang: number
  salePriceSatang: number
  status: 'active' | 'inactive'
}

const emptyForm: ProductForm = {
  name: '',
  barcode: '',
  sku: '',
  unit: '',
  costPrice: '',
  salePrice: '',
  status: 'active',
}

function satangFromBaht(value: string) {
  return Math.round(Number(value || 0) * 100)
}

function fileToDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(productId)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [message, setMessage] = useState(isEditing ? 'กำลังโหลดสินค้า' : '')

  useEffect(() => {
    if (!productId) {
      return
    }

    let active = true

    apiGet<ApiProduct[]>('/products')
      .then((products) => {
        const product = products.find((candidate) => candidate.id === productId)
        if (!active) {
          return
        }
        if (!product) {
          setMessage('ไม่พบสินค้า')
          return
        }
        setForm({
          name: product.name,
          barcode: product.barcode,
          sku: product.sku ?? '',
          unit: product.unit,
          costPrice: (product.costPriceSatang / 100).toFixed(2),
          salePrice: (product.salePriceSatang / 100).toFixed(2),
          status: product.status,
        })
        setMessage('')
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [productId])

  function updateField(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = {
      name: form.name,
      barcode: form.barcode,
      ...(form.sku.trim() ? { sku: form.sku } : {}),
      unit: form.unit,
      costPriceSatang: satangFromBaht(form.costPrice),
      salePriceSatang: satangFromBaht(form.salePrice),
      status: form.status,
    }

    try {
      const saved = isEditing
        ? await apiPatch<ApiProduct>(`/products/${productId}`, payload)
        : await apiPost<ApiProduct>('/products', payload)

      if (imageFile) {
        await apiPost(`/products/${saved.id}/images`, {
          fileName: imageFile.name,
          dataUri: await fileToDataUri(imageFile),
          altText: saved.name,
        })
      }

      navigate('/products')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกสินค้าไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="product-form-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="product-form-title">{isEditing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h1>
        </div>
      </div>
      <form className="panel compact-form product-form" onSubmit={(event) => void saveProduct(event)}>
        <input name="name" placeholder="ชื่อสินค้า" required value={form.name} onChange={(event) => updateField('name', event.target.value)} />
        <input name="barcode" placeholder="barcode" required value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
        <input name="sku" placeholder="SKU" value={form.sku} onChange={(event) => updateField('sku', event.target.value)} />
        <input name="unit" placeholder="หน่วย" required value={form.unit} onChange={(event) => updateField('unit', event.target.value)} />
        <input name="costPrice" placeholder="ต้นทุน" type="number" min="0" step="0.01" required value={form.costPrice} onChange={(event) => updateField('costPrice', event.target.value)} />
        <input name="salePrice" placeholder="ราคาขาย" type="number" min="0" step="0.01" required value={form.salePrice} onChange={(event) => updateField('salePrice', event.target.value)} />
        <input aria-label="Upload รูปสินค้าไป Cloudinary" type="file" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
        <button className="success-button" type="submit">
          {isEditing ? 'บันทึกสินค้า' : 'เพิ่มสินค้า'}
        </button>
        {message ? <p className="summary">{message}</p> : null}
      </form>
    </section>
  )
}
