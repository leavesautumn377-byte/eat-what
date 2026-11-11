const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file))

test('both apps use the same watercolor background', () => {
  assert.deepEqual(read('assets/watercolor-home.jpg'), read('android-app/app/src/main/assets/watercolor-home.jpg'))
  for (const page of ['index', 'wheel', 'records']) {
    assert.match(read(`pages/${page}/${page}.wxml`).toString(), /\/assets\/watercolor-home\.jpg/)
  }
  assert.match(read('android-app/app/src/main/assets/style.css').toString(), /watercolor-home\.jpg/)
})

test('handwriting font is offline and included on both platforms', () => {
  const wxss = read('assets/wenkai-font.wxss').toString()
  const encoded = wxss.match(/base64,([A-Za-z0-9+/=]+)/)
  assert.ok(encoded)
  assert.deepEqual(Buffer.from(encoded[1], 'base64'), read('android-app/app/src/main/assets/wenkai-ui.ttf'))
  assert.match(read('app.wxss').toString(), /assets\/wenkai-font\.wxss/)
  for (const page of ['index', 'wheel', 'records']) {
    assert.match(read(`pages/${page}/${page}.wxss`).toString().trimStart(), /^@import "\.\.\/\.\.\/assets\/watercolor-theme\.wxss";/)
  }
})

test('mini-program buttons follow the original app styles and pages keep large navigation labels', () => {
  const theme = read('assets/watercolor-theme.wxss').toString()
  assert.match(theme, /\.page \.btn-primary, \.page \.btn-light \{[\s\S]*?background: linear-gradient\(90deg, rgba\(247, 250, 244, 0\.79\), rgba\(226, 238, 224, 0\.74\) 50%/)
  assert.match(theme, /\.page \.full-button, \.page \.save-btn, \.page-list \.form-actions \.btn-primary \{[\s\S]*?background: linear-gradient\(90deg, rgba\(229, 240, 228, 0\.73\), rgba\(191, 217, 195, 0\.85\) 50%/)
  assert.match(theme, /\.page \.filter-card-active, \.page \.pill-active \{ background: linear-gradient\(0deg, rgba\(207, 229, 205, 0\.7\), transparent 75%\)/)
  assert.match(theme, /\.bottom-nav-item \{[\s\S]*?font-size: 40rpx/)

  for (const page of ['index', 'wheel', 'records']) {
    const wxml = read(`pages/${page}/${page}.wxml`).toString()
    const js = read(`pages/${page}/${page}.js`).toString()
    assert.equal((wxml.match(/class="bottom-nav-item(?: bottom-nav-item-active)?"/g) || []).length, 3)
    assert.equal((wxml.match(/bottom-nav-item-active/g) || []).length, 1)
    for (const label of ['选一顿', '清单', '记录']) assert.ok(wxml.includes(`<text>${label}</text>`))
    assert.match(js, /wx\.hideTabBar\(\{ animation: false \}\)/)
    assert.match(js, /switchMainTab\(event\)/)
  }
})

test('Android source keeps the original package button styles', () => {
  const css = read('android-app/app/src/main/assets/style.css').toString()
  assert.match(css, /\.chip\.active \{[^}]*background:linear-gradient\(0deg,#cfe3cfb0,transparent 75%\)/)
  assert.match(css, /\.button \{[\s\S]*?background:linear-gradient\(90deg,#f7faf4c9,#e2eee0bc 50%,#f7faf4c9\)/)
  assert.match(css, /\.button\.wide \{[^}]*background:linear-gradient\(90deg,#e5f0e4b9,#bfd9c3d9 50%,#e5f0e4b9\)/)
  assert.match(css, /#tabs button \{ font:17px MealWenKai/)
})

test('handwriting font covers the Chinese UI copy', () => {
  const font = read('assets/wenkai-ui.ttf')
  const tableCount = font.readUInt16BE(4)
  let cmapOffset = -1
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16
    if (font.toString('ascii', record, record + 4) === 'cmap') {
      cmapOffset = font.readUInt32BE(record + 8)
      break
    }
  }
  assert.ok(cmapOffset >= 0)

  const subtableCount = font.readUInt16BE(cmapOffset + 2)
  let format4 = -1
  for (let index = 0; index < subtableCount; index += 1) {
    const record = cmapOffset + 4 + index * 8
    if (font.readUInt16BE(record) === 3 && font.readUInt16BE(record + 2) === 1) {
      format4 = cmapOffset + font.readUInt32BE(record + 4)
      break
    }
  }
  assert.equal(font.readUInt16BE(format4), 4)
  const segmentCount = font.readUInt16BE(format4 + 6) / 2
  const endCodes = format4 + 14
  const startCodes = endCodes + segmentCount * 2 + 2
  const deltas = startCodes + segmentCount * 2
  const offsets = deltas + segmentCount * 2
  const hasGlyph = code => {
    for (let index = 0; index < segmentCount; index += 1) {
      if (code > font.readUInt16BE(endCodes + index * 2)) continue
      const start = font.readUInt16BE(startCodes + index * 2)
      if (code < start) return false
      const delta = font.readInt16BE(deltas + index * 2)
      const offsetPosition = offsets + index * 2
      const rangeOffset = font.readUInt16BE(offsetPosition)
      const glyph = rangeOffset
        ? font.readUInt16BE(offsetPosition + rangeOffset + (code - start) * 2)
        : code
      return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0
    }
    return false
  }

  const uiFiles = ['app.json', 'android-app/app/src/main/assets/app.js', 'android-app/app/src/main/assets/index.html']
  const collect = directory => {
    for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${item.name}`
      if (item.isDirectory()) collect(name)
      else if (/\.(js|wxml)$/.test(name)) uiFiles.push(name)
    }
  }
  collect('pages')
  collect('utils')
  const missing = new Set()
  for (const file of uiFiles) {
    const content = read(file).toString()
    for (const char of content) {
      const code = char.codePointAt(0)
      if (code >= 0x4e00 && code <= 0x9fff && !hasGlyph(code)) missing.add(char)
    }
    for (const match of content.matchAll(/\\u([0-9a-fA-F]{4})/g)) {
      const code = Number.parseInt(match[1], 16)
      if (code >= 0x4e00 && code <= 0x9fff && !hasGlyph(code)) missing.add(String.fromCharCode(code))
    }
  }
  assert.deepEqual([...missing], [])
})

test('mini-program upload excludes native app projects and unused large assets', () => {
  const config = JSON.parse(read('project.config.json'))
  const ignored = config.packOptions.ignore.map(item => `${item.type}:${item.value}`)
  assert.ok(ignored.includes('folder:android-app'))
  assert.ok(ignored.includes('folder:ios-app'))
  assert.ok(ignored.includes('folder:harmony-app'))
  assert.ok(ignored.includes('folder:scripts'))
  assert.ok(ignored.includes('file:assets/longcang-ui.ttf'))
  assert.ok(ignored.includes('file:assets/wenkai-ui.ttf'))
  assert.ok(ignored.includes('file:assets/miniapp-avatar-type-v3.png'))
})
