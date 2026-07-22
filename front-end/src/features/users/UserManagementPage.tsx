import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Select, type SelectOption } from '../../components/ui/Select'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api/client'
import { formatNumber } from '../../lib/format/number'
import { confirmAction } from '../../lib/ui/confirm'
import { PaginationControls } from '../shared/Pagination'
import { paginateItems } from '../shared/paginationUtils'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { useSortableTable } from '../shared/useSortableTable'

type User = {
  id: string
  storeId: string
  username: string
  displayName: string
  role: 'super_admin' | 'store_admin' | 'cashier' | 'stock'
  status: 'active' | 'inactive'
}

type Store = {
  id: string
  name: string
  status: 'active' | 'inactive'
}

type UserEditDraft = {
  storeId: string
  username: string
  displayName: string
  password: string
  role: User['role']
  status: User['status']
}

type CreateUserDraft = {
  storeId: string
  username: string
  displayName: string
  password: string
  role: User['role']
}

function editDraftFromUser(user: User): UserEditDraft {
  return {
    storeId: user.storeId,
    username: user.username,
    displayName: user.displayName,
    password: '',
    role: user.role,
    status: user.status,
  }
}

function emptyCreateDraft(defaultStoreId: string): CreateUserDraft {
  return {
    storeId: defaultStoreId,
    username: '',
    displayName: '',
    password: '',
    role: 'cashier',
  }
}

type UserSortKey =
  | 'storeName'
  | 'username'
  | 'displayName'
  | 'role'
  | 'status'

