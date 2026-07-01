export type ImageCompressionPolicy = {
  maxHeight: number
  maxWidth: number
  mimeType: 'image/webp' | 'image/jpeg'
  quality: number
}

type LoadedImage = {
  naturalHeight: number
  naturalWidth: number
}

type CompressionCanvas = {
  getContext: (contextId: '2d') => { drawImage: (image: LoadedImage, x: number, y: number, width: number, height: number) => void } | null
  height: number
  toDataURL: (mimeType: string, quality?: number) => string
  width: number
}

type ImageCompressionEnvironment = {
  createCanvas: (width: number, height: number) => CompressionCanvas
  loadImage: (dataUri: string) => Promise<LoadedImage>
  readFileAsDataUrl: (file: File) => Promise<string>
}

export const productImageCompression: ImageCompressionPolicy = {
  maxHeight: 800,
  maxWidth: 800,
  mimeType: 'image/webp',
  quality: 0.78,
}

export const logoImageCompression: ImageCompressionPolicy = {
  maxHeight: 512,
  maxWidth: 512,
  mimeType: 'image/webp',
  quality: 0.82,
}

export function scaleImageToFit(
  image: { height: number; width: number },
  bounds: Pick<ImageCompressionPolicy, 'maxHeight' | 'maxWidth'>,
) {
  if (image.width <= 0 || image.height <= 0) {
    return { height: 0, width: 0 }
  }

  const ratio = Math.min(bounds.maxWidth / image.width, bounds.maxHeight / image.height, 1)

  return {
    height: Math.round(image.height * ratio),
    width: Math.round(image.width * ratio),
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUri: string) {
  return new Promise<LoadedImage>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'))
    image.src = dataUri
  })
}

function createCanvas(width: number, height: number): CompressionCanvas {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  return canvas as CompressionCanvas
}

function compressedFileName(fileName: string, mimeType: ImageCompressionPolicy['mimeType']) {
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg'
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '')

  return `${nameWithoutExtension || 'image'}.${extension}`
}

export async function compressImageFile(
  file: File,
  policy: ImageCompressionPolicy,
  environment: ImageCompressionEnvironment = { createCanvas, loadImage, readFileAsDataUrl },
) {
  const originalDataUri = await environment.readFileAsDataUrl(file)

  try {
    const image = await environment.loadImage(originalDataUri)
    const size = scaleImageToFit(
      { height: image.naturalHeight, width: image.naturalWidth },
      { maxHeight: policy.maxHeight, maxWidth: policy.maxWidth },
    )

    const canvas = environment.createCanvas(size.width, size.height)
    const context = canvas.getContext('2d')
    if (!context || size.width <= 0 || size.height <= 0) {
      return {
        dataUri: originalDataUri,
        fileName: file.name,
        height: image.naturalHeight,
        width: image.naturalWidth,
      }
    }

    context.drawImage(image, 0, 0, size.width, size.height)
    const dataUri = canvas.toDataURL(policy.mimeType, policy.quality)
    if (!dataUri || dataUri === 'data:,') {
      return {
        dataUri: originalDataUri,
        fileName: file.name,
        height: image.naturalHeight,
        width: image.naturalWidth,
      }
    }

    return {
      dataUri,
      fileName: compressedFileName(file.name, policy.mimeType),
      height: size.height,
      width: size.width,
    }
  } catch {
    return {
      dataUri: originalDataUri,
      fileName: file.name,
    }
  }
}
