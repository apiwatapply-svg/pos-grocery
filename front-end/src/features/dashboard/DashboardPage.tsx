export function DashboardPage() {
  return (
    <section className="route-page" aria-labelledby="dashboard-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="dashboard-title">Dashboard</h1>
        </div>
      </div>
      <section className="metric-strip" aria-label="สรุป Dashboard">
        <div>
          <span>ยอดขายวันนี้</span>
          <strong>0.00 บาท</strong>
        </div>
        <div>
          <span>จำนวนบิลวันนี้</span>
          <strong>0</strong>
        </div>
        <div>
          <span>สินค้าใกล้หมด</span>
          <strong>2</strong>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>สินค้าขายดี</h2>
          <p>รอข้อมูลยอดขาย</p>
        </section>
        <section className="panel">
          <h2>ช่วงเวลาขายดี</h2>
          <p>รอข้อมูลยอดขาย</p>
        </section>
      </div>
    </section>
  )
}