export function UserManagementPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDraft, setEditDraft] = useState<UserEditDraft | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateUserDraft | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState('กำลังโหลดผู้ใช้')
  const storesById = useMemo(() => {
    const map = new Map<string, Store>()
    stores.forEach((store) => map.set(store.id, store))
    return map
  }, [stores])
  const { sortKey, direction, setSortKey, sortedRows } = useSortableTable<User, UserSortKey>(users, {
    initialKey: 'username',
    columns: {
      storeName: {
        get: (user) => storesById.get(user.storeId)?.name ?? user.storeId,
      },
      username: { get: (user) => user.username },
      displayName: { get: (user) => user.displayName },
      role: { get: (user) => user.role },
      status: { get: (user) => user.status },
    },
  })
  const paginatedUsers = paginateItems(sortedRows, currentPage)

  const roleOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'super_admin', label: 'Super Admin (super_admin)' },
      { value: 'store_admin', label: 'ผู้ดูแลร้าน (store_admin)' },
      { value: 'cashier', label: 'แคชเชียร์ (cashier)' },
      { value: 'stock', label: 'สต็อก/คลังสินค้า (stock)' },
    ],
    [],
  )

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'active', label: 'active' },
      { value: 'inactive', label: 'inactive' },
    ],
    [],
  )

  const storeOptions = useMemo<SelectOption[]>(
    () => stores.map((store) => ({ value: store.id, label: store.name })),
    [stores],
  )

  useEffect(() => {
    let active = true

    async function loadUsersAndStores() {
      try {
        const nextUsers = await apiGet<User[]>('/users')
        if (active) {
          setUsers(nextUsers)
          setCurrentPage(1)
          setMessage(nextUsers.length > 0 ? '' : 'ยังไม่มีผู้ใช้')
        }

        const nextStores = await apiGet<Store[]>('/store').catch(() => [] as Store[])
        if (active) {
          setStores(nextStores)
        }
      } catch (error: unknown) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'โหลดผู้ใช้ไม่สำเร็จ')
        }
      }
    }

    void loadUsersAndStores()

    return () => {
      active = false
    }
  }, [])

  function storeName(storeId: string) {
    return stores.find((store) => store.id === storeId)?.name ?? '-'
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createDraft) {
      return
    }
    try {
      const created = await apiPost<User>('/users', {
        storeId: createDraft.storeId,
        username: createDraft.username.trim(),
        password: createDraft.password,
        displayName: createDraft.displayName.trim(),
        role: createDraft.role,
        status: 'active',
      })
      setUsers((current) => [...current, created])
      setCurrentPage(1)
      setIsCreateModalOpen(false)
      setCreateDraft(null)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างผู้ใช้ไม่สำเร็จ')
    }
  }

  function openCreateModal() {
    setCreateDraft(emptyCreateDraft(stores[0]?.id ?? ''))
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
    setCreateDraft(null)
  }

  function updateCreateDraft(field: keyof CreateUserDraft, value: string) {
    setCreateDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  async function deactivateUser(user: User) {
    const { isConfirmed } = await confirmAction({
      confirmText: 'ปิดใช้งาน',
      text: `ผู้ใช้ ${user.displayName} จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง`,
      title: 'ยืนยันปิดใช้งานผู้ใช้',
      tone: 'danger',
    })

    if (!isConfirmed) {
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

  function openEditModal(user: User) {
    setEditingUser(user)
    setEditDraft(editDraftFromUser(user))
  }

  function closeEditModal() {
    setEditingUser(null)
    setEditDraft(null)
  }

  function updateEditDraft(field: keyof UserEditDraft, value: string) {
    setEditDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    )
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingUser || !editDraft) {
      return
    }

    const payload = {
      storeId: editDraft.storeId,
      username: editDraft.username.trim(),
      displayName: editDraft.displayName.trim(),
      role: editDraft.role,
      status: editDraft.status,
      ...(editDraft.password.trim() ? { password: editDraft.password } : {}),
    }

    try {
      const updated = await apiPatch<User>(`/users/${editingUser.id}`, payload)
      setUsers((current) => current.map((row) => (row.id === editingUser.id ? updated : row)))
      closeEditModal()
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'แก้ไขผู้ใช้ไม่สำเร็จ')
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
          onClick={openCreateModal}
          type="button"
        >
          เพิ่มผู้ใช้
        </button>
      </div>
      {isCreateModalOpen && createDraft ? (
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
                onClick={closeCreateModal}
                type="button"
              >
                ปิด
              </button>
            </div>
            <form className="modal-form" onSubmit={createUser}>
              <label className="field">
                <span>ร้านค้า</span>
                <Select
                  ariaLabel="ร้านค้า"
                  emptyLabel="เลือกร้านค้า"
                  options={storeOptions}
                  required
                  value={createDraft.storeId}
                  onChange={(value) => updateCreateDraft('storeId', value)}
                />
              </label>
              <label className="field">
                <span>username</span>
                <input
                  required
                  value={createDraft.username}
                  onChange={(event) => updateCreateDraft('username', event.target.value)}
                />
              </label>
              <label className="field">
                <span>ชื่อผู้ใช้</span>
                <input
                  required
                  value={createDraft.displayName}
                  onChange={(event) => updateCreateDraft('displayName', event.target.value)}
                />
              </label>
              <label className="field">
                <span>password</span>
                <input
                  minLength={6}
                  required
                  type="password"
                  value={createDraft.password}
                  onChange={(event) => updateCreateDraft('password', event.target.value)}
                />
              </label>
              <label className="field">
                <span>สิทธิ์การใช้งาน</span>
                <Select
                  ariaLabel="สิทธิ์การใช้งาน"
                  options={roleOptions}
                  value={createDraft.role}
                  onChange={(value) => updateCreateDraft('role', value as User['role'])}
                />
              </label>
              <div className="modal-actions">
                <button
                  className="ghost-button compact"
                  onClick={closeCreateModal}
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
      {editingUser && editDraft ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="edit-user-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="edit-user-title">แก้ไขผู้ใช้ {editingUser.displayName}</h2>
                <p>แก้ไข username, ชื่อ, สิทธิ์, สถานะ และเปลี่ยน password เมื่อจำเป็น</p>
              </div>
              <button
                aria-label="ปิดหน้าต่างแก้ไขผู้ใช้"
                className="ghost-button compact"
                onClick={closeEditModal}
                type="button"
              >
                ปิด
              </button>
            </div>
            <form className="modal-form" onSubmit={(event) => void updateUser(event)}>
              <label className="field">
                <span>ร้านค้า</span>
                <Select
                  ariaLabel="ร้านค้า"
                  emptyLabel="เลือกร้านค้า"
                  options={storeOptions}
                  required
                  value={editDraft.storeId}
                  onChange={(value) => updateEditDraft('storeId', value)}
                />
              </label>
              <label className="field">
                <span>username</span>
                <input
                  aria-label="username"
                  required
                  value={editDraft.username}
                  onChange={(event) => updateEditDraft('username', event.target.value)}
                />
              </label>
              <label className="field">
                <span>ชื่อผู้ใช้</span>
                <input
                  aria-label="ชื่อผู้ใช้"
                  required
                  value={editDraft.displayName}
                  onChange={(event) => updateEditDraft('displayName', event.target.value)}
                />
              </label>
              <label className="field">
                <span>password ใหม่</span>
                <input
                  aria-label="password ใหม่"
                  minLength={6}
                  placeholder="เว้นว่างถ้าไม่เปลี่ยน password"
                  type="password"
                  value={editDraft.password}
                  onChange={(event) => updateEditDraft('password', event.target.value)}
                />
              </label>
              <label className="field">
                <span>สิทธิ์การใช้งาน</span>
                <Select
                  ariaLabel="สิทธิ์การใช้งาน"
                  options={roleOptions}
                  value={editDraft.role}
                  onChange={(value) => updateEditDraft('role', value as User['role'])}
                />
              </label>
              <label className="field">
                <span>สถานะผู้ใช้</span>
                <Select
                  ariaLabel="สถานะผู้ใช้"
                  options={statusOptions}
                  value={editDraft.status}
                  onChange={(value) => updateEditDraft('status', value as User['status'])}
                />
              </label>
              <div className="modal-actions">
                <button
                  className="ghost-button compact"
                  onClick={closeEditModal}
                  type="button"
                >
                  ยกเลิก
                </button>
                <button className="success-button compact" type="submit">
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      <div className="table-wrap panel">
        <table aria-label="ตารางผู้ใช้">
          <thead>
            <tr>
              <th scope="col">No</th>
              <SortableTableHeader
                activeSortKey={sortKey}
                direction={direction}
                sortKey="storeName"
                onSort={setSortKey}
                label="ร้านค้า"
              />
              <SortableTableHeader
                activeSortKey={sortKey}
                direction={direction}
                sortKey="username"
                onSort={setSortKey}
                label="Username"
              />
              <SortableTableHeader
                activeSortKey={sortKey}
                direction={direction}
                sortKey="displayName"
                onSort={setSortKey}
                label="ชื่อ"
              />
              <SortableTableHeader
                activeSortKey={sortKey}
                direction={direction}
                sortKey="role"
                onSort={setSortKey}
                label="Role"
              />
              <SortableTableHeader
                activeSortKey={sortKey}
                direction={direction}
                sortKey="status"
                onSort={setSortKey}
                label="Status"
              />
              <th scope="col">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? paginatedUsers.items.map((user, index) => (
              <tr key={user.id}>
                <td>{formatNumber(paginatedUsers.startIndex + index + 1)}</td>
                <td>{storeName(user.storeId)}</td>
                <td>{user.username}</td>
                <td>{user.displayName}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <div className="table-action-row">
                    <button
                      aria-label={`แก้ไข ${user.displayName}`}
                      className="table-action-link"
                      onClick={() => openEditModal(user)}
                      type="button"
                    >
                      แก้ไข
                    </button>
                    <button
                      className="danger-button compact"
                      onClick={() => void deactivateUser(user)}
                      type="button"
                    >
                      ปิดใช้งาน
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>{message}</td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={currentPage}
          totalItems={sortedRows.length}
          onPageChange={setCurrentPage}
        />
      </div>
    </section>
  )
}
