import { type FormEvent, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

type User = {
  id: string
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'cashier' | 'stock'
  status: 'active' | 'inactive'
}

export function UserManagementPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([
    { id: 'user-owner', username: 'admin', displayName: 'Admin', role: 'owner', status: 'active' },
    { id: 'user-cashier', username: 'cashier', displayName: 'Cashier One', role: 'cashier', status: 'active' },
  ])

  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setUsers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        username: String(form.get('username')),
        displayName: String(form.get('displayName')),
        role: String(form.get('role')) as User['role'],
        status: 'active',
      },
    ])
    event.currentTarget.reset()
    setIsCreateModalOpen(false)
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

    setUsers((current) =>
      current.map((row) => (row.id === user.id ? { ...row, status: 'inactive' } : row)),
    )
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
              <th>Username</th>
              <th>ชื่อ</th>
              <th>Role</th>
              <th>Status</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.displayName}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() => void deactivateUser(user)}
                    type="button"
                  >
                    ปิดใช้งาน
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
