# PRD: POS Grocery

## 1. ภาพรวมผลิตภัณฑ์

POS Grocery คือระบบ Point of Sale สำหรับร้านขายของชำหรือมินิมาร์ทขนาดเล็กถึงกลาง
ที่ต้องการขายสินค้าแบบรวดเร็วคล้ายร้านสะดวกซื้อ เช่น 7-11 โดยรองรับการจัดการร้านค้า
ผู้ใช้ สินค้า สต็อก การรับสินค้าเข้า การขายผ่านการสแกน barcode การออกบิล รายงาน
dashboard และการ export Excel ที่จัดรูปแบบสวยงามพร้อมใช้งาน

เอกสารนี้ใช้ requirement ล่าสุดจากผู้ใช้เป็นแหล่งอ้างอิงหลัก โดยกำหนดให้
Turso/libSQL เป็นฐานข้อมูลหลัก แทนข้อมูลเก่าที่เคยระบุ MSSQL ในกฎโปรเจกต์เดิม

## 2. เป้าหมาย

- ทำให้ร้านค้าสามารถเปิดขายสินค้า รับเงิน ออกบิล และตัดสต็อกได้จากระบบเดียว
- ลดงาน manual ในการตรวจนับสินค้าและสรุปยอดขาย
- ให้เจ้าของร้านเห็นยอดขาย สินค้าขายดี กำไรเบื้องต้น และช่วงเวลาขายดี
- รองรับการใช้งานบนคอมพิวเตอร์ มือถือ iPad และแท็บเล็ตทุกขนาด
- สร้าง codebase ที่พร้อม CI/CD และมี unit test ตั้งแต่เริ่มต้น
- ใช้บริการที่เริ่มต้นได้ฟรีและไม่ต้องผูกบัตรเครดิตสำหรับ MVP

## 3. ขอบเขต MVP

### อยู่ในขอบเขต

- จัดการข้อมูลร้านค้า
- จัดการผู้ใช้และการเข้าสู่ระบบ
- จัดการสินค้า รูปสินค้า barcode ราคาต้นทุน ราคาขาย และจำนวนคงเหลือ
- รับสินค้าเข้า store และบันทึก movement ของสต็อก
- ขายสินค้าด้วย barcode scanner หรือการค้นหาสินค้า
- ตัดสต็อกเมื่อขายสำเร็จ
- ออกบิลหรือใบเสร็จ
- รายงานยอดขายรายวัน รายเดือน และช่วงวันที่เลือก
- Dashboard แสดงยอดขาย สินค้าขายดี และช่วงเวลาขายดี
- Export Excel สำหรับ inventory และรายงาน โดยต้องมีหัวตาราง เส้นตาราง และการจัดรูปแบบอ่านง่าย
- Responsive UI สำหรับ desktop, mobile, iPad และ tablet
- CI/CD สำหรับ frontend และ backend
- Unit test สำหรับ business logic สำคัญ
- การเก็บรูปสินค้าจริงด้วย Cloudinary Free โดยไม่ต้องใช้บริการ storage ที่ต้องเปิด billing หรือผูกบัตรเครดิต

### ยังไม่อยู่ใน MVP

- หลายสาขาแบบเต็มรูปแบบ
- ระบบสมาชิกและสะสมแต้ม
- โปรโมชั่นซับซ้อน เช่น ซื้อ 2 แถม 1 หรือราคาตามช่วงเวลา
- เชื่อมต่อเครื่องพิมพ์ thermal printer เฉพาะรุ่น
- เชื่อมต่อ payment gateway จริง
- ระบบบัญชีเต็มรูปแบบ
- Object storage แบบเสียเงินหรือบริการที่ต้องผูกบัตรเครดิต เช่น Cloudflare R2 ถ้าบัญชีร้องขอ billing

## 4. ผู้ใช้งานหลัก

### เจ้าของร้าน

- จัดการข้อมูลร้านและผู้ใช้
- ดูยอดขายและ dashboard
- ตรวจสินค้าคงเหลือ
- export รายงาน

### ผู้จัดการร้านหรือแอดมิน

- เพิ่มและแก้ไขสินค้า
- รับสินค้าเข้า store
- ตรวจสอบยอดขายและ inventory
- export Excel เพื่อใช้งานต่อ

### พนักงานขาย

- สแกน barcode เพื่อขายสินค้า
- แก้ไขจำนวนสินค้าในตะกร้า
- รับเงิน คำนวณเงินทอน และออกบิล
- เห็น error ที่ชัดเจนเมื่อ barcode ไม่พบหรือสินค้าไม่พอขาย

