#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
let pngToIco = require('png-to-ico')
if (pngToIco && pngToIco.default) pngToIco = pngToIco.default

const src = path.resolve(__dirname, '..', 'public', 'favicon.png')
const outDir = path.resolve(__dirname, '..', 'public')

async function main() {
  if (!fs.existsSync(src)) {
    console.error('Source file not found:', src)
    process.exit(1)
  }

  try {
    const sizes = [
      { name: 'favicon-16.png', size: 16 },
      { name: 'favicon-32.png', size: 32 },
      { name: 'favicon-48.png', size: 48 },
      { name: 'apple-touch-icon.png', size: 180 },
    ]

    const pngPaths = []

    for (const s of sizes) {
      const outPath = path.join(outDir, s.name)
      const buf = await sharp(src)
        .resize(s.size, s.size, { fit: 'contain' })
        .png()
        .toBuffer()
      fs.writeFileSync(outPath, buf)
      console.log('Wrote', outPath)
      if ([16, 32, 48].includes(s.size)) pngPaths.push(outPath)
    }

    // Build multi-size ICO from the 16/32/48 PNG files
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
