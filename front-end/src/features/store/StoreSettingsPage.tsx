import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api/client'

type Store = {
  id: string
  name: string
  phone: string
  address: string
  ownerName: string
  status: 'active' | 'inactive'
}

export function StoreSettingsPage() {
  const [store, setStore] = useState<Store | null>(null)
  const [message, setMessage] = useState('กำลังโหลดข้อมูลร้าน')

  useEffect(() => {
    let active = true

    apiGet<Store>('/stores/current')
      .then((nextStore) => {
        if (active) {
          setStore(nextStore)
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

  return (
    <section className="settings-panel" aria-labelledby="store-settings-title">
      <div>
        <p className="eyebrow">Store settings</p>
        <h2 id="store-settings-title">ตั้งค่าร้าน</h2>
      </div>

      <dl className="settings-list">
        <div>
          <dt>ชื่อร้าน</dt>
          <dd>{store?.name ?? message}</dd>
        </div>
        <div>
          <dt>เบอร์โทร</dt>
          <dd>{store?.phone ?? '-'}</dd>
        </div>
        <div>
          <dt>ที่อยู่</dt>
          <dd>{store?.address ?? '-'}</dd>
        </div>
        <div>
          <dt>เจ้าของร้าน</dt>
          <dd>{store?.ownerName ?? '-'}</dd>
        </div>
      </dl>
    </section>
  )
}
