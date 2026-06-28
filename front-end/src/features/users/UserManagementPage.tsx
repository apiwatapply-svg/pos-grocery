import { type FormEvent, useState } from 'react'

type User = {
  id: string
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'cashier' | 'stock'
  status: 'active' | 'inactive'
}

export function UserManagementPage() {
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
  }

  return (
    <section className="route-page" aria-labelledby="users-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 id="users-title">ผู้ใช้ระบบ</h1>
        </div>
      </div>
      <form className="panel compact-form" onSubmit={createUser}>
        <input name="username" placeholder="username" required />
        <input name="displayName" placeholder="ชื่อผู้ใช้" required />
        <select name="role" defaultValue="cashier">
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="cashier">cashier</option>
          <option value="stock">stock</option>
        </select>
        <button type="submit">เพิ่มผู้ใช้</button>
      </form>
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
                    onClick={() =>
                      setUsers((current) =>
                        current.map((row) =>
                          row.id === user.id ? { ...row, status: 'inactive' } : row,
                        ),
                      )
                    }
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
