export function InventoryReceivingPage() {
  return (
    <section className="route-page" aria-labelledby="receiving-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="receiving-title">รับของเข้า</h1>
        </div>
      </div>
      <form className="panel compact-form">
        <select aria-label="สินค้า" defaultValue="product-water">
          <option value="product-water">Drinking Water</option>
          <option value="product-noodle">Instant Noodles</option>
        </select>
        <input aria-label="จำนวนรับเข้า" min="1" type="number" defaultValue="1" />
        <input aria-label="ราคาต้นทุนต่อหน่วย" min="0" step="0.01" type="number" defaultValue="4" />
        <button className="success-button" type="submit">
          บันทึกรับของ
        </button>
      </form>
    </section>
  )
}