## 5. Tech Stack

### Frontend

- React + TypeScript
- Deploy บน Vercel
- Responsive UI สำหรับทุกขนาดหน้าจอ
- แยก presentation components, API clients และ state management ให้ชัดเจน

### Backend

- Node.js + Express
- โครงสร้างแบบ MVC
- Deploy บน Cloudflare
- API เป็น JSON-based REST API ใน MVP

### Database และ ORM

- Database: Turso/libSQL
- ORM: Prisma ORM v6
- ใช้ migration และ schema management ผ่าน Prisma

### CI/CD และ Quality

- GitHub Actions สำหรับ pull request และ main branch
- Frontend ต้องผ่าน lint, typecheck, unit test และ build
- Backend ต้องผ่าน lint, typecheck, unit test, Prisma validate/generate และ build/start check
- ทุก feature สำคัญต้องมี unit test

## 6. Functional Requirements

### 6.1 Store Management

ระบบต้องรองรับการจัดการข้อมูลร้านดังนี้:

- ชื่อร้าน
- เบอร์โทร
- ที่อยู่
- เจ้าของร้าน
- โลโก้ร้าน ถ้ามีในอนาคต
- สถานะร้าน เช่น active/inactive

Acceptance criteria:

- เจ้าของร้านหรือแอดมินสามารถสร้างและแก้ไขข้อมูลร้านได้
- ข้อมูลร้านถูกใช้บนใบเสร็จและรายงาน
- ระบบต้อง validate ข้อมูลที่จำเป็น เช่น ชื่อร้านและเบอร์โทร

### 6.2 User และ Authentication

ระบบต้องรองรับ:

- username
- password
- ชื่อผู้ใช้
- role เบื้องต้น
- สถานะ active/inactive

Role MVP:

- owner
- admin
- cashier
- stock

Acceptance criteria:

- ผู้ใช้ login ด้วย username และ password ได้
- password ต้องถูก hash ก่อนบันทึก
- ผู้ใช้ inactive ต้อง login ไม่ได้
- ระบบต้องจำกัดสิทธิ์ตาม role สำหรับหน้าที่สำคัญ

### 6.3 Product Catalog

ระบบต้องรองรับข้อมูลสินค้า:

- ชื่อสินค้า
- barcode หรือ product code
- SKU ภายในร้าน ถ้าต้องใช้
- หมวดหมู่สินค้า
- รูปสินค้า
- ราคาต้นทุน
- ราคาขาย
- จำนวนคงเหลือ
- หน่วยสินค้า เช่น ชิ้น แพ็ค ขวด กล่อง
- สถานะสินค้า เช่น active/inactive

Acceptance criteria:

- เพิ่ม แก้ไข ลบแบบ soft delete และค้นหาสินค้าได้
- barcode ต้องไม่ซ้ำในร้านเดียวกัน
- ราคาต้นทุนและราคาขายต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0
- รูปสินค้าต้องแสดงในหน้าจัดการสินค้าและหน้าขายเมื่อมีข้อมูล
- MVP ให้เก็บรูปสินค้าจริงใน Cloudinary Free และเก็บเฉพาะ URL/metadata ใน Turso/libSQL เพื่อไม่ให้ฐานข้อมูลโตเร็ว

### 6.4 Inventory และ Store Receiving

ระบบต้องรองรับการรับสินค้าเข้า store:

- เลือกสินค้า
- ใส่จำนวนรับเข้า
- ใส่ราคาต้นทุนต่อหน่วย
- บันทึกวันที่รับเข้า
- บันทึกผู้ทำรายการ
- เพิ่มหมายเหตุได้

ระบบ inventory ต้องบันทึก stock movement:

- receive
- sale
- adjustment
- return ใน Phase 2

Acceptance criteria:

- เมื่อรับสินค้าเข้า จำนวนคงเหลือต้องเพิ่มขึ้น
- ทุก movement ต้องมีประวัติย้อนหลัง
- แอดมินสามารถตรวจนับและปรับสต็อกได้ผ่าน adjustment
- ระบบต้องป้องกันจำนวนคงเหลือติดลบในการขายปกติ
- หน้า inventory ต้อง export Excel ได้

### 6.5 Sales และ Checkout

ระบบขายต้องรองรับ:

- scan barcode เพื่อเพิ่มสินค้าเข้าตะกร้า
- ค้นหาสินค้าด้วยชื่อหรือ barcode
- แก้ไขจำนวนสินค้าในตะกร้า
- ลบสินค้าออกจากตะกร้า
- แสดง subtotal, discount ในอนาคต, total
- รับเงินสด
- คำนวณเงินทอน
- ยืนยันการขาย
- ตัดสต็อกเมื่อขายสำเร็จ

