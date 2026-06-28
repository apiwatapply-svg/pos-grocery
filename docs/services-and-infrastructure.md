# Services and Infrastructure

เอกสารนี้สรุปว่า POS Grocery แต่ละส่วนใช้บริการหรือเทคโนโลยีอะไร โดยตั้งเงื่อนไขหลักว่า
MVP ต้องใช้บริการที่เริ่มต้นได้ฟรีและไม่ต้องผูกบัตรเครดิต

## Service Map

| ส่วนของระบบ | ใช้อะไร | เหตุผล | ค่าใช้จ่ายเป้าหมาย |
| --- | --- | --- | --- |
| Frontend hosting | Vercel Hobby | deploy React จาก GitHub ง่าย เหมาะกับ frontend | Free tier |
| Backend hosting | Cloudflare Workers Free | เหมาะกับ API เบา ๆ และ deploy ผ่าน CI/CD ได้ | Free tier |
| Database | Turso/libSQL | ใช้งานกับ SQLite/libSQL, มี hosted database, เหมาะกับ MVP | Free tier, no credit card ตามหน้า pricing |
| ORM | Prisma ORM v6 | schema, migration, typed database access | Open-source dependency |
| Product image storage | Cloudinary Free | เก็บรูปจริง, มี CDN, resize/transform รูป, ไม่ทำให้ database โตเร็ว | Free tier, no credit card ตามหน้า pricing |
| Source control | GitHub | เก็บ repo, branch, pull request | Free tier |
| CI/CD | GitHub Actions | run lint, typecheck, test, build, deploy checks | Free allowance |
| Authentication | Backend JWT/session secret | ควบคุม login และ protected API | ไม่มีค่าใช้จ่าย |
| Excel export | Backend library เช่น ExcelJS | สร้างไฟล์ Excel พร้อมหัวตาราง เส้นตาราง และ format | Open-source dependency |

## Frontend

- Path: `front-end/`
- Framework: React + TypeScript
- Build tool: Vite
- Hosting: Vercel Hobby
- Environment:
  - `VITE_API_BASE_URL`

Frontend จะเรียก backend API ผ่าน `VITE_API_BASE_URL` เท่านั้น ไม่ hardcode backend URL ใน component

## Backend

- Path: `back-end/`
- Runtime/framework: Node.js + Express
- Structure: MVC-style modules
- Hosting: Cloudflare Workers Free
- Environment:
  - `NODE_ENV`
  - `PORT`
  - `JWT_SECRET`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `DATABASE_URL`
  - `PRISMA_DATABASE_URL`
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_UPLOAD_FOLDER`

Backend เป็นจุดเดียวที่ถือ secret เช่น Turso token, JWT secret และ Cloudinary API secret
ห้ามส่ง secret เหล่านี้ไป frontend

## Database

- Provider: Turso/libSQL
- ORM: Prisma ORM v6
- ใช้เก็บข้อมูลร้าน ผู้ใช้ สินค้า สต็อก การขาย ใบเสร็จ รายงาน และ metadata ของรูป
- ไม่เก็บไฟล์รูปสินค้าจริงใน database โดยให้ database เก็บเฉพาะ URL และ metadata ของรูป

ข้อมูลรูปใน database ควรเก็บเป็น metadata เช่น:

- `provider`
- `publicId`
- `secureUrl`
- `thumbnailUrl`
- `width`
- `height`
- `format`
- `bytes`

## Product Images

เลือกใช้ Cloudinary Free สำหรับรูปสินค้าจริง

เหตุผล:

- มี free tier และหน้า pricing ระบุ no credit card required
- มี CDN สำหรับส่งรูปให้ frontend
- รองรับ resize, crop, format conversion และ optimization
- database เก็บแค่ URL และ metadata ทำให้ Turso ไม่โตเร็ว

ข้อจำกัด MVP:

- จำกัด 1 รูปหลักต่อสินค้าในรอบแรก
- จำกัดขนาดไฟล์ก่อน upload เช่นไม่เกิน 1MB ก่อนส่งเข้า backend
- Backend ควรสร้าง thumbnail URL ขนาดเล็กสำหรับหน้าขายและตารางสินค้า
- ถ้า Cloudinary quota ไม่พอ ให้ลดขนาดรูปหรือค่อยพิจารณา storage อื่นใน Phase 2

## CI/CD

GitHub Actions ต้องตรวจอย่างน้อย:

- Frontend lint
- Frontend typecheck
- Frontend unit test
- Frontend build
- Backend lint
- Backend typecheck
- Backend unit test
- Prisma validate/generate
- Backend build/start check

Deploy:

- Frontend: ใช้ Vercel Git integration ก่อน เพื่อลดจำนวน token ที่ต้องจัดการ
- Backend: ใช้ Cloudflare deploy หลังจาก scaffold backend พร้อม

## Secrets

ใส่ค่า secret จริงในไฟล์ local หรือ platform secret manager เท่านั้น

Local files:

- `back-end/.env`
- `back-end/.dev.vars`
- `front-end/.env.local`

Example files ที่ commit ได้:

- `.env.example`
- `back-end/.env.example`
- `back-end/.dev.vars.example`
- `front-end/.env.example`

GitHub Secrets ที่จะใช้เมื่อทำ CI/CD deploy:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `PRISMA_DATABASE_URL`
- `JWT_SECRET`
- `VITE_API_BASE_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## References

- Cloudinary Pricing: https://cloudinary.com/pricing
- Turso Pricing: https://turso.tech/pricing
- Vercel Pricing: https://vercel.com/pricing
- Cloudflare Workers Pricing: https://developers.cloudflare.com/workers/platform/pricing/
