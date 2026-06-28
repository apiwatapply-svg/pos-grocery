import { useParams } from 'react-router-dom'

export function ProductFormPage() {
  const { productId } = useParams()
  const isEditing = Boolean(productId)

  return (
    <section className="route-page" aria-labelledby="product-form-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="product-form-title">{isEditing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h1>
        </div>
      </div>
      <form className="panel compact-form product-form">
        <input name="name" placeholder="ชื่อสินค้า" required />
        <input name="barcode" placeholder="barcode" required />
        <input name="sku" placeholder="SKU" />
        <input name="unit" placeholder="หน่วย" required />
        <input name="costPrice" placeholder="ต้นทุน" type="number" min="0" step="0.01" required />
        <input name="salePrice" placeholder="ราคาขาย" type="number" min="0" step="0.01" required />
        <input aria-label="Upload รูปสินค้าไป Cloudinary" type="file" />
        <button className="success-button" type="submit">
          {isEditing ? 'บันทึกสินค้า' : 'เพิ่มสินค้า'}
        </button>
      </form>
    </section>
  )
}
