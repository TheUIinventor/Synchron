#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
let pngToIco = require('png-to-ico')
if (pngToIco && pngToIco.default) pngToIco = pngToIco.default

const src = path.resolve(__dirname, '..', 'public', 'favicon.png')
const outDir = path.resolve(__dirname, '..', 'public')

// Detect non-transparent bounding box of the image by reading the alpha channel
async function detectContentBBox(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const alphaIndex = channels - 1

  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels + alphaIndex
      const a = data[idx]
      if (a > 16) { // threshold: consider pixel non-transparent
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // no opaque pixels found — return full canvas
    return { left: 0, top: 0, width, height }
  }

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

async function main() {
  if (!fs.existsSync(src)) {
    console.error('Source file not found:', src)
    process.exit(1)
  }

  try {
    // Sizes to produce (including larger sizes for high-DPI)
    const sizes = [
      { name: 'favicon-16.png', size: 16 },
      { name: 'favicon-32.png', size: 32 },
      { name: 'favicon-48.png', size: 48 },
      { name: 'favicon-64.png', size: 64 },
      { name: 'favicon-128.png', size: 128 },
      { name: 'favicon-256.png', size: 256 },
      { name: 'favicon-512.png', size: 512 },
      { name: 'apple-touch-icon.png', size: 180 },
    ]

    // Detect content bbox and crop to it with a small padding, so the logo fills more of the favicon
    const bbox = await detectContentBBox(src)
    const img = sharp(src).extract({
      left: bbox.left,
      top: bbox.top,
      width: bbox.width,
      height: bbox.height,
    })

    const pngPaths = []

    for (const s of sizes) {
      const outPath = path.join(outDir, s.name)

    // Resize the cropped content to overscale (e.g. 120%) so the visible logo is larger and may crop at edges
      const target = s.size
      const OVERSCALE = 1.2
      const inner = Math.round(target * OVERSCALE)

      // Produce an overscaled buffer, then center-crop to the target size so it fills and is cropped
      const overscaledBuf = await img
        .clone()
        .resize(inner, inner, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
        .png()
        .toBuffer()

      // If the overscaled image is bigger than target, extract a centered region of size target
      const overscaledMeta = await sharp(overscaledBuf).metadata()
      let finalBuf = overscaledBuf
      if (overscaledMeta.width > target || overscaledMeta.height > target) {
        const left = Math.max(0, Math.floor((overscaledMeta.width - target) / 2))
        const top = Math.max(0, Math.floor((overscaledMeta.height - target) / 2))
        finalBuf = await sharp(overscaledBuf).extract({ left, top, width: target, height: target }).png().toBuffer()
      }

  fs.writeFileSync(outPath, finalBuf)
      console.log('Wrote', outPath)

      if ([16, 32, 48, 64, 128, 256].includes(s.size)) pngPaths.push(outPath)
    }

    // Build multi-size ICO from the PNG files (16..256)
    const icoBuf = await pngToIco(pngPaths)
    fs.writeFileSync(path.join(outDir, 'favicon.ico'), icoBuf)
    console.log('Wrote', path.join(outDir, 'favicon.ico'))

    console.log('Favicon generation complete.')
  } catch (err) {
    console.error('Failed to generate favicons:', err)
    process.exit(1)
  }
}

main()
