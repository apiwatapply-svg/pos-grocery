const storeFields = {
  name: 'POS Grocery',
  phone: '0800000000',
  address: 'Bangkok',
  ownerName: 'admin',
}

export function StoreSettingsPage() {
  return (
    <section className="settings-panel" aria-labelledby="store-settings-title">
      <div>
        <p className="eyebrow">Store settings</p>
        <h2 id="store-settings-title">ข้อมูลร้านค้า</h2>
      </div>

      <dl className="settings-list">
        <div>
          <dt>ชื่อร้าน</dt>
          <dd>{storeFields.name}</dd>
        </div>
        <div>
          <dt>เบอร์โทร</dt>
          <dd>{storeFields.phone}</dd>
        </div>
        <div>
          <dt>ที่อยู่</dt>
          <dd>{storeFields.address}</dd>
        </div>
        <div>
          <dt>เจ้าของร้าน</dt>
          <dd>{storeFields.ownerName}</dd>
        </div>
      </dl>
    </section>
  )
}
