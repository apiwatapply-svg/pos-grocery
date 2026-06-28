import { type FormEvent, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { apiDelete, apiGet, apiPost } from '../../lib/api/client'

type User = {
  id: string
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'cashier' | 'stock'
  status: 'active' | 'inactive'
}

export function UserManagementPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [message, setMessage] = useState('กำลังโหลดผู้ใช้')

  useEffect(() => {
    let active = true

    apiGet<User[]>('/users')
      .then((nextUsers) => {
        if (active) {
          setUsers(nextUsers)
          setMessage(nextUsers.length > 0 ? '' : 'ยังไม่มีผู้ใช้')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดผู้ใช้ไม่สำเร็จ')
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      const created = await apiPost<User>('/users', {
        username: String(form.get('username')),
        password: String(form.get('password')),
        displayName: String(form.get('displayName')),
        role: String(form.get('role')) as User['role'],
        status: 'active',
      })
      setUsers((current) => [...current, created])
      formElement.reset()
      setIsCreateModalOpen(false)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างผู้ใช้ไม่สำเร็จ')
    }
  }

  async function deactivateUser(user: User) {
    const result = await Swal.fire({
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#b42318',
      confirmButtonText: 'ปิดใช้งาน',
      icon: 'warning',
      showCancelButton: true,
      text: `ผู้ใช้ ${user.displayName} จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง`,
      title: 'ยืนยันปิดใช้งานผู้ใช้',
    })

    if (!result.isConfirmed) {
      return
    }

    try {
      const updated = await apiDelete<User>(`/users/${user.id}`)
      setUsers((current) =>
        current.map((row) => (row.id === user.id ? updated : row)),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ปิดใช้งานผู้ใช้ไม่สำเร็จ')
    }
  }

  return (
    <section className="route-page" aria-labelledby="users-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 id="users-title">ผู้ใช้ระบบ</h1>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setIsCreateModalOpen(true)}
          type="button"
        >
          เพิ่มผู้ใช้
        </button>
      </div>
      {isCreateModalOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="create-user-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="modal-header">
              <h2 id="create-user-title">เพิ่มผู้ใช้</h2>
              <button
                aria-label="ปิดหน้าต่างเพิ่มผู้ใช้"
                className="ghost-button compact"
                onClick={() => setIsCreateModalOpen(false)}
                type="button"
              >
                ปิด
              </button>
            </div>
            <form className="modal-form" onSubmit={createUser}>
              <label className="field">
                <span>username</span>
                <input name="username" required />
              </label>
              <label className="field">
                <span>ชื่อผู้ใช้</span>
                <input name="displayName" required />
              </label>
              <label className="field">
                <span>password</span>
                <input minLength={6} name="password" required type="password" />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue="cashier">
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="cashier">cashier</option>
                  <option value="stock">stock</option>
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="ghost-button compact"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  ยกเลิก
                </button>
                <button className="primary-button compact" type="submit">
                  บันทึกผู้ใช้
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Username</th>
              <th>ชื่อ</th>
              <th>Role</th>
              <th>Status</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? users.map((user, index) => (
              <tr key={user.id}>
                <td>{index + 1}</td>
                <td>{user.username}</td>
                <td>{user.displayName}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button
                    className="danger-button compact"
                    onClick={() => void deactivateUser(user)}
                    type="button"
                  >
                    ปิดใช้งาน
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>{message}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
