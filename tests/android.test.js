const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const script = fs.readFileSync(path.join(__dirname, '..', 'android-app', 'app', 'src', 'main', 'assets', 'app.js'), 'utf8')

function app(saved = new Map()) {
  const nodes = { screen: { innerHTML: '', textContent: '' }, notice: { textContent: '', className: '', hidden: true } }
  const handlers = {}
  const document = {
    getElementById(id) { return nodes[id] || null },
    querySelectorAll() { return [] },
    addEventListener(name, handler) { handlers[name] = handler },
    createElement() { throw new Error('Not expected in this test') }
  }
  const context = vm.createContext({ document, localStorage: { getItem: key => saved.has(key) ? saved.get(key) : null, setItem: (key, value) => saved.set(key, value) }, window: { scrollTo() {} }, alert() { throw new Error('A native alert should not appear') }, confirm() { return true }, setTimeout() { return 1 }, clearTimeout() {}, Date, Math, Image: class {}, URL })
  vm.runInContext(script, context)
  function click(action, value, id) {
    handlers.click({ target: { closest(selector) { return selector === '[data-action]' ? { dataset: { action, value, id } } : null } } })
  }
  function tab(name) {
    handlers.click({ target: { closest(selector) { return selector === '[data-tab]' ? { dataset: { tab: name } } : null } } })
  }
  function input(id, value) { handlers.input({ target: { id, value } }) }
  return { nodes, saved, click, tab, input }
}

test('Android app saves approximate prices and draws within a budget', () => {
  const saved = new Map([['eatwhat.android.v1', JSON.stringify({
    seedVersion: 'campus-20-v3',
    meals: [
      { id: 'a', name: '便宜饭', location: '一食堂', price: 12, mealTimes: ['午饭'], tags: [] },
      { id: 'b', name: '贵饭', location: '一食堂', price: 30, mealTimes: ['午饭'], tags: [] },
      { id: 'c', name: '未标价', location: '一食堂', mealTimes: ['午饭'], tags: [] }
    ], records: []
  })]])
  const instance = app(saved)
  instance.input('budget', '20')
  instance.click('pick')
  assert.match(instance.nodes.screen.innerHTML, /便宜饭/)
  instance.click('record-open')
  instance.click('save-record')
  assert.equal(JSON.parse(saved.get('eatwhat.android.v1')).records[0].price, 12)
  instance.tab('list')
  instance.click('edit', undefined, 'a')
  assert.match(instance.nodes.screen.innerHTML, /value="12"/)
  instance.input('price', '18.5')
  instance.click('save-meal')
  assert.equal(JSON.parse(saved.get('eatwhat.android.v1')).meals[0].price, 18.5)
  assert.equal(JSON.parse(saved.get('eatwhat.android.v1')).records[0].price, 12)
})

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

test('saving a record shows a gentle in-page notice instead of a native alert', () => {
  const instance = app()
  instance.click('pick')
  instance.click('record-open')
  instance.click('save-record')
  assert.match(instance.nodes.screen.innerHTML, /用餐记录/)
  assert.equal(instance.nodes.notice.textContent, '这一顿，记下来了')
  assert.equal(instance.nodes.notice.hidden, false)
  assert.equal(instance.nodes.notice.className, 'notice')
})

test('Android draw skips a recently eaten meal and falls back for a narrow list', () => {
  const saved = new Map([['eatwhat.android.v1', JSON.stringify({
    seedVersion: 'campus-20-v3',
    meals: [
      { id: 'a', name: '煎饼', location: '一食堂', mealTimes: ['早饭'], tags: [] },
      { id: 'b', name: '包子', location: '一食堂', mealTimes: ['早饭'], tags: [] }
    ],
    records: [{ mealId: 'a', mealName: '煎饼', location: '一食堂' }]
  })]])
  const instance = app(saved)
  instance.click('pick')
  assert.match(instance.nodes.screen.innerHTML, /包子/)
  instance.click('pick')
  assert.match(instance.nodes.screen.innerHTML, /煎饼/)
})

test('Android draw does not repeat in one round and skips an inconvenient meal', () => {
  const saved = new Map([['eatwhat.android.v1', JSON.stringify({
    seedVersion: 'campus-20-v3',
    meals: ['a', 'b', 'c'].map(id => ({ id, name: `饭${id}`, location: '一食堂', mealTimes: ['午饭'], tags: [] })),
    records: []
  })]])
  const instance = app(saved)
  instance.click('pick')
  const first = instance.nodes.screen.innerHTML.match(/result-name">(饭.)</)[1]
  instance.click('pick')
  const second = instance.nodes.screen.innerHTML.match(/result-name">(饭.)</)[1]
  instance.click('skip-unavailable')
  const third = instance.nodes.screen.innerHTML.match(/result-name">(饭.)</)[1]
  assert.equal(new Set([first, second, third]).size, 3)
  instance.click('skip-unavailable')
  assert.match(instance.nodes.screen.innerHTML, /重新抽一轮/)
  instance.click('restart-round')
  assert.match(instance.nodes.screen.innerHTML, /本轮可选 3 样/)
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