Acceptance criteria:

- barcode scanner ที่ทำงานเหมือน keyboard input ต้องใช้งานได้
- ถ้าสินค้าไม่พบ ระบบต้องแสดง error ชัดเจน
- ถ้าจำนวนคงเหลือไม่พอ ระบบต้องห้ามขายและแจ้งจำนวนที่เหลือ
- เมื่อขายสำเร็จ ต้องสร้าง sale, sale items, payment และ inventory movements
- การขายต้องเป็น atomic operation: ถ้าบันทึกส่วนใดล้มเหลว ต้องไม่ตัดสต็อกค้างครึ่งทาง

### 6.6 Receipt และ Billing

ใบเสร็จต้องมี:

- เลขที่บิล
- ชื่อร้าน
- เบอร์โทรและที่อยู่ร้าน
- วันเวลา
- ชื่อพนักงานขาย
- รายการสินค้า จำนวน ราคาต่อหน่วย และราคารวม
- ยอดรวม
- เงินรับ
- เงินทอน

Acceptance criteria:

- หลังขายสำเร็จ ระบบต้องสร้างใบเสร็จทันที
- เลขที่บิลต้องไม่ซ้ำ
- ผู้ใช้สามารถเปิดดูใบเสร็จย้อนหลังได้
- MVP รองรับการพิมพ์ผ่าน browser print ก่อน

### 6.7 Reports

ระบบรายงานต้องรองรับ:

- ยอดขายรายวัน
- ยอดขายรายเดือน
- ยอดขายตามช่วงวันที่เลือก
- จำนวนบิล
- ยอดขายรวม
- ต้นทุนรวม
- กำไรขั้นต้นโดยประมาณ
- สินค้าขายดี
- export Excel

Acceptance criteria:

- ผู้ใช้เลือกช่วงวันที่เองได้
- รายงานต้องคำนวณจากรายการขายที่สำเร็จเท่านั้น
- รายงานต้องไม่รวมรายการที่ถูกยกเลิก
- Export Excel ต้องตรงกับข้อมูลที่แสดงบนหน้าจอ

### 6.8 Dashboard

Dashboard ต้องแสดง:

- ยอดขายวันนี้
- ยอดขายเดือนนี้
- จำนวนบิลวันนี้
- กำไรขั้นต้นโดยประมาณ
- สินค้าขายดีตามช่วงเวลาที่เลือก
- ช่วงเวลาขายดี เช่น รายชั่วโมงหรือช่วงวัน
- สินค้าใกล้หมด

Acceptance criteria:

- เลือกช่วงเวลาได้ เช่น วันนี้ เดือนนี้ หรือ custom range
- chart และ card ต้องอ่านง่ายบน desktop และ tablet
- บนมือถือ dashboard ต้องเรียงลำดับข้อมูลที่สำคัญก่อน
- ข้อมูล dashboard ต้อง refresh ได้โดยไม่ต้อง reload ทั้งหน้า

### 6.9 Excel Export

Export Excel ต้องรองรับ:

- Inventory list
- Sales report
- Best-selling product report
- Daily/monthly/custom range report

ข้อกำหนดการจัดรูปแบบ:

- มีชื่อรายงานด้านบน
- มีวันที่ export
- มีช่วงวันที่ของรายงาน
- มีหัวตารางตัวหนา
- มีเส้นตารางครบ
- จัดความกว้าง column ให้อ่านง่าย
- ตัวเลขราคาและยอดรวมจัด format เป็นจำนวนเงิน
- วันที่จัด format ให้อ่านง่าย
- มี summary row เช่น ยอดรวมท้ายตารางเมื่อเหมาะสม

Acceptance criteria:

- ไฟล์ต้องเปิดได้ใน Microsoft Excel, Google Sheets และ LibreOffice
- ข้อมูลตัวเลขต้องเป็น numeric cell ไม่ใช่ text
- ชื่อไฟล์ต้องสื่อความหมาย เช่น `sales-report-2026-06.xlsx`

## 7. Data Model Draft

Entity หลักสำหรับ MVP:

- Store
- User
- Product
- ProductImage
- Category
- InventoryTransaction
- Sale
- SaleItem
- Payment
- Receipt
- ExportLog

ความสัมพันธ์หลัก:

