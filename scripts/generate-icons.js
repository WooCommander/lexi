/**
 * public/icon.svg → assets/*.png для `npx capacitor-assets generate`.
 * Run: npm run android:icons
 */
import { mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'
import { root } from './version.js'

const out = resolve(root, 'assets')
mkdirSync(out, { recursive: true })

const svg = readFileSync(resolve(root, 'public/icon.svg'))
// Для адаптивной иконки Android: только «карточки» без фона, с полями под маску
const foregroundSvg = Buffer.from(
    svg.toString().replace(/<rect width="512" height="512"[^>]*\/>/, ''),
)

const render = (input, size) => sharp(input, { density: 384 }).resize(size, size).png()

await render(svg, 1024).toFile(resolve(out, 'icon-only.png'))

const fg = await render(foregroundSvg, 640).toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toFile(resolve(out, 'icon-foreground.png'))

await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0F8B77' } })
    .png()
    .toFile(resolve(out, 'icon-background.png'))

const logo = await render(svg, 600).toBuffer()
for (const [name, bg] of [['splash.png', '#F6F4EF'], ['splash-dark.png', '#12161C']]) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
        .composite([{ input: logo, gravity: 'center' }])
        .png()
        .toFile(resolve(out, name))
}

console.log('✓ assets/: icon-only, icon-foreground, icon-background, splash, splash-dark')
