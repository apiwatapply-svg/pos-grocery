import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { Select, type SelectOption } from '../../components/ui/Select'
import { apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'
import { confirmAction } from '../../lib/ui/confirm'
import { compressImageFile, logoImageCompression } from '../../lib/images/imageCompression'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { useSortableTable } from '../shared/useSortableTable'

type Store = {
  id: string
  name: string
  phone: string
  address: string
  ownerName: string
  logoUrl?: string
  status: 'active' | 'inactive'
}

type StoreForm = Pick<Store, 'name' | 'phone' | 'address' | 'ownerName' | 'logoUrl' | 'status'>

const emptyForm: StoreForm = {
  name: '',
  phone: '',
  address: '',
  ownerName: '',
  logoUrl: '',
  status: 'active',
}

type StoreSortKey = 'name' | 'phone' | 'ownerName' | 'status' | 'id'

function formFromStore(store: Store): StoreForm {
  return {
    name: store.name,
    phone: store.phone,
    address: store.address,
    ownerName: store.ownerName,
    logoUrl: store.logoUrl ?? '',
    status: store.status,
  }
}

export function StoreSettingsPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [form, setForm] = useState<StoreForm>(emptyForm)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [message, setMessage] = useState('กำลังโหลดข้อมูลร้าน')
  const pendingLogoUrlRef = useRef<Promise<string> | null>(null)
  const { sortKey, direction, setSortKey, sortedRows } = useSortableTable<Store, StoreSortKey>(stores, {
    initialKey: 'id',
    columns: {
      name: { get: (store) => store.name },
      phone: { get: (store) => store.phone },
      ownerName: { get: (store) => store.ownerName },
      status: { get: (store) => store.status },
      id: { get: (store) => store.id },
    },
  })

  const activeStoreCount = stores.filter((store) => store.status === 'active').length
  const inactiveStoreCount = stores.filter((store) => store.status === 'inactive').length

  useEffect(() => {
    let active = true

    apiGet<Store[]>('/store')
      .then((nextStores) => {
        if (active) {
          setStores(nextStores)
          setMessage(nextStores.length > 0 ? '' : 'ยังไม่มีร้านค้าในระบบ')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดข้อมูลร้านไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  function updateField(field: keyof StoreForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: field === 'status' && value === 'inactive' ? 'inactive' : value,
    }))
  }

  const storeStatusOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'active', label: 'เปิดใช้งาน (active)' },
      { value: 'inactive', label: 'ปิดใช้งาน (inactive)' },
    ],
    [],
  )

  async function updateLogoFile(file: File | null) {
    if (!file) {
      return
    }

    try {
      const pendingLogoUrl = compressImageFile(file, logoImageCompression).then((image) => image.dataUri)
      pendingLogoUrlRef.current = pendingLogoUrl
      const logoUrl = await pendingLogoUrl
      if (pendingLogoUrlRef.current === pendingLogoUrl) {
        pendingLogoUrlRef.current = null
      }
      setForm((current) => ({ ...current, logoUrl }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'อ่านไฟล์ Logo ไม่สำเร็จ')
    }
  }

  function openCreateModal() {
    setEditingStore(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  function openEditModal(store: Store) {
    setEditingStore(store)
    setForm(formFromStore(store))
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingStore(null)
    setForm(emptyForm)
    setIsModalOpen(false)
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const isEditing = Boolean(editingStore)
    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'บันทึก',
      icon: 'question',
      showCancelButton: true,
      text: isEditing
        ? 'ข้อมูลร้านจะถูกอัปเดตในฐานข้อมูลและมีผลกับผู้ใช้ร้านนั้น'
        : 'ระบบจะเพิ่มร้านใหม่ในฐานข้อมูลเพื่อรองรับผู้ใช้ของร้านนั้น',
      title: isEditing ? 'ยืนยันแก้ไขร้านค้า' : 'ยืนยันเพิ่มร้านค้า',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      const formToSave = {
        ...form,
        logoUrl: pendingLogoUrlRef.current ? await pendingLogoUrlRef.current : form.logoUrl,
      }
      pendingLogoUrlRef.current = null
      const savedStore = editingStore
        ? await apiPatch<Store>(`/store/${editingStore.id}`, formToSave)
        : await apiPost<Store>('/store', formToSave)

      setStores((current) => {
        if (!editingStore) {
          return [...current, savedStore]
        }

        return current.map((store) => (store.id === savedStore.id ? savedStore : store))
      })
      setMessage('')
      closeModal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกข้อมูลร้านไม่สำเร็จ')
    }
  }

  async function changeStoreStatus(store: Store) {
    const nextStatus = store.status === 'inactive' ? 'active' : 'inactive'
    const isDeactivate = nextStatus === 'inactive'
    const { isConfirmed } = await confirmAction({
      confirmText: isDeactivate ? 'ปิดใช้งาน' : 'เปิดใช้งาน',
      text: isDeactivate
        ? `ร้าน ${store.name} จะถูกตั้งเป็น inactive และไม่ควรใช้งานขายหน้าร้านจนกว่าจะเปิดกลับมา`
        : `ร้าน ${store.name} จะกลับมาอยู่ในสถานะ active`,
      title: isDeactivate ? 'ยืนยันปิดใช้งานร้าน' : 'ยืนยันเปิดใช้งานร้าน',
      tone: isDeactivate ? 'danger' : 'success',
    })

    if (!isConfirmed) {
      return
    }

    try {
      const updated = await apiPatch<Store>(`/store/${store.id}`, { status: nextStatus })
      setStores((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)))
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เปลี่ยนสถานะร้านไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="store-settings-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Store management</p>
          <h1 id="store-settings-title">จัดการร้านค้า</h1>
        </div>
        <div className="page-actions">
          <button className="success-button compact" onClick={openCreateModal} type="button">
            เพิ่มร้านค้า
          </button>
        </div>
      </div>

      <section className="store-admin-summary store-admin-summary-full" aria-label="สรุปร้านค้า">
        <div className="store-summary-card store-summary-card-blue">
          <span>ร้านทั้งหมด</span>
          <strong>{formatNumber(stores.length)}</strong>
          <small>ทุกสาขาในระบบ</small>
        </div>
        <div className="store-summary-card store-summary-card-green">
          <span>เปิดใช้งาน</span>
          <strong>{formatNumber(activeStoreCount)}</strong>
          <small>พร้อมผูกผู้ใช้และขายสินค้า</small>
        </div>
        <div className="store-summary-card store-summary-card-red">
          <span>ปิดใช้งาน</span>
          <strong>{formatNumber(inactiveStoreCount)}</strong>
          <small>พักใช้งานหรือหยุดขาย</small>
        </div>
      </section>

      <section className="panel store-admin-panel" aria-label="CRUD ร้านค้าสำหรับ Admin">
        <div className="store-admin-panel-header">
          <div>
            <h2>รายการร้านค้า</h2>
            <p>เพิ่ม แก้ไข และเปิด/ปิดสถานะร้าน เพื่อรองรับผู้ใช้หลายร้าน</p>
          </div>
        </div>

        {message ? <p className="form-message">{message}</p> : null}

        <div className="table-wrap">
          <table className="store-admin-table">
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">Logo</th>
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={direction}
                  sortKey="name"
                  onSort={setSortKey}
                  label="ชื่อร้าน"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={direction}
                  sortKey="phone"
                  onSort={setSortKey}
                  label="เบอร์โทร"
                />
                <th scope="col">ที่อยู่</th>
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={direction}
                  sortKey="ownerName"
                  onSort={setSortKey}
                  label="เจ้าของร้าน"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={direction}
                  sortKey="status"
                  onSort={setSortKey}
                  label="สถานะ"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={direction}
                  sortKey="id"
                  onSort={setSortKey}
                  label="Store ID"
                />
                <th scope="col">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length > 0 ? sortedRows.map((store, index) => (
                <tr key={store.id}>
                  <td>{formatNumber(index + 1)}</td>
                  <td>
                    {store.logoUrl ? (
                      <img className="store-logo-thumb" src={store.logoUrl} alt={`Logo ${store.name}`} />
                    ) : (
                      <span aria-hidden="true" className="store-logo-empty">ไม่มี Logo</span>
                    )}
                  </td>
                  <td>
                    <strong>{store.name}</strong>
                  </td>
                  <td>{store.phone}</td>
                  <td>{store.address}</td>
                  <td>{store.ownerName}</td>
                  <td>
                    <span className={store.status === 'active' ? 'status-pill success' : 'status-pill danger'}>
                      {store.status}
                    </span>
                  </td>
                  <td>
                    <code>{store.id}</code>
                  </td>
                  <td>
                    <div className="table-action-row">
                      <button className="info-button compact" onClick={() => openEditModal(store)} type="button">
                        แก้ไข
                      </button>
                      <button
                        aria-label={`${store.status === 'inactive' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} ${store.name}`}
                        className={store.status === 'inactive' ? 'success-button compact' : 'danger-button compact'}
                        onClick={() => void changeStoreStatus(store)}
                        type="button"
                      >
                        {store.status === 'inactive' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9}>{message || 'ยังไม่มีร้านค้าในระบบ'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="store-modal-title"
            aria-modal="true"
            className="modal-panel store-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="store-modal-title">{editingStore ? 'แก้ไขร้านค้า' : 'เพิ่มร้านค้าใหม่'}</h2>
                <p>{editingStore ? editingStore.id : 'สร้างร้านใหม่สำหรับผูกผู้ใช้และข้อมูล POS แยกสาขา'}</p>
              </div>
              <button className="ghost-button compact" onClick={closeModal} type="button">
                ปิด
              </button>
            </div>
            <form className="modal-form store-modal-form" onSubmit={(event) => void saveStore(event)}>
              <label className="field">
                <span>ชื่อร้าน</span>
                <input
                  aria-label="ชื่อร้าน"
                  required
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </label>
              <label className="field">
                <span>เบอร์โทร</span>
                <input
                  aria-label="เบอร์โทร"
                  required
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>
              <label className="field">
                <span>เจ้าของร้าน</span>
                <input
                  aria-label="เจ้าของร้าน"
                  required
                  value={form.ownerName}
                  onChange={(event) => updateField('ownerName', event.target.value)}
                />
              </label>
              <label className="field">
                <span>สถานะร้าน</span>
                <Select
                  ariaLabel="สถานะร้าน"
                  options={storeStatusOptions}
                  value={form.status}
                  onChange={(value) => updateField('status', value)}
                />
              </label>
              <label className="field store-logo-field">
                <span>Logo ร้านค้า</span>
                <input
                  aria-label="Logo ร้านค้า"
                  accept="image/*"
                  type="file"
                  onChange={(event) => void updateLogoFile(event.target.files?.[0] ?? null)}
                />
                {form.logoUrl ? (
                  <img className="store-logo-preview" src={form.logoUrl} alt="ตัวอย่าง Logo ร้านค้า" />
                ) : (
                  <small>เลือกรูป Logo ร้านค้าเพื่อใช้บนหน้าร้านและใบเสร็จ</small>
                )}
              </label>
              <label className="field store-address-field">
                <span>ที่อยู่</span>
                <textarea
                  aria-label="ที่อยู่"
                  required
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button className="ghost-button compact" onClick={closeModal} type="button">
                  ยกเลิก
                </button>
                <button className="success-button compact" type="submit">
                  บันทึกร้านค้า
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
