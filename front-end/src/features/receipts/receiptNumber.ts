function timePart(date: Date, type: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).formatToParts(date).find((part) => part.type === type)?.value ?? ''
}

export function displayReceiptNumber(receiptNumber: string) {
  const legacyTimestamp = /^RC(\d{8})-(\d{13})$/.exec(receiptNumber)
  if (!legacyTimestamp) {
    return receiptNumber
  }

  const timestamp = Number(legacyTimestamp[2])
  if (!Number.isFinite(timestamp)) {
    return receiptNumber
  }

  const date = new Date(timestamp)
  return `RC${legacyTimestamp[1]}-${timePart(date, 'hour')}${timePart(date, 'minute')}${timePart(date, 'second')}`
}
