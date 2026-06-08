const MAX_IMAGE_DIMENSION = 2000
const JPEG_QUALITY = 0.8

/** Compress an image file to JPEG, max 2000px on longest edge. */
export async function compressImage(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file)
  return compressBitmap(bitmap)
}

/** Compress an image from a URL to JPEG. */
export async function compressImageFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  return compressBitmap(bitmap)
}

async function compressBitmap(bitmap: ImageBitmap): Promise<Uint8Array> {
  let { width, height } = bitmap

  // Scale down if needed
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: JPEG_QUALITY,
  })

  return new Uint8Array(await blob.arrayBuffer())
}
