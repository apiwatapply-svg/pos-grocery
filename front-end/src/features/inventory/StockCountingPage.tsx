export function StockCountingPage() {
  return (
    <section className="route-page" aria-labelledby="stock-counting-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 id="stock-counting-title">ตรวจนับ stock</h1>
        </div>
      </div>
      <div className="panel inventory-list">
        <div className="inventory-row">
          <div>
            <strong>Drinking Water</strong>
            <span>8850002000010</span>
          </div>
          <div className="stepper">
            <input aria-label="จำนวนที่นับได้ Drinking Water" type="number" defaultValue="24" />
            <button type="button">ปรับยอด</button>
          </div>
        </div>
      </div>
    </section>
  )
}
