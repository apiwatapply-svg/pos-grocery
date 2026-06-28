const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787/api'

export function SalesReportPage() {
  return (
    <section className="route-page" aria-labelledby="sales-report-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="sales-report-title">รายงานยอดขาย</h1>
        </div>
        <a className="export-link" href={`${apiBaseUrl}/reports/export.xlsx`}>
          Export report Excel
        </a>
      </div>
      <div className="panel">
        <div className="date-row">
          <input aria-label="วันที่เริ่ม" type="date" defaultValue="2026-06-28" />
          <input aria-label="วันที่สิ้นสุด" type="date" defaultValue="2026-06-28" />
        </div>
        <dl className="summary-list">
          <div>
            <dt>จำนวนบิล</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>ยอดขาย</dt>
            <dd>0.00 บาท</dd>
          </div>
          <div>
            <dt>จำนวนชิ้น</dt>
            <dd>0</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
