const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const script = fs.readFileSync(path.join(__dirname, '..', 'android-app', 'app', 'src', 'main', 'assets', 'app.js'), 'utf8')

function app(saved = new Map()) {
  const nodes = { screen: { innerHTML: '', textContent: '' } }
  const handlers = {}
  const document = {
    getElementById(id) { return nodes[id] || null },
    querySelectorAll() { return [] },
    addEventListener(name, handler) { handlers[name] = handler },
    createElement() { throw new Error('Not expected in this test') }
  }
  const context = vm.createContext({ document, localStorage: { getItem: key => saved.has(key) ? saved.get(key) : null, setItem: (key, value) => saved.set(key, value) }, window: { scrollTo() {} }, alert() {}, confirm() { return true }, Date, Math, Image: class {}, URL })
  vm.runInContext(script, context)
  function click(action, value, id) {
    handlers.click({ target: { closest(selector) { return selector === '[data-action]' ? { dataset: { action, value, id } } : null } } })
  }
  function tab(name) {
    handlers.click({ target: { closest(selector) { return selector === '[data-tab]' ? { dataset: { tab: name } } : null } } })
  }
  return { nodes, saved, click, tab }
}

test('Android test app starts with sample meals and can draw again', () => {
  const instance = app()
  assert.match(instance.nodes.screen.innerHTML, /可选 20 样/)
  assert.doesNotMatch(instance.nodes.screen.innerHTML, /最近记录/)
  instance.click('pick')
  assert.match(instance.nodes.screen.innerHTML, /抽到了/)
  assert.doesNotMatch(instance.nodes.screen.innerHTML, /餐食清单/)
  instance.click('pick')
  assert.match(instance.nodes.screen.innerHTML, /换一个/)
  instance.click('record-open')
  assert.match(instance.nodes.screen.innerHTML, /拍照或选照片/)
  assert.doesNotMatch(instance.nodes.screen.innerHTML, /换一个/)
  instance.click('back')
  assert.match(instance.nodes.screen.innerHTML, /换一个/)
})

test('meal editor opens separately from the list and bottom tabs return to main pages', () => {
  const instance = app()
  instance.tab('list')
  assert.match(instance.nodes.screen.innerHTML, /餐食清单/)
  instance.click('add')
  assert.match(instance.nodes.screen.innerHTML, /店名 \/ 食堂名/)
  assert.doesNotMatch(instance.nodes.screen.innerHTML, /咖喱菠萝鸡饭/)
  instance.tab('records')
  assert.match(instance.nodes.screen.innerHTML, /用餐记录/)
  assert.doesNotMatch(instance.nodes.screen.innerHTML, /店名 \/ 食堂名/)
})

test('Android test app preserves an intentionally empty list', () => {
  const instance = app()
  instance.tab('list')
  const ids = JSON.parse(instance.saved.get('eatwhat.android.v1')).meals.map(meal => meal.id)
  ids.forEach(id => instance.click('delete-meal', undefined, id))
  instance.tab('pick')
  assert.match(instance.nodes.screen.innerHTML, /清单是空的/)
  assert.equal(JSON.parse(instance.saved.get('eatwhat.android.v1')).meals.length, 0)
})

test('Android existing mixed list is replaced once without losing records', () => {
  const saved = new Map([['eatwhat.android.v1', JSON.stringify({
    meals: [
      { id: 'old', name: '黄焖鸡米饭', location: '', mealTimes: ['午饭', '晚饭'], tags: ['碳水让我快乐', '重口很上头'] },
      { id: 'mine', name: '我的小店', location: '校门口', mealTimes: ['晚饭'], tags: ['清爽派'] }
    ],
    records: [{ id: 'record', mealName: '黄焖鸡米饭', note: '以前吃的', tags: [] }]
  })]])
  app(saved)
  const first = JSON.parse(saved.get('eatwhat.android.v1'))
  assert.equal(first.meals.length, 20)
  assert.equal(first.meals.some((meal) => meal.name === '黄焖鸡米饭'), false)
  assert.equal(first.meals.some((meal) => meal.id === 'mine'), false)
  assert.equal(first.records[0].note, '以前吃的')
  assert.equal(JSON.parse(saved.get('eatwhat.android.v1.before-campus-20')).meals.length, 2)
  app(saved)
  assert.equal(JSON.parse(saved.get('eatwhat.android.v1')).meals.length, 20)
})

test('Android previous upgrade also removes unlisted same-name custom place', () => {
  const saved = new Map([['eatwhat.android.v1', JSON.stringify({
    seedVersion: 'campus-20-v1',
    meals: [
      { id: 'old', name: '黄焖鸡米饭', location: '', mealTimes: ['夜宵'], tags: ['养生'] },
      { id: 'mine', name: '黄焖鸡米饭', location: '校门口', mealTimes: ['午饭'], tags: ['碳水'] }
    ],
    records: []
  })]])
  app(saved)
  const meals = JSON.parse(saved.get('eatwhat.android.v1')).meals
  assert.equal(meals.length, 20)
  assert.equal(meals.some((meal) => meal.id === 'old'), false)
  assert.equal(meals.some((meal) => meal.id === 'mine'), false)
})