- Store มีผู้ใช้หลายคน
- Store มีสินค้าหลายรายการ
- Product อยู่ใน Category ได้
- Product มี ProductImage ได้หลายรูป
- Product มี InventoryTransaction หลายรายการ
- Sale มี SaleItem หลายรายการ
- Sale มี Payment อย่างน้อยหนึ่งรายการใน MVP
- Sale สร้าง Receipt หนึ่งรายการ
- User เป็นผู้สร้าง sale และ inventory transaction

## 8. Backend Module Design

โครงสร้าง backend แบบ MVC ควรแยก module ดังนี้:

- auth
- stores
- users
- products
- categories
- inventory
- sales
- receipts
- reports
- dashboard
- exports

ในแต่ละ module ควรมี:

- route
- controller
- service
- repository หรือ model/data access layer
- validation schema
- unit tests

หลักการสำคัญ:

- controller รับ request และคืน response เท่านั้น
- service เก็บ business logic
- repository หรือ data access layer ติดต่อ Prisma
- validation ต้องเกิดก่อนเข้า service
- error response ต้องมีรูปแบบสม่ำเสมอ

## 9. Frontend Screen Requirements

หน้าหลักใน MVP:

- Login
- Dashboard
- Store Settings
- User Management
- Product Management
- Product Form
- Inventory Receiving
- Inventory List
- POS Checkout
- Receipt View
- Sales Reports
- Export History หรือ export action ในแต่ละหน้า

หลัก UX สำหรับ POS:

- หน้าขายต้องโหลดเร็วและโฟกัสช่อง barcode พร้อมใช้งาน
- ตะกร้าต้องเห็นชื่อสินค้า จำนวน ราคา และยอดรวมชัดเจน
- ปุ่มรับเงินและจบการขายต้องใหญ่พอสำหรับ tablet
- error ต้องอยู่ใกล้ workflow ที่เกิดปัญหา
- หลีกเลี่ยง modal ที่ขัดจังหวะการขายบ่อยเกินไป
- keyboard flow ต้องดีสำหรับพนักงานที่ใช้ scanner และ keyboard

## 10. Responsive Requirements

ระบบต้องรองรับ:

- Desktop: ใช้ layout เต็ม มีตารางและ sidebar ได้
- Tablet/iPad: ปุ่มใหญ่ ตารางปรับเป็น compact ได้
- Mobile: ใช้ layout แบบ stacked ลด column ที่ไม่จำเป็น

Acceptance criteria:

- ไม่มีข้อความล้นปุ่มหรือทับกัน
- ตารางบนมือถือมีวิธีอ่านที่เหมาะสม เช่น horizontal scroll หรือ card list
- หน้าขายต้องใช้งานได้จริงบน tablet
- Dashboard ต้องเห็น metric สำคัญโดยไม่ต้องเลื่อนมากเกินไป

## 11. Security Requirements

- password ต้อง hash ด้วย algorithm ที่เหมาะสม เช่น bcrypt หรือ argon2
- ไม่เก็บ secret ใน repo
- ใช้ environment variables สำหรับ database URL, auth secret และ service credentials
- API ต้องตรวจ authentication ทุก endpoint ที่ต้อง login
- endpoint สำคัญต้องตรวจ role permission
- ต้อง validate input ทั้ง frontend และ backend
- error message ต้องไม่เปิดเผย internal stack trace ใน production

## 12. CI/CD Requirements

### Git Workflow

- ใช้ GitHub repository: `https://github.com/apiwatapply-svg/pos-grocery.git`
- branch หลักคือ `main`
- งาน feature ควรแยก branch และเปิด pull request
- ทุก PR ต้องผ่าน automated checks ก่อน merge

### Frontend Pipeline

- install dependencies
- lint
- typecheck
- unit test
- build
- deploy to Vercel เมื่อ merge เข้า main

### Backend Pipeline

- install dependencies
- lint
- typecheck
- unit test
- Prisma validate
- Prisma generate
- build หรือ start check
- deploy to Cloudflare เมื่อ merge เข้า main

## 13. Testing Requirements

ต้องเขียน unit test เสมอสำหรับ:

- login validation และ password handling
- product validation
- inventory receiving
- stock adjustment
- checkout total calculation
- insufficient stock handling
- sale creation และ stock deduction
- report calculation
- Excel export formatting helpers

แนวทาง test:

- service layer ต้อง test ได้โดยไม่ต้องเรียก HTTP จริง
- business logic สำคัญต้องแยกจาก controller
- mock repository หรือใช้ test database ตามความเหมาะสม
- เพิ่ม regression test ทุกครั้งเมื่อแก้ bug สำคัญ

## 14. Non-Functional Requirements

