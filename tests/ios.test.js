const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file))
const ios = file => path.join('ios-app', 'EatWhat', file)

test('iPhone project bundles the same offline interface and artwork', () => {
  for (const asset of ['index.html', 'style.css', 'watercolor-home.jpg', 'wenkai-ui.ttf']) {
    assert.deepEqual(read(ios(path.join('Web', asset))), read(path.join('android-app', 'app', 'src', 'main', 'assets', asset)))
  }
  const script = read(ios(path.join('Web', 'app.js'))).toString()
  assert.match(script, /拍照或选照片/)
  assert.doesNotMatch(script, /capture="environment"|安卓 App/)
  assert.match(script, /保存在这台 iPhone 上/)
})

test('iPhone project has a valid opaque 1024px icon and privacy strings', () => {
  const icon = read(ios(path.join('Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-1024.png')))
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(icon.readUInt32BE(16), 1024)
  assert.equal(icon.readUInt32BE(20), 1024)
  assert.equal(icon[25], 2)
  const plist = read(ios('Info.plist')).toString()
  assert.match(plist, /NSCameraUsageDescription/)
  assert.match(plist, /NSPhotoLibraryUsageDescription/)
  const project = read(path.join('ios-app', 'EatWhat.xcodeproj', 'project.pbxproj')).toString()
  assert.match(project, /AppIcon/)
  assert.match(project, /Web in Resources/)
  assert.match(project, /MealWebViewController.swift in Sources/)
})
