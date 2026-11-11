const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const plain = (value) => JSON.parse(JSON.stringify(value))

function environment() {
  const saved = new Map()
  const modules = new Map()
  const calls = { toasts: [], modals: [], removed: [], savedPhotos: 0 }
  const state = { failWrite: false, failPhoto: false, confirm: true, cancelPhoto: false }
  let definition
  const wx = {
    getStorageSync: (key) => saved.has(key) ? plain(saved.get(key)) : '',
    setStorageSync: (key, value) => {
      if (state.failWrite) throw new Error('Storage full')
      saved.set(key, plain(value))
    },
    showToast: (value) => calls.toasts.push(value),
    showModal: (value) => {
      calls.modals.push(value)
      if (value.success) value.success({ confirm: state.confirm })
    },
    pageScrollTo() {},
    switchTab() {},
    chooseMedia: (args) => {
      if (state.cancelPhoto) args.fail({ errMsg: 'chooseMedia:fail cancel' })
      else args.success({ tempFiles: [{ tempFilePath: 'temp/photo.jpg' }] })
    },
    saveFile: (args) => {
      calls.savedPhotos += 1
      if (state.failPhoto) args.fail({ errMsg: 'no space' })
      else args.success({ savedFilePath: 'saved/photo-' + calls.savedPhotos + '.jpg' })
    },
    removeSavedFile: (args) => {
      calls.removed.push(args.filePath)
      args.complete({})
    },
    previewImage() {}
  }
  const context = vm.createContext({
    wx,
    setTimeout,
    clearTimeout,
    getApp: () => ({ globalData: { storageKeys: { meals: 'meal_choices', records: 'meal_records' } } }),
    Page: (value) => { definition = value }
  })

  function load(relativePath) {
    const file = path.resolve(root, relativePath)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = fs.readFileSync(file, 'utf8')
    const fn = vm.runInContext('(function(require,module,exports){\n' + source + '\n})', context, { filename: file })
    fn((request) => load(path.relative(root, path.resolve(path.dirname(file), request + '.js'))), module, module.exports)
    return module.exports
  }

  function page(name) {
    load('pages/' + name + '/' + name + '.js')
    const instance = { ...definition, data: plain(definition.data) }
    instance.setData = (patch, callback) => {
      Object.entries(patch).forEach(([key, value]) => {
        const parts = key.split('.')
        let target = instance.data
        parts.slice(0, -1).forEach((part) => { target = target[part] })
        target[parts[parts.length - 1]] = value
      })
      if (callback) callback()
    }
    return instance
  }
  return { wx, load, page, state, calls, saved }
}

function tap(value) { return { currentTarget: { dataset: { value } } } }
module.exports = { environment, plain, tap, root }
