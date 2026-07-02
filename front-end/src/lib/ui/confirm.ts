import Swal from 'sweetalert2'

export type ConfirmActionTone = 'danger' | 'success' | 'warning'

export type ConfirmActionIcon = 'warning' | 'question' | 'info'

export type ConfirmActionOptions = {
  title: string
  text: string
  confirmText?: string
  cancelText?: string
  tone?: ConfirmActionTone
  icon?: ConfirmActionIcon
}

export type ConfirmActionResult = {
  isConfirmed: boolean
}

const toneConfirmColor: Record<ConfirmActionTone, string> = {
  danger: '#b42318',
  success: '#15803d',
  warning: '#b45309',
}

const toneIcon: Record<ConfirmActionTone, ConfirmActionIcon> = {
  danger: 'warning',
  success: 'question',
  warning: 'warning',
}

export async function confirmAction(
  options: ConfirmActionOptions,
): Promise<ConfirmActionResult> {
  const tone = options.tone ?? 'danger'
  const icon = options.icon ?? toneIcon[tone]
  const result = await Swal.fire({
    cancelButtonColor: '#6b7280',
    cancelButtonText: options.cancelText ?? 'ยกเลิก',
    confirmButtonColor: toneConfirmColor[tone],
    confirmButtonText: options.confirmText ?? 'ยืนยัน',
    focusCancel: true,
    icon,
    reverseButtons: true,
    showCancelButton: true,
    text: options.text,
    title: options.title,
  })

  return { isConfirmed: Boolean(result.isConfirmed) }
}

export type ConfirmDeleteOptions = {
  title: string
  text: string
  confirmText?: string
}

export type ConfirmDeleteResult = ConfirmActionResult

export async function confirmDeleteAction(
  options: ConfirmDeleteOptions,
): Promise<ConfirmDeleteResult> {
  return confirmAction({
    cancelText: 'ยกเลิก',
    confirmText: options.confirmText ?? 'ลบ',
    text: options.text,
    title: options.title,
    tone: 'danger',
  })
}
