import { type FormEvent, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { apiGet, apiPatch } from '../../lib/api/client'

type Store = {
  id: string
  name: string
  phone: string
  address: string
  ownerName: string
  status: 'active' | 'inactive'
}

type StoreForm = Pick<Store, 'name' | 'phone' | 'address' | 'ownerName' | 'status'>

const emptyForm: StoreForm = {
  name: '',
  phone: '',
  address: '',
  ownerName: '',
  status: 'active',
}

export function StoreSettingsPage() {
  const [store, setStore] = useState<Store | null>(null)
  const [form, setForm] = useState<StoreForm>(emptyForm)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState('กำลังโหลดข้อมูลร้าน')

  useEffect(() => {
    let active = true

    apiGet<Store>('/store/current')
      .then((nextStore) => {
        if (active) {
          setStore(nextStore)
          setForm({
            name: nextStore.name,
            phone: nextStore.phone,
            address: nextStore.address,
            ownerName: nextStore.ownerName,
            status: nextStore.status,
          })
          setMessage('')
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

  function resetForm() {
    if (!store) {
      setForm(emptyForm)
      return
    }

    setForm({
      name: store.name,
      phone: store.phone,
      address: store.address,
      ownerName: store.ownerName,
      status: store.status,
    })
    setIsEditing(false)
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'บันทึก',
      icon: 'question',
      showCancelButton: true,
      text: 'ข้อมูลร้านจะถูกอัปเดตในฐานข้อมูลและมีผลกับใบเสร็จใหม่',
      title: 'ยืนยันบันทึกข้อมูลร้าน',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      const updated = await apiPatch<Store>('/store/current', form)
      setStore(updated)
      setForm({
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
        ownerName: updated.ownerName,
        status: updated.status,
      })
      setIsEditing(false)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกข้อมูลร้านไม่สำเร็จ')
    }
  }

  async function changeStoreStatus(status: Store['status']) {
    const isDeactivate = status === 'inactive'
    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: isDeactivate ? '#b42318' : '#15803d',
      confirmButtonText: isDeactivate ? 'ปิดใช้งาน' : 'เปิดใช้งาน',
      icon: 'warning',
      showCancelButton: true,
      text: isDeactivate
        ? 'ร้านจะถูกตั้งสถานะ inactive และควรเปิดใช้งานอีกครั้งก่อนใช้งานจริง'
        : 'ร้านจะกลับมาอยู่ในสถานะ active',
      title: isDeactivate ? 'ยืนยันปิดใช้งานร้าน' : 'ยืนยันเปิดใช้งานร้าน',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      const updated = await apiPatch<Store>('/store/current', { status })
      setStore(updated)
      setForm({
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
        ownerName: updated.ownerName,
        status: updated.status,
      })
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เปลี่ยนสถานะร้านไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="store-settings-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Store settings</p>
          <h1 id="store-settings-title">ตั้งค่าร้าน</h1>
        </div>
        <div className="page-actions">
          <button className="info-button compact" onClick={() => setIsEditing(true)} type="button">
            แก้ไขข้อมูลร้าน
          </button>
          <button
            className={store?.status === 'inactive' ? 'success-button compact' : 'danger-button compact'}
            disabled={!store}
            onClick={() => void changeStoreStatus(store?.status === 'inactive' ? 'active' : 'inactive')}
            type="button"
          >
            {store?.status === 'inactive' ? 'เปิดใช้งานร้าน' : 'ปิดใช้งานร้าน'}
          </button>
        </div>
      </div>

      <section className="panel store-crud-panel" aria-label="CRUD ข้อมูลร้าน">
        <div>
          <h2>ข้อมูลร้าน</h2>
          <p>จัดการชื่อร้าน เบอร์โทร ที่อยู่ เจ้าของร้าน และสถานะร้าน</p>
        </div>
        <div className="store-crud-summary">
          <div>
            <span>สถานะร้าน</span>
            <strong>{store?.status ?? '-'}</strong>
          </div>
          <div>
            <span>Store ID</span>
            <strong>{store?.id ?? '-'}</strong>
          </div>
        </div>

        {message ? <p className="form-message">{message}</p> : null}

        <form className="store-crud-form" onSubmit={(event) => void saveStore(event)}>
          <label className="field">
            <span>ชื่อร้าน</span>
            <input
              aria-label="ชื่อร้าน"
              disabled={!isEditing}
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </label>
          <label className="field">
            <span>เบอร์โทร</span>
            <input
              aria-label="เบอร์โทร"
              disabled={!isEditing}
              required
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </label>
          <label className="field">
            <span>เจ้าของร้าน</span>
            <input
              aria-label="เจ้าของร้าน"
              disabled={!isEditing}
              required
              value={form.ownerName}
              onChange={(event) => updateField('ownerName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>สถานะ</span>
            <select
              aria-label="สถานะ"
              disabled={!isEditing}
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label className="field store-address-field">
            <span>ที่อยู่</span>
            <textarea
              aria-label="ที่อยู่"
              disabled={!isEditing}
              required
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
            />
          </label>
          <div className="store-crud-actions">
            <button className="ghost-button compact" disabled={!isEditing} onClick={resetForm} type="button">
              ยกเลิก
            </button>
            <button className="success-button compact" disabled={!isEditing} type="submit">
              บันทึกข้อมูลร้าน
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}
