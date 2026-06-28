import { type ReactNode, useEffect, useState } from 'react'
import { baht, writeCustomerDisplayPayload } from './customerDisplay'

type Product = {
  id: string
  name: string
  barcode: string
  salePrice: number
  stockQuantity: number
  status: 'active' | 'inactive'
}

type CartItem = {
  productId: string
  productName: string
  barcode: string
  quantity: number
  unitPrice: number
}

type Sale = {
  receiptNumber: string
  items: CartItem[]
  total: number
  changeDue: number
}

const initialProducts: Product[] = [
  {
    id: 'product-water',
    name: 'Drinking Water',
    barcode: '8850002000010',
    salePrice: 7,
    stockQuantity: 24,
    status: 'active',
  },
  {
    id: 'product-noodle',
    name: 'Instant Noodles',
    barcode: '8850001000011',
    salePrice: 12,
    stockQuantity: 18,
    status: 'active',
  },
]

function Field(props: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

export function PosCheckoutPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState('8850002000010')
  const [saleQuantity, setSaleQuantity] = useState(1)
  const [cashReceived, setCashReceived] = useState(100)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [notice, setNotice] = useState('พร้อมขาย')

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  useEffect(() => {
    writeCustomerDisplayPayload({
      store: { name: 'POS Grocery' },
      cart,
      cartTotal,
      lastSale,
    })
  }, [cart, cartTotal, lastSale])

  function addScannedItem() {
    const product = products.find((item) => item.barcode === barcode && item.status === 'active')
    if (!product) {
      setNotice('ไม่พบสินค้า')
      return
    }
    if (product.stockQuantity < saleQuantity) {
      setNotice('stock ไม่พอ')
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + saleQuantity }
            : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: saleQuantity,
          unitPrice: product.salePrice,
        },
      ]
    })
    setNotice(`${product.name} added`)
  }

  function checkout() {
    if (cart.length === 0) {
      setNotice('ตะกร้ายังว่าง')
      return
    }
    if (cashReceived < cartTotal) {
      setNotice('รับเงินไม่พอ')
      return
    }

    setProducts((current) =>
      current.map((product) => {
        const item = cart.find((line) => line.productId === product.id)
        return item ? { ...product, stockQuantity: product.stockQuantity - item.quantity } : product
      }),
    )

    const sale: Sale = {
      receiptNumber: `RC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      items: cart,
      total: cartTotal,
      changeDue: cashReceived - cartTotal,
    }
    setLastSale(sale)
    setCart([])
    setNotice('ขายสำเร็จ')
  }

  return (
    <section className="route-page" aria-labelledby="pos-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h1 id="pos-title">ขายสินค้า / Scan barcode</h1>
        </div>
        <div className="status-pill">{notice}</div>
      </div>

      <div className="operations-grid">
        <section className="panel pos-panel" aria-labelledby="checkout-title">
          <h2 id="checkout-title">Checkout</h2>
          <div className="scan-grid">
            <Field label="Barcode">
              <input value={barcode} onChange={(event) => setBarcode(event.target.value)} />
            </Field>
            <Field label="จำนวนขาย">
              <input
                min="1"
                type="number"
                value={saleQuantity}
                onChange={(event) => setSaleQuantity(Number(event.target.value))}
              />
            </Field>
            <button className="success-button" type="button" onClick={addScannedItem}>
              เพิ่มลงตะกร้า
            </button>
          </div>
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.productId}>
                <span>{item.productName}</span>
                <strong>
                  {item.quantity} x {baht(item.unitPrice)}
                </strong>
              </div>
            ))}
          </div>
          <p className="total-line">ยอดรวม {baht(cartTotal)} บาท</p>
          <Field label="รับเงินสด">
            <input
              min="0"
              type="number"
              value={cashReceived}
              onChange={(event) => setCashReceived(Number(event.target.value))}
            />
          </Field>
          <button className="primary-button" type="button" onClick={checkout}>
            ชำระเงิน
          </button>
        </section>

        <section className="panel receipt-panel" aria-labelledby="receipt-title">
          <h2 id="receipt-title">ใบเสร็จ</h2>
          {lastSale ? (
            <>
              <div className="receipt-paper">
                <strong>POS Grocery</strong>
                <span>{lastSale.receiptNumber}</span>
                {lastSale.items.map((item) => (
                  <span key={item.productId}>
                    {item.productName} x{item.quantity} = {baht(item.quantity * item.unitPrice)}
                  </span>
                ))}
                <strong>ยอดรวม {baht(lastSale.total)} บาท</strong>
                <strong>เงินทอน {baht(lastSale.changeDue)} บาท</strong>
              </div>
              <button className="info-button" type="button" onClick={() => window.print()}>
                Print receipt
              </button>
            </>
          ) : (
            <p>ยังไม่มีบิลล่าสุด</p>
          )}
        </section>

        <section className="panel" aria-labelledby="stock-after-sale-title">
          <h2 id="stock-after-sale-title">Stock หลังขาย</h2>
          {products.map((product) => (
            <p key={product.id}>
              {product.name}: <span>คงเหลือ {product.stockQuantity}</span>
            </p>
          ))}
        </section>
      </div>
    </section>
  )
}
