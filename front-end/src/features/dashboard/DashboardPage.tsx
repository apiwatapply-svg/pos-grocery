import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'
import { formatNumber, formatPercent } from '../../lib/format/number'
import { bahtFromSatang, dateRangeQuery, todayDateInputValue, type DashboardReport } from '../reports/reportApi'

const dashboardItemLimitStorageKey = 'pos-grocery:dashboard-item-limit'
const dashboardHourlyMetricStorageKey = 'pos-grocery:dashboard-hourly-metric'
const dashboardDateFilterStorageKey = 'pos-grocery:dashboard-date-filter'
const dashboardLimitOptions = [3, 5, 10, 20, 50]
type DashboardItemLimit = number | 'all'
type HourlySalesSlot = NonNullable<DashboardReport['hourlySales']>[number]
type HourlySalesItem = HourlySalesSlot['items'][number]
type HourlyMetric = 'sales' | 'orders' | 'items'
type DashboardDateFilter = {
  from: string
  to: string
}

const hourlyMetricOptions: Array<{ label: string; value: HourlyMetric }> = [
  { label: 'ยอดขาย', value: 'sales' },
  { label: 'จำนวนบิล', value: 'orders' },
  { label: 'จำนวนชิ้น', value: 'items' },
]

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function readDashboardItemLimit() {
  const storedValue = localStorage.getItem(dashboardItemLimitStorageKey)
  if (storedValue === 'all') {
    return storedValue
  }

  const storedLimit = Number(storedValue)
  return dashboardLimitOptions.includes(storedLimit) ? storedLimit : 5
}

function readDashboardHourlyMetric(): HourlyMetric {
  const storedValue = localStorage.getItem(dashboardHourlyMetricStorageKey)
  return storedValue === 'orders' || storedValue === 'items' || storedValue === 'sales' ? storedValue : 'sales'
}

function readDashboardDateFilter(): DashboardDateFilter {
  const today = todayDateInputValue()

  try {
    const storedValue = localStorage.getItem(dashboardDateFilterStorageKey)
    if (!storedValue) {
      return { from: today, to: today }
    }

    const parsed = JSON.parse(storedValue) as Partial<DashboardDateFilter>
    return {
      from: typeof parsed.from === 'string' && parsed.from ? parsed.from : today,
      to: typeof parsed.to === 'string' && parsed.to ? parsed.to : today,
    }
  } catch {
    return { from: today, to: today }
  }
}

function limitDashboardItems<T>(items: T[], limit: DashboardItemLimit) {
  return limit === 'all' ? items : items.slice(0, limit)
}

function hourlyAxisTicks(maxValue: number) {
  const ticks = [maxValue, Math.round(maxValue / 2), 0]
  return ticks.filter((tick, index) => ticks.indexOf(tick) === index)
}

function hourlySoldQuantity(slot: HourlySalesSlot) {
  return slot.items.reduce((sum, item) => sum + item.quantity, 0)
}

function hourlyMetricValue(slot: HourlySalesSlot, metric: HourlyMetric) {
  if (metric === 'orders') {
    return slot.orderCount
  }

  if (metric === 'items') {
    return hourlySoldQuantity(slot)
  }

  return slot.totalSalesSatang
}

function hourProductMetricValue(item: HourlySalesItem, slot: HourlySalesSlot, metric: HourlyMetric) {
  if (metric === 'orders') {
    if (slot.totalSalesSatang > 0) {
      return (item.totalSalesSatang / slot.totalSalesSatang) * slot.orderCount
    }
    return 0
  }

  if (metric === 'items') {
    return item.quantity
  }

  return item.totalSalesSatang
}

function formatHourProductMetricValue(value: number, metric: HourlyMetric) {
  if (metric === 'orders') {
    return formatNumber(Math.round(value))
  }
  return formatHourlyMetricValue(value, metric)
}

function hourlyMetricLabel(metric: HourlyMetric) {
  if (metric === 'orders') {
    return 'จำนวนบิล'
  }

  if (metric === 'items') {
    return 'จำนวนชิ้น'
  }

  return 'ยอดขาย'
}

