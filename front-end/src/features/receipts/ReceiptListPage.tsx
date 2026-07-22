import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api/client'
import { readSession } from '../../lib/auth/session'
import { formatNumber, formatPercent } from '../../lib/format/number'
import { confirmAction } from '../../lib/ui/confirm'
import { ReceiptPaper } from './ReceiptPaper'
import {
  bahtFromSatang,
  type ApiSale,
  type ApiSaleSummary,
  type PaginatedApiResponse,
} from '../reports/reportApi'
import { PaginationControls } from '../shared/Pagination'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { displayReceiptNumber } from './receiptNumber'

type CurrentStore = {
  name: string
  address?: string
  logoUrl?: string
  phone?: string
}

function receiptDateTimeParts(value?: string) {
  if (!value) {
    return { date: '-', time: '-' }
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''

  return {
    date: `${part('day')}/${part('month')}/${part('year')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

const receiptPageSize = 10

type SaleSortKey =
  | 'receiptNumber'
  | 'soldAt'
  | 'totalSatang'
  | 'itemCount'
  | 'totalCostSatang'
  | 'profitSatang'
  | 'profitMarginPercent'
  | 'status'

const saleSortLabels: Record<SaleSortKey, string> = {
  receiptNumber: 'เลขที่ใบเสร็จ',
  soldAt: 'วันที่/เวลา',
  totalSatang: 'ยอดขาย',
  itemCount: 'จำนวนชิ้น',
  totalCostSatang: 'ต้นทุน',
  profitSatang: 'กำไร',
  profitMarginPercent: 'กำไร%',
  status: 'สถานะ',
}

function receiptItemCount(sale: ApiSale | ApiSaleSummary) {
  return sale.itemCount ?? sale.items?.reduce((total, item) => total + item.quantity, 0) ?? 0
}

function receiptCostSatang(sale: ApiSale | ApiSaleSummary) {
  return sale.totalCostSatang ?? sale.items?.reduce(
    (total, item) =>
      total + (item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity),
    0,
  ) ?? 0
}

function receiptProfitSatang(sale: ApiSale | ApiSaleSummary) {
  return sale.profitSatang ?? sale.totalSatang - receiptCostSatang(sale)
}

function receiptProfitMarginPercent(sale: ApiSale | ApiSaleSummary) {
  const costSatang = receiptCostSatang(sale)
  return sale.profitMarginPercent ?? (costSatang > 0
    ? Number(((receiptProfitSatang(sale) / costSatang) * 100).toFixed(2))
    : 0)
}

function receiptStatusText(sale: ApiSale | ApiSaleSummary) {
  return sale.status === 'void' ? 'ยกเลิกแล้ว' : 'ขายสำเร็จ'
}

function apiSaleToSummary(sale: ApiSale): ApiSaleSummary {
  const itemCount = sale.status === 'void' ? 0 : sale.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalCostSatang = sale.status === 'void'
    ? 0
    : sale.items.reduce((sum, item) =>
      sum + (item.totalCostSatang ?? (item.unitCostSatang ?? 0) * item.quantity), 0)
  const profitSatang = sale.status === 'void' ? 0 : sale.totalSatang - totalCostSatang

  return {
    ...sale,
    itemCount,
    lineItemCount: sale.status === 'void' ? 0 : sale.items.length,
    totalCostSatang,
    profitSatang,
    profitMarginPercent: totalCostSatang > 0
      ? Number(((profitSatang / totalCostSatang) * 100).toFixed(2))
      : 0,
  }
}

export function ReceiptListPage() {
  const session = readSession()
  const [receiptPage, setReceiptPage] = useState<PaginatedApiResponse<ApiSaleSummary> | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSale, setSelectedSale] = useState<ApiSale | null>(null)
  const [currentStore, setCurrentStore] = useState<CurrentStore>({ name: 'POS Grocery' })
  const [message, setMessage] = useState('กำลังโหลดใบเสร็จ')
  const [sortKey, setSortKey] = useState<SaleSortKey>('soldAt')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending')
  const sales = receiptPage?.items ?? []
  const canManageReceipt = session?.user.role === 'super_admin'

  useEffect(() => {
    let active = true

    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(receiptPageSize),
      sort: sortKey,
      direction: sortDirection === 'ascending' ? 'asc' : 'desc',
    })
    apiGet<PaginatedApiResponse<ApiSaleSummary>>(`/sales?${params.toString()}`)
      .then((nextPage) => {
        if (active) {
          setReceiptPage(nextPage)
          setMessage('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดใบเสร็จไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [currentPage, sortKey, sortDirection])

  function changeSort(key: SaleSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'ascending' ? 'descending' : 'ascending'))
    } else {
      setSortKey(key)
      setSortDirection('ascending')
    }
    setCurrentPage(1)
  }

  function updateSale(nextSale: ApiSale) {
    setReceiptPage((current) => current
      ? {
        ...current,
        items: current.items.map((sale) => (sale.id === nextSale.id ? apiSaleToSummary(nextSale) : sale)),
      }
      : current)
    setSelectedSale(nextSale)
  }

  async function openSaleDetail(sale: ApiSaleSummary) {
    setMessage('')
    try {
      const [saleDetail, storeDetail] = await Promise.all([
        apiGet<ApiSale>(`/sales/${sale.id}`),
        currentStore.logoUrl ? Promise.resolve(currentStore) : apiGet<CurrentStore>('/store/current?includeLogo=true'),
      ])

      setCurrentStore({
        address: storeDetail.address,
        name: storeDetail.name || 'POS Grocery',
        logoUrl: storeDetail.logoUrl,
        phone: storeDetail.phone,
      })
      setSelectedSale(saleDetail)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'โหลดรายละเอียดบิลไม่สำเร็จ')
    }
  }

  async function cancelSale(sale: ApiSale) {
    if (!canManageReceipt || sale.status === 'void') {
      return
    }

    const readableReceiptNumber = displayReceiptNumber(sale.receiptNumber)
    const { isConfirmed } = await confirmAction({
      confirmText: 'ยืนยันยกเลิก',
      text: `บิล ${readableReceiptNumber} จะถูกยกเลิกและคืน stock กลับเข้าคลัง`,
      title: 'ยืนยันยกเลิกบิล',
      tone: 'danger',
    })

    if (!isConfirmed) {
      return
    }

    try {
      updateSale(await apiPost<ApiSale>(`/sales/${sale.id}/cancel`, {}))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ยกเลิกบิลไม่สำเร็จ')
    }
  }

  async function activateSale(sale: ApiSale) {
    if (!canManageReceipt || sale.status !== 'void') {
      return
    }

    const readableReceiptNumber = displayReceiptNumber(sale.receiptNumber)
    const { isConfirmed } = await confirmAction({
      confirmText: 'ยืนยัน Active',
      text: `บิล ${readableReceiptNumber} จะกลับมาเป็นบิลขายสำเร็จและตัด stock อีกครั้ง`,
      title: 'ยืนยัน Active ใบเสร็จ',
      tone: 'success',
    })

    if (!isConfirmed) {
      return
    }

    try {
      updateSale(await apiPost<ApiSale>(`/sales/${sale.id}/activate`, {}))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Active ใบเสร็จไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="receipts-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="receipts-title">ประวัติใบเสร็จ</h1>
        </div>
      </div>
      <section className="panel">
        {sales.length ? (
          <>
            <div className="table-wrap receipt-history-table-wrap">
              <table className="receipt-history-table" aria-label="ตารางประวัติใบเสร็จ">
                <thead>
                  <tr>
                    <th scope="col">ลำดับ</th>
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.receiptNumber}
                      direction={sortDirection}
                      sortKey="receiptNumber"
                      onSort={changeSort}
                      label="เลขที่ใบเสร็จ"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.soldAt}
                      direction={sortDirection}
                      sortKey="soldAt"
                      onSort={changeSort}
                      label="วันที่/เวลา"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.totalSatang}
                      direction={sortDirection}
                      sortKey="totalSatang"
                      onSort={changeSort}
                      label="ยอดขาย"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.itemCount}
                      direction={sortDirection}
                      sortKey="itemCount"
                      onSort={changeSort}
                      label="จำนวนชิ้น"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.totalCostSatang}
                      direction={sortDirection}
                      sortKey="totalCostSatang"
                      onSort={changeSort}
                      label="ต้นทุน"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.profitSatang}
                      direction={sortDirection}
                      sortKey="profitSatang"
                      onSort={changeSort}
                      label="กำไร"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.profitMarginPercent}
                      direction={sortDirection}
                      sortKey="profitMarginPercent"
                      onSort={changeSort}
                      label="กำไร%"
                    />
                    <SortableTableHeader
                      activeSortKey={sortKey}
                      ariaLabel={saleSortLabels.status}
                      direction={sortDirection}
                      sortKey="status"
                      onSort={changeSort}
                      label="สถานะ"
                    />
                    <th scope="col">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => {
                    const dateTime = receiptDateTimeParts(sale.soldAt)
                    const readableReceiptNumber = displayReceiptNumber(sale.receiptNumber)
                    return (
                      <tr key={sale.id}>
                        <td>{formatNumber(((receiptPage?.page ?? currentPage) - 1) * (receiptPage?.pageSize ?? receiptPageSize) + index + 1)}</td>
                        <td>
                          <button
                            className="receipt-table-link receipt-link-button"
                            type="button"
                            onClick={() => void openSaleDetail(sale)}
                          >
                            {readableReceiptNumber}
                          </button>
                        </td>
                        <td>
                          <div className="receipt-history-date-time">
                            <span className="receipt-history-date">{dateTime.date}</span>
                            <span className="receipt-history-time">{dateTime.time}</span>
                          </div>
                        </td>
                        <td>
                          <strong>{bahtFromSatang(sale.totalSatang)} บาท</strong>
                        </td>
                        <td>{formatNumber(receiptItemCount(sale))} ชิ้น</td>
                        <td>{bahtFromSatang(receiptCostSatang(sale))} บาท</td>
                        <td>{bahtFromSatang(receiptProfitSatang(sale))} บาท</td>
                        <td>{formatPercent(receiptProfitMarginPercent(sale))}</td>
                        <td>
                          <span
                            className={
                              sale.status === 'void'
                                ? 'receipt-status-pill receipt-status-pill-void'
                                : 'receipt-status-pill'
                            }
                          >
                            {receiptStatusText(sale)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="receipt-detail-link"
                            type="button"
                            onClick={() => void openSaleDetail(sale)}
                            aria-label={`ดูรายละเอียดบิล ${readableReceiptNumber}`}
                          >
                            ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalItems={receiptPage?.total ?? 0}
              pageSize={receiptPage?.pageSize ?? receiptPageSize}
              onPageChange={setCurrentPage}
            />
          </>
        ) : (
          <p>{message || 'ยังไม่มีบิลล่าสุด'}</p>
        )}
      </section>
      {selectedSale ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="receipt-history-detail-title"
            aria-modal="true"
            className="modal-panel receipt-modal"
            role="dialog"
          >
            <div className="modal-header">
              <h2 id="receipt-history-detail-title">รายละเอียดบิล {displayReceiptNumber(selectedSale.receiptNumber)}</h2>
              <button className="ghost-button compact" type="button" onClick={() => setSelectedSale(null)}>
                ปิด
              </button>
            </div>
            <ReceiptPaper
              cashReceivedSatang={selectedSale.cashReceivedSatang}
              changeDueSatang={selectedSale.changeDueSatang}
              items={selectedSale.items}
              receiptNumber={selectedSale.receiptNumber}
              soldAt={selectedSale.soldAt}
              status={selectedSale.status}
              storeAddress={currentStore.address}
              storeLogoUrl={currentStore.logoUrl}
              storeName={currentStore.name}
              storePhone={currentStore.phone}
              totalSatang={selectedSale.totalSatang}
            />
            <div className="modal-actions">
              <button className="info-button compact no-print" type="button" onClick={() => window.print()}>
                พิมพ์ใบเสร็จ
              </button>
              {canManageReceipt && selectedSale.status === 'completed' ? (
                <button
                  className="danger-button compact"
                  type="button"
                  onClick={() => void cancelSale(selectedSale)}
                >
                  ยกเลิกบิล {displayReceiptNumber(selectedSale.receiptNumber)}
                </button>
              ) : null}
              {canManageReceipt && selectedSale.status === 'void' ? (
                <button
                  className="success-button compact"
                  type="button"
                  onClick={() => void activateSale(selectedSale)}
                >
                  Active ใบเสร็จ {displayReceiptNumber(selectedSale.receiptNumber)}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
