# GitHub Secrets Setup

GitHub repository: `https://github.com/apiwatapply-svg/pos-grocery`

ต้องใส่ค่าพวกนี้ใน GitHub ก่อน deploy production:

## Frontend: Vercel

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_API_BASE_URL`

`VITE_API_BASE_URL` ต้องเป็น URL backend production แล้วต่อท้าย `/api`

ตัวอย่าง:

```text
https://pos-grocery-api.<your-subdomain>.workers.dev/api
```

## Backend: Cloudflare Workers

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Backend Runtime Secrets

ต้องใส่ใน Cloudflare Worker secret/vars ด้วย:

- `JWT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`

## GitHub UI Steps

1. เปิด GitHub repo: `apiwatapply-svg/pos-grocery`
2. ไปที่ `Settings`
3. ไปที่ `Secrets and variables`
4. เลือก `Actions`
5. กด `New repository secret`
6. ใส่ `Name` ตามรายการด้านบน
7. ใส่ `Secret` เป็นค่าจริง
8. กด `Add secret`

## GitHub CLI Template

ใช้ได้ถ้าเครื่อง login `gh` แล้ว:

```powershell
gh secret set VERCEL_TOKEN --repo apiwatapply-svg/pos-grocery --body "ใส่ค่า Vercel token"
gh secret set VERCEL_ORG_ID --repo apiwatapply-svg/pos-grocery --body "ใส่ค่า Vercel org id"
gh secret set VERCEL_PROJECT_ID --repo apiwatapply-svg/pos-grocery --body "ใส่ค่า Vercel project id"
gh secret set VITE_API_BASE_URL --repo apiwatapply-svg/pos-grocery --body "https://<worker-url>/api"

gh secret set CLOUDFLARE_API_TOKEN --repo apiwatapply-svg/pos-grocery --body "ใส่ค่า Cloudflare API token"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo apiwatapply-svg/pos-grocery --body "ใส่ค่า Cloudflare account id"
```

## Current Deploy Blocker

แม้ใส่ GitHub Secrets ครบแล้ว backend ยังต้องแก้ runtime ให้เป็น Cloudflare
Worker-compatible `fetch()` entry point ก่อน จึงจะถือว่า deploy production จริงครบ.