function hourlyMetricAxisLabel(metric: HourlyMetric) {
  if (metric === 'orders') {
    return 'แกน Y: จำนวนบิล'
  }

  if (metric === 'items') {
    return 'แกน Y: จำนวนชิ้น'
  }

  return 'แกน Y: ยอดขาย (บาท)'
}

function formatHourlyMetricValue(value: number, metric: HourlyMetric) {
  return metric === 'sales' ? bahtFromSatang(value) : formatNumber(value)
}

function fillEmptyHourlySalesSlots(slots: HourlySalesSlot[]) {
  const slotsByHour = new Map(slots.map((slot) => [slot.hour, slot]))

  return Array.from({ length: 24 }, (_, hour) => (
    slotsByHour.get(hour) ?? {
      hour,
      orderCount: 0,
      totalSalesSatang: 0,
      items: [],
    }
  ))
}

function selectedHourForReport(report: DashboardReport) {
  const reportedHourlySlot = report.hourlySales?.find((slot) => slot.totalSalesSatang > 0) ?? report.hourlySales?.[0]
  return reportedHourlySlot?.hour ?? report.bestTimeSlots[0]?.hour ?? 0
}

export function DashboardPage() {
  const initialDateFilter = readDashboardDateFilter()
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null)
  const [message, setMessage] = useState('กำลังโหลด Dashboard')
  const [fromDate, setFromDate] = useState(initialDateFilter.from)
  const [toDate, setToDate] = useState(initialDateFilter.to)
  const [itemLimit, setItemLimit] = useState<DashboardItemLimit>(readDashboardItemLimit)
  const [hourlyMetric, setHourlyMetric] = useState<HourlyMetric>(readDashboardHourlyMetric)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  useEffect(() => {
    localStorage.setItem(dashboardDateFilterStorageKey, JSON.stringify({ from: fromDate, to: toDate }))
  }, [fromDate, toDate])

  useEffect(() => {
    let active = true

    apiGet<DashboardReport>(`/reports/dashboard${dateRangeQuery(fromDate, toDate)}`)
      .then((report) => {
        if (active) {
          setDashboard(report)
          setMessage('')
          setSelectedHour(selectedHourForReport(report))
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลด Dashboard ไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [fromDate, toDate])

  function updateItemLimit(value: string) {
    const requestedLimit = value === 'all' ? value : Number(value)
    const nextLimit = requestedLimit === 'all' || dashboardLimitOptions.includes(requestedLimit) ? requestedLimit : 5
    setItemLimit(nextLimit)
    localStorage.setItem(dashboardItemLimitStorageKey, String(nextLimit))
  }

  function updateHourlyMetric(metric: HourlyMetric) {
    setHourlyMetric(metric)
    localStorage.setItem(dashboardHourlyMetricStorageKey, metric)
  }

  const topSeller = dashboard?.bestSellers[0]
  const bestTimeSlot = dashboard?.bestTimeSlots[0]
  const bestProfitProduct = dashboard?.bestProfitProducts?.[0]
  const bestSellers = limitDashboardItems(dashboard?.bestSellers ?? [], itemLimit)
  const bestProfitProducts = limitDashboardItems(dashboard?.bestProfitProducts ?? [], itemLimit)
  const hourlySales = dashboard
    ? fillEmptyHourlySalesSlots(dashboard.hourlySales ?? dashboard.bestTimeSlots.map((slot) => ({ ...slot, items: [] })))
    : []
  const selectedHourSales = hourlySales.find((slot) => slot.hour === selectedHour) ?? hourlySales[0]
  const sortedSelectedHourItems = selectedHourSales
    ? [...selectedHourSales.items].sort(
        (leftItem, rightItem) =>
          hourProductMetricValue(rightItem, selectedHourSales, hourlyMetric) -
          hourProductMetricValue(leftItem, selectedHourSales, hourlyMetric),
      )
    : []
  const selectedHourItems = limitDashboardItems(sortedSelectedHourItems, itemLimit)
  const maxSellerQuantity = Math.max(...bestSellers.map((item) => item.quantity), 1)
  const maxProfitSatang = Math.max(...bestProfitProducts.map((item) => item.profitSatang), 1)
  const maxSelectedHourMetricValue = selectedHourSales
    ? Math.max(
        ...sortedSelectedHourItems.map((item) => hourProductMetricValue(item, selectedHourSales, hourlyMetric)),
        1,
      )
    : 1
  const maxHourlyMetricValue = Math.max(...hourlySales.map((slot) => hourlyMetricValue(slot, hourlyMetric)), 1)
  const hourlySalesTicks = hourlyAxisTicks(maxHourlyMetricValue)
  const averageOrderSatang = dashboard?.summary.orderCount
    ? Math.round(dashboard.summary.totalSalesSatang / dashboard.summary.orderCount)
    : 0
  const dayStatus = dashboard?.summary.orderCount
    ? `มีการขายแล้ว ${formatNumber(dashboard.summary.orderCount)} บิล`
    : 'ยังไม่มีบิลวันนี้'

  return (
    <section className="route-page" aria-labelledby="dashboard-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 id="dashboard-title">Dashboard</h1>
        </div>
      </div>
      <section className="panel dashboard-filter-panel" aria-label="ตัวกรอง Dashboard">
        <label className="field">
          <span>วันที่เริ่มต้น</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="field">
          <span>วันที่สิ้นสุด</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label className="field">
          <span>จำนวนอันดับที่แสดงในกราฟ</span>
          <select
            aria-label="จำนวนอันดับที่แสดงในกราฟ"
            value={itemLimit}
            onChange={(event) => updateItemLimit(event.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            {dashboardLimitOptions.map((limit) => (
              <option key={limit} value={limit}>
                {formatNumber(limit)} รายการ
              </option>
            ))}
          </select>
        </label>
      </section>
      <div
        className="dashboard-priority-layout"
        aria-label="ลำดับ Dashboard: การ์ดสรุปอยู่บน สินค้าขายดีอยู่ซ้าย กำไรสูงสุดอยู่ขวา"
      >
        <section
          className="dashboard-summary-row dashboard-summary-row-top dashboard-layout-summary"
          aria-label="การ์ดสรุป Dashboard แบบบรรทัดเดียว"
        >
          <article className="dashboard-summary-card dashboard-summary-card-green">
            <span>ยอดขายช่วงที่เลือก</span>
            <strong>{bahtFromSatang(dashboard?.summary.totalSalesSatang ?? 0)} บาท</strong>
            <small>ยอดขายรวมตามช่วงวันที่</small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-blue">
            <span>จำนวนบิล</span>
            <strong>{formatNumber(dashboard?.summary.orderCount ?? 0)}</strong>
            <small>บิลขายที่ปิดสำเร็จ</small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-orange">
            <span>จำนวนชิ้นที่ขาย</span>
            <strong>{formatNumber(dashboard?.summary.itemsSold ?? 0)}</strong>
            <small>รวมทุกสินค้าในบิล</small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-green">
            <span>สินค้าท็อปช่วงนี้</span>
            <strong>{topSeller?.productName ?? 'ยังไม่มีสินค้าขายดี'}</strong>
            <small>
              {topSeller
                ? `${formatNumber(topSeller.quantity)} ชิ้น / ${bahtFromSatang(topSeller.totalSalesSatang)} บาท`
                : 'รอข้อมูลจากยอดขาย'}
            </small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-blue">
            <span>ช่วงที่ขายดีที่สุด</span>
            <strong>
              {bestTimeSlot ? `${String(bestTimeSlot.hour).padStart(2, '0')}:00` : 'ยังไม่มีช่วงเวลาขายดี'}
            </strong>
            <small>
              {bestTimeSlot
                ? `${formatNumber(bestTimeSlot.orderCount)} บิล / ${bahtFromSatang(bestTimeSlot.totalSalesSatang)} บาท`
                : 'รอข้อมูลจากยอดขาย'}
            </small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-orange">
            <span>ค่าเฉลี่ยต่อบิล</span>
            <strong>{bahtFromSatang(averageOrderSatang)} บาท</strong>
            <small>คำนวณจากยอดขายช่วงนี้</small>
          </article>
          <article className="dashboard-summary-card dashboard-summary-card-purple">
            <span>กำไรสูงสุด</span>
            <strong>{bestProfitProduct?.productName ?? dayStatus}</strong>
            <small>
              {bestProfitProduct
                ? `กำไร ${bahtFromSatang(bestProfitProduct.profitSatang)} บาท / ${formatPercent(bestProfitProduct.profitMarginPercent)}`
                : dashboard?.summary.itemsSold ? `ขายสินค้าแล้ว ${formatNumber(dashboard.summary.itemsSold)} ชิ้น` : 'เริ่มขายเพื่อดูภาพรวม'}
            </small>
          </article>
        </section>
        <div className="dashboard-product-insight-row" aria-label="สินค้าขายดีซ้ายและกำไรสูงสุดขวา">
          <section className="panel dashboard-chart-panel dashboard-best-sellers-column">
            <div className="dashboard-chart-header">
              <h2>สินค้าขายดีที่สุดในช่วงเวลาที่เลือก</h2>
              <span>{formatNumber(bestSellers.length)} รายการ</span>
            </div>
            {bestSellers.length ? (
              <div className="horizontal-bar-list" role="list" aria-label="กราฟแท่งสินค้าขายดีที่สุด">
                {bestSellers.map((item) => (
                  <article className="horizontal-bar-row" role="listitem" key={item.productId}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>{formatNumber(item.quantity)} ชิ้น / {bahtFromSatang(item.totalSalesSatang)} บาท</span>
                    </div>
                    <div className="horizontal-bar-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(8, (item.quantity / maxSellerQuantity) * 100)}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>{message || 'ยังไม่มีข้อมูลยอดขาย'}</p>
            )}
          </section>
          <section className="panel dashboard-chart-panel dashboard-profit-panel dashboard-profit-column">
            <div className="dashboard-chart-header">
              <h2>สินค้าได้กำไรสูงสุดในช่วงเวลาที่เลือก</h2>
              <span>{formatNumber(bestProfitProducts.length)} รายการ</span>
            </div>
            {bestProfitProducts.length ? (
              <div className="horizontal-bar-list" role="list" aria-label="กราฟแท่งสินค้าได้กำไรสูงสุด">
                {bestProfitProducts.map((item) => (
                  <article className="horizontal-bar-row profit" role="listitem" key={item.productId}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>กำไร {bahtFromSatang(item.profitSatang)} บาท / {formatPercent(item.profitMarginPercent)}</span>
                    </div>
                    <div className="horizontal-bar-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(8, (item.profitSatang / maxProfitSatang) * 100)}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>{message || 'ยังไม่มีข้อมูลกำไร'}</p>
            )}
          </section>
        </div>
      </div>
      <section className="panel dashboard-hour-panel">
        <div className="dashboard-chart-header">
          <h2>ยอดขายรายชั่วโมงของช่วงเวลาที่เลือก</h2>
          <span>คลิกแท่งเพื่อดูสินค้าที่ขายได้</span>
        </div>
        <div className="chart-metric-toggle" aria-label="เลือกข้อมูลที่แสดงในกราฟรายชั่วโมง" role="group">
          {hourlyMetricOptions.map((option) => (
            <button
              aria-pressed={hourlyMetric === option.value}
              className={hourlyMetric === option.value ? 'chart-metric-button active' : 'chart-metric-button'}
              key={option.value}
              type="button"
              onClick={() => updateHourlyMetric(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="chart-axis-labels" aria-label="แกนกราฟยอดขายรายชั่วโมง">
          <span>{hourlyMetricAxisLabel(hourlyMetric)}</span>
          <span>แกน X: เวลา (ชั่วโมง)</span>
        </div>
        {hourlySales.length ? (
          <div
            className="hourly-chart"
            role="group"
            aria-label="กราฟแท่งยอดขายรายชั่วโมงพร้อมแกน X และ Y"
          >
            <div className="hourly-y-axis" aria-hidden="true">
              {hourlySalesTicks.map((tick) => (
                <span key={tick}>{formatHourlyMetricValue(tick, hourlyMetric)}</span>
              ))}
            </div>
            <div className="hourly-plot">
              <div className="hourly-gridlines" aria-hidden="true">
                {hourlySalesTicks.map((tick) => (
                  <span key={tick} />
                ))}
              </div>
              <div className="hourly-bars">
                {hourlySales.map((slot) => {
                  const tooltipId = `hourly-sales-tooltip-${slot.hour}`
                  const metricValue = hourlyMetricValue(slot, hourlyMetric)
                  return (
                    <button
                      aria-describedby={tooltipId}
                      aria-label={`ดูรายละเอียดช่วง ${hourLabel(slot.hour)} ${hourlyMetricLabel(hourlyMetric)} ${formatHourlyMetricValue(metricValue, hourlyMetric)}${hourlyMetric === 'sales' ? ' บาท' : ''}`}
                      className={selectedHourSales?.hour === slot.hour ? 'hourly-bar selected' : 'hourly-bar'}
                      key={slot.hour}
                      type="button"
                      onClick={() => setSelectedHour(slot.hour)}
                    >
                      <span
                        className="hourly-bar-mark"
                        aria-hidden="true"
                        style={{
                          height: metricValue > 0
                            ? `${Math.max(8, (metricValue / maxHourlyMetricValue) * 100)}%`
                            : 0,
                        }}
                      />
                      <span className="hourly-tooltip" id={tooltipId} role="tooltip">
                        {hourLabel(slot.hour)} {hourlyMetricLabel(hourlyMetric)} {formatHourlyMetricValue(metricValue, hourlyMetric)}
                        {hourlyMetric === 'sales' ? ' บาท' : ''} | ยอดขาย {bahtFromSatang(slot.totalSalesSatang)} บาท |{' '}
                        {formatNumber(slot.orderCount)} บิล | {formatNumber(hourlySoldQuantity(slot))} ชิ้น
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="hourly-x-axis" aria-hidden="true">
              <span>เวลา</span>
              <div>
                {hourlySales.map((slot) => (
                  <span key={slot.hour}>{hourLabel(slot.hour)}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p>{message || 'ยังไม่มีข้อมูลยอดขายรายชั่วโมง'}</p>
        )}
        {selectedHourSales ? (
          <section className="hour-detail-panel" aria-label={`สินค้าที่มีการขายในช่วง ${hourLabel(selectedHourSales.hour)}`}>
            <div className="dashboard-chart-header">
              <h3>สินค้าที่มีการขายในช่วง {hourLabel(selectedHourSales.hour)}</h3>
              <span>{formatNumber(selectedHourSales.orderCount)} บิล / {bahtFromSatang(selectedHourSales.totalSalesSatang)} บาท</span>
            </div>
            {selectedHourItems.length ? (
              <div className="hour-product-detail-layout" aria-label="กราฟและตารางสินค้าที่มีการขายในชั่วโมงที่เลือก">
                <div className="hour-product-chart-column" role="group" aria-label="กราฟแท่งแนวนอนสินค้าที่มีการขาย">
                  {selectedHourItems.map((item, index) => {
                    const metricValue = hourProductMetricValue(item, selectedHourSales, hourlyMetric)
                    return (
                      <article className="hour-product-bar-row" key={item.productId}>
                        <div className="hour-product-bar-label">
                          <span>#{formatNumber(index + 1)}</span>
                          <strong>{item.productName}</strong>
                          <small>
                            {hourlyMetricLabel(hourlyMetric)} {formatHourProductMetricValue(metricValue, hourlyMetric)}
                            {hourlyMetric === 'sales' ? ' บาท' : ''}
                          </small>
                        </div>
                        <div className="hour-product-bar-track" aria-hidden="true">
                          <span style={{ width: `${Math.max(8, (metricValue / maxSelectedHourMetricValue) * 100)}%` }} />
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="hour-product-table-column">
                  <table aria-label="ตารางรายละเอียดสินค้าที่มีการขาย">
                    <thead>
                      <tr>
                        <th>อันดับ</th>
                        <th>สินค้า</th>
                        <th>จำนวน</th>
                        <th>ยอดขาย</th>
                        <th>กำไร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHourItems.map((item, index) => (
                        <tr key={item.productId}>
                          <td>{formatNumber(index + 1)}</td>
                          <td>{item.productName}</td>
                          <td>{formatNumber(item.quantity)} ชิ้น</td>
                          <td>{bahtFromSatang(item.totalSalesSatang)} บาท</td>
                          <td>{bahtFromSatang(item.profitSatang ?? 0)} บาท</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p>ยังไม่มีรายละเอียดสินค้าในช่วงนี้</p>
            )}
          </section>
        ) : null}
      </section>
    </section>
  )
}