- ระบบขายต้องตอบสนองเร็วพอสำหรับการขายต่อเนื่อง
- หน้าขายควรลด network round-trip ที่ไม่จำเป็น
- API ต้องคืน error format สม่ำเสมอ
- ข้อมูลเงินควรเก็บเป็นจำนวนเต็มหน่วยย่อย เช่น satang หรือใช้ decimal strategy ที่ชัดเจน
- timezone ต้องกำหนดให้ชัดเจน โดย default สำหรับร้านในไทยควรใช้ Asia/Bangkok ในการแสดงผล
- รายงานต้องมี query ที่ optimize ได้เมื่อข้อมูลโตขึ้น
- รูปสินค้าใน MVP ต้องจำกัดขนาดและบีบอัดก่อน upload ไป Cloudinary เพื่อควบคุม quota ฟรี
- หลีกเลี่ยงบริการ paid add-on หรือบริการที่ต้องผูกบัตรเครดิตใน MVP

## 15. Suggested Phase 2 Features

ฟีเจอร์ที่แนะนำหลัง MVP:

- Supplier management
- Purchase order
- Return/refund
- Promotion และ discount rules
- Customer/member management
- Point collection
- Multi-branch
- Low-stock alert แบบ notification
- Audit log ว่าใครแก้ไขข้อมูลอะไร
- Barcode generator สำหรับสินค้าที่ไม่มี barcode
- Receipt template settings และโลโก้ร้าน
- Thermal printer integration
- Cloudflare R2 หรือ object storage อื่นสำหรับจัดเก็บรูปสินค้า เมื่อยอมรับการผูก billing หรือมีตัวเลือกฟรีที่ไม่ต้องใช้บัตรเครดิตชัดเจนแล้ว
- Backup และ scheduled export
- Advanced role-based permission
- Import สินค้าจาก Excel
- Stock counting workflow สำหรับตรวจนับรอบเดือน

## 16. Milestones

### Phase 0: Project Foundation

- setup repository
- setup frontend และ backend folders
- setup package manager
- setup lint, typecheck, test
- setup CI/CD
- setup Prisma และ Turso/libSQL connection

### Phase 1: Auth และ Store

- login
- user model
- role เบื้องต้น
- store settings
- protected routes

### Phase 2: Product และ Inventory

- product CRUD
- category
- product image
- receiving stock
- inventory transaction
- inventory export Excel

### Phase 3: Sales และ Receipt

- POS checkout
- barcode flow
- sale creation
- stock deduction
- receipt view
- browser print

### Phase 4: Reports และ Dashboard

- sales reports
- best-selling products
- dashboard cards/charts
- custom date range
- report export Excel

### Phase 5: Polish และ Production Readiness

- responsive QA
- accessibility pass
- error recovery
- deployment configuration
- production environment variables
- regression tests

## 17. Open Questions

- ต้องรองรับ VAT หรือภาษีขายตั้งแต่ MVP หรือไม่
- ต้องใช้เครื่องพิมพ์ใบเสร็จ thermal printer รุ่นใดโดยเฉพาะหรือไม่
- Cloudinary Free quota เพียงพอกับจำนวนสินค้าและรูปของร้านในช่วง MVP หรือไม่
- หาก Cloudinary Free quota ไม่พอ จะลดขนาดรูป จำกัดจำนวนรูป หรือเลือก storage ฟรีอื่นที่ไม่ต้องผูกบัตรก่อนพิจารณาบริการที่มี billing
- ต้องรองรับหลายร้านหรือหลายสาขาในระบบเดียวตั้งแต่แรกหรือไม่
- ต้องมีระบบส่วนลดใน MVP หรือเลื่อนไป Phase 2
- ต้องรองรับการขายแบบไม่ตัดสต็อกสำหรับสินค้าบางประเภทหรือไม่
- ต้องรองรับการ import สินค้าจาก Excel ตั้งแต่ MVP หรือไม่

## 18. Success Metrics

- พนักงานสามารถขายสินค้าด้วย barcode ได้สำเร็จภายในไม่กี่ขั้นตอน
- เจ้าของร้านดูยอดขายรายวันและรายเดือนได้โดยไม่ต้อง export ก่อน
- สต็อกลดลงถูกต้องหลังการขาย และเพิ่มขึ้นถูกต้องหลังรับสินค้าเข้า
- Export Excel เปิดใช้งานจริงได้และอ่านง่าย
- ทุก PR ผ่าน CI/CD และ unit test ก่อน merge
- ระบบใช้งานได้ดีบน desktop และ tablet ซึ่งเป็นอุปกรณ์หลักของร้าน
