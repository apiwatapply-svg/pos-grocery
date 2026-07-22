import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { apiPost } from '../../lib/api/client'
import {
  clearRememberedUsername,
  readRememberedUsername,
  rememberUsername,
} from '../../lib/auth/credentials'
import { clearSession, readSession, saveSession } from '../../lib/auth/session'
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
  if (role === 'super_admin') {
    return '/settings/store'
  }

  return '/login'
}

function readLoginSession() {
  const session = readSession()

  // The locked-down UI only allows the super_admin role. Any other role
  // that finds a session still in storage is logged out so the login
  // form can take over without looping back to itself.
  if (session && session.user.role !== 'super_admin') {
    clearSession()
    return null
  }

  return session
}

export function LoginPage() {
  const navigate = useNavigate()
  const [currentSession] = useState(readLoginSession)
  const [username, setUsername] = useState(readRememberedUsername)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('เข้าสู่ระบบเพื่อเริ่มขายหน้าร้าน')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (currentSession && currentSession.user.role === 'super_admin') {
    return <Navigate replace to={defaultPathForRole(currentSession.user.role)} />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage('กำลังเข้าสู่ระบบ...')
    Swal.fire({
      title: 'กำลังเข้าสู่ระบบ',
      text: 'กรุณารอสักครู่',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    })
    Swal.showLoading()

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
      rememberUsername(result.user.username)
      setMessage(`พร้อมใช้งาน: ${result.user.displayName}`)
      Swal.close()
      await Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบสำเร็จ',
        text: `ยินดีต้อนรับ ${result.user.displayName}`,
        timer: 800,
        showConfirmButton: false,
        timerProgressBar: true,
      })
      navigate(defaultPathForRole(result.user.role))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ'
      setMessage(errorMessage)
      clearRememberedUsername()
      Swal.close()
      await Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: errorMessage,
        confirmButtonText: 'ลองอีกครั้ง',
      })
    } finally {
      setIsSubmitting(false)
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
          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'Login'}
          </button>
        </form>
      </div>
    </section>
  )
}
