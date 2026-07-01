import { describe, expect, it, vi } from 'vitest'
import {
  compressImageFile,
  logoImageCompression,
  productImageCompression,
  scaleImageToFit,
} from './imageCompression'

describe('image compression', () => {
  it('scales images down to fit a maximum box without changing aspect ratio', () => {
    expect(scaleImageToFit({ width: 1600, height: 1000 }, { maxWidth: 800, maxHeight: 800 })).toEqual({
      width: 800,
      height: 500,
    })
    expect(scaleImageToFit({ width: 320, height: 240 }, { maxWidth: 800, maxHeight: 800 })).toEqual({
      width: 320,
      height: 240,
    })
  })

  it('compresses product photos to the product size and quality policy', async () => {
    const drawImage = vi.fn()
    const toDataURL = vi.fn(() => 'data:image/webp;base64,compressed-product')
    const file = new File(['large-product-image'], 'large-product.png', { type: 'image/png' })

    const result = await compressImageFile(file, productImageCompression, {
      createCanvas: (width, height) => ({
        getContext: () => ({ drawImage }),
        toDataURL,
        width,
        height,
      }),
      loadImage: async () => ({ naturalHeight: 1200, naturalWidth: 1600 }),
      readFileAsDataUrl: async () => 'data:image/png;base64,original-product',
    })

    expect(result).toEqual({
      dataUri: 'data:image/webp;base64,compressed-product',
      fileName: 'large-product.webp',
      height: 600,
      width: 800,
    })
    expect(drawImage).toHaveBeenCalledWith({ naturalHeight: 1200, naturalWidth: 1600 }, 0, 0, 800, 600)
    expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.78)
  })

  it('compresses store logos with a smaller logo policy', async () => {
    const toDataURL = vi.fn(() => 'data:image/webp;base64,compressed-logo')
    const result = await compressImageFile(
      new File(['logo-image'], 'store-logo.png', { type: 'image/png' }),
      logoImageCompression,
      {
        createCanvas: (width, height) => ({
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL,
          width,
          height,
        }),
        loadImage: async () => ({ naturalHeight: 1024, naturalWidth: 1024 }),
        readFileAsDataUrl: async () => 'data:image/png;base64,original-logo',
      },
    )

    expect(result).toEqual({
      dataUri: 'data:image/webp;base64,compressed-logo',
      fileName: 'store-logo.webp',
      height: 512,
      width: 512,
    })
    expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.82)
  })

  it('falls back to the original data URI when browser compression is unavailable', async () => {
    const result = await compressImageFile(
      new File(['raw-image'], 'raw-image.png', { type: 'image/png' }),
      productImageCompression,
      {
        createCanvas: () => ({
          getContext: () => null,
          toDataURL: () => '',
          width: 0,
          height: 0,
        }),
        loadImage: async () => ({ naturalHeight: 300, naturalWidth: 400 }),
        readFileAsDataUrl: async () => 'data:image/png;base64,original-image',
      },
    )

    expect(result).toEqual({
      dataUri: 'data:image/png;base64,original-image',
      fileName: 'raw-image.png',
      height: 300,
      width: 400,
    })
  })
})
