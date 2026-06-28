import { type FormEvent, useState } from 'react'
import { apiPost } from '../../lib/api/client'

type LoginResponse = {
  token: string
  user: {
    username: string
    displayName: string
    role: string
  }
}

export function LoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [message, setMessage] = useState('เข้าสู่ระบบเพื่อเริ่มขายหน้าร้าน')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const result = await apiPost<LoginResponse>('/auth/login', {
        username,
        password,
      })
      setMessage(`พร้อมใช้งาน: ${result.user.displayName}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <div>
        <p className="eyebrow">POS Grocery</p>
        <h1 id="login-title">เข้าสู่ระบบร้านค้า</h1>
        <p className="summary">{message}</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            autoComplete="username"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <button type="submit">Login</button>
      </form>
    </section>
  )
}
