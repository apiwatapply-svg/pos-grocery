import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../lib/api/client'
import { saveSession } from '../../lib/auth/session'
import type { Role } from '../../lib/auth/permissions'

type LoginResponse = {
  token: string
  user: {
    id: string
    username: string
    displayName: string
    role: Role
  }
}

function defaultPathForRole(role: Role) {
  if (role === 'cashier') {
    return '/pos'
  }
  if (role === 'stock') {
    return '/inventory'
  }

  return '/dashboard'
}

export function LoginPage() {
  const navigate = useNavigate()
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
      saveSession({
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          role: result.user.role,
        },
      })
      setMessage(`พร้อมใช้งาน: ${result.user.displayName}`)
      navigate(defaultPathForRole(result.user.role))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  return (
    <section className="auth-screen" aria-labelledby="login-title">
      <div className="auth-panel">
        <div className="auth-brand">
          <span>POS</span>
          <div>
            <p className="eyebrow">POS Grocery</p>
            <strong>ระบบขายหน้าร้าน</strong>
          </div>
        </div>
        <div>
          <h1 id="login-title">เข้าสู่ระบบร้านค้า</h1>
          <p className="summary">{message}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <p className="eyebrow">Secure access</p>
            <h2>Login</h2>
          </div>
          <label className="field">
            <span>Username</span>
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button className="primary-button" type="submit">
            Login
          </button>
        </form>
      </div>
    </section>
  )
}
