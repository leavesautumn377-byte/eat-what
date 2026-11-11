const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { environment, plain, tap, root } = require('./helpers')

test('empty meal list stays empty after deleting all samples and reopening', () => {
  const env = environment()
  const storage = env.load('utils/storage.js')
  const meals = storage.getMeals()
  assert.ok(meals.length > 0)
  meals.forEach((meal) => storage.removeMeal(meal.id))
  assert.equal(storage.getMeals().length, 0)
  assert.equal(env.page('index').data.filteredMeals.length, 0)
})

test('first run contains the requested 20 meals with matching places', () => {
  const meals = environment().load('utils/storage.js').getMeals()
  const pairs = meals.map((meal) => `${meal.location} ${meal.name}`)
  assert.equal(meals.length, 20)
  assert.equal(new Set(pairs).size, 20)
  assert.ok(pairs.includes('三食堂三楼 咖喱菠萝鸡饭'))
  assert.ok(pairs.includes('一三 自选'))
  assert.ok(pairs.includes('北街 沙威玛'))
  assert.ok(meals.every((meal) => meal.mealTimes.length > 0))
})

test('one-time replacement removes every meal outside the requested 20', () => {
  const env = environment()
  env.saved.set('meal_choices', [
    { id: '3', name: '煲仔饭', category: '正餐', location: '我的食堂', extra: true },
    { id: '4', name: '砂锅米线', category: '面食' },
    { id: '5', name: '轻食沙拉', category: '减脂' }
  ])
  const before = JSON.stringify(env.saved.get('meal_choices'))
  const meals = env.load('utils/storage.js').getMeals()
  assert.equal(meals.length, 20)
  assert.equal(meals.some((meal) => ['煲仔饭', '砂锅米线', '轻食沙拉'].includes(meal.name)), false)
  assert.notEqual(JSON.stringify(env.saved.get('meal_choices')), before)
  assert.equal(JSON.stringify(env.saved.get('meal_choices_before_campus_20')), before)
})

test('removed labels disappear without deleting saved meals or records', () => {
  const env = environment()
  const oldTags = ['震撼美味', '多巴胺疯狂分泌', '重口很上头']
  env.saved.set('meal_choices_seed_version', 'campus-20-v3')
  env.saved.set('meal_choices', [{ id: 'old', name: '食堂拌饭', tags: oldTags }])
  env.saved.set('meal_records', [{ id: 'record', mealName: '食堂拌饭', tags: oldTags }])
  const storage = env.load('utils/storage.js')
  const options = env.load('utils/options.js')

  assert.deepEqual(plain(storage.getMeals().find((meal) => meal.id === 'old').tags), ['重口'])
  assert.deepEqual(plain(storage.getRecords()[0].tags), ['重口'])
  assert.equal(storage.getMeals().find((meal) => meal.id === 'old').name, '食堂拌饭')
  assert.equal(options.TAGS.includes('震撼美味'), false)
  assert.equal(options.TAGS.includes('多巴胺疯狂分泌'), false)
  assert.deepEqual(env.saved.get('meal_choices').find((meal) => meal.id === 'old').tags, oldTags)
})

test('previous short tags remain selectable under the simpler labels', () => {
  const env = environment()
  env.saved.set('meal_choices_seed_version', 'campus-20-v3')
  env.saved.set('meal_choices', [{
    id: 'saved', name: '椒麻鸡饭', mealTimes: ['午饭'],
    tags: ['重口味', '碳水快乐', '热乎乎']
  }])
  const storage = env.load('utils/storage.js')
  const options = env.load('utils/options.js')
  assert.deepEqual(plain(storage.getMeals().find((meal) => meal.id === 'saved').tags), ['重口', '碳水', '热乎'])
  assert.ok(options.filterMeals(storage.getMeals(), '午饭', ['重口', '碳水']).some((meal) => meal.id === 'saved'))
})

test('existing mixed list becomes exactly 20 meals while records remain', () => {
  const env = environment()
  env.saved.set('meal_choices_seed_version', 'campus-20-v2')
  env.saved.set('meal_choices', [
    { id: '1', name: '黄焖鸡米饭', location: '', mealTimes: ['午饭', '晚饭'], tags: ['碳水让我快乐', '重口很上头'] },
    { id: '2', name: '兰州拉面', location: '', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['碳水让我快乐', '热乎乎很治愈'] },
    { id: 'other-1', name: '豆浆油条', location: '食堂' },
    { id: 'other-2', name: '黄焖鸡', location: '校门口' },
    { id: 'other-3', name: '番茄鸡蛋面', location: '一食堂' },
    { id: 'mine', name: '我的小店', location: '校门口', mealTimes: ['晚饭'], tags: ['清爽派'] }
  ])
  env.saved.set('meal_records', [{ id: 'record', mealName: '黄焖鸡米饭', note: '以前吃的' }])
  const storage = env.load('utils/storage.js')
  const meals = storage.getMeals()
  assert.equal(meals.length, 20)
  assert.equal(meals.some((meal) => meal.name === '黄焖鸡米饭'), false)
  assert.equal(meals.some((meal) => meal.name === '兰州拉面'), false)
  assert.equal(meals.some((meal) => ['豆浆油条', '黄焖鸡', '番茄鸡蛋面'].includes(meal.name)), false)
  assert.equal(meals.some((meal) => meal.id === 'mine'), false)
  assert.equal(storage.getRecords()[0].note, '以前吃的')
  assert.equal(storage.getMeals().length, 20)
  assert.equal(env.saved.get('meal_choices_before_campus_20').length, 6)
})

test('a previous seed upgrade still replaces the whole list', () => {
  const env = environment()
  env.saved.set('meal_choices_seed_version', 'campus-20-v1')
  env.saved.set('meal_choices', [
    { id: '1', name: '黄焖鸡米饭', location: '', mealTimes: ['夜宵'], tags: ['养生'] },
    { id: 'mine', name: '黄焖鸡米饭', location: '校门口', mealTimes: ['午饭'], tags: ['碳水'] }
  ])
  const meals = env.load('utils/storage.js').getMeals()
  assert.equal(meals.length, 20)
  assert.equal(meals.some((meal) => meal.id === '1'), false)
  assert.equal(meals.some((meal) => meal.id === 'mine'), false)
  assert.equal(env.saved.get('meal_choices_seed_version'), 'campus-20-v3')
})

test('upgrade does not duplicate meals already saved with the same place and name', () => {
  const env = environment()
  env.saved.set('meal_choices', [{
    id: 'mine', name: '咖喱菠萝鸡饭', location: '三食堂三楼',
    mealTimes: ['晚饭'], tags: ['重口']
  }])
  const storage = env.load('utils/storage.js')
  const meals = storage.getMeals()
  assert.equal(meals.length, 20)
  assert.equal(meals.filter((meal) => meal.name === '咖喱菠萝鸡饭').length, 1)
  assert.equal(meals.find((meal) => meal.id === 'mine').mealTimes[0], '午饭')
  assert.equal(storage.getMeals().length, 20)
})

test('editing survives another read and leaves old record snapshots intact', () => {
  const env = environment()
  const storage = env.load('utils/storage.js')
  const meal = storage.getMeals()[0]
  storage.addRecord({ mealId: meal.id, mealName: meal.name, note: '以前吃的' })
  storage.updateMeal(meal.id, { name: '改过的饭', location: '新店', tags: ['米饭', '养生'] })
  assert.equal(storage.getMeals().find((item) => item.id === meal.id).name, '改过的饭')
  assert.equal(storage.getRecords()[0].mealName, meal.name)
})

test('new IDs stay distinct even when adding quickly', () => {
  const storage = environment().load('utils/storage.js')
  for (let i = 0; i < 20; i++) storage.addMeal({ name: '饭' })
  const ids = storage.getMeals().map((meal) => meal.id)
  assert.equal(ids.length, new Set(ids).size)
})

test('multiple tags use AND matching and dislike ratings do not remove meals', () => {
  const env = environment()
  const storage = env.load('utils/storage.js')
  const options = env.load('utils/options.js')
  const meals = storage.getMeals()
  storage.addRecord({ mealId: meals[0].id, mealName: meals[0].name, rating: '不想再吃' })
  const filtered = options.filterMeals(storage.getMeals(), '午饭', ['碳水', '重口'])
  assert.ok(filtered.some((meal) => meal.name === '椒麻鸡饭'))
  assert.ok(filtered.every((meal) => meal.tags.includes('碳水') && meal.tags.includes('重口')))
  assert.equal(options.filterMeals(meals, '早饭', ['重口', '清爽']).length, 0)
  assert.equal(options.filterMeals(meals, '', []).length, meals.length)
})

test('reroll excludes current meal when alternatives exist', () => {
  const options = environment().load('utils/options.js')
  const meals = [{ id: 'a' }, { id: 'b' }]
  for (let i = 0; i < 30; i++) assert.equal(options.pickMeal(meals, 'a').id, 'b')
  assert.equal(options.pickMeal([meals[0]], 'a').id, 'a')
  assert.equal(options.pickMeal([], ''), null)
})

test('mini-program pick, result and record use separate screens', () => {
  const page = environment().page('index')
  page.onShow()
  assert.equal(page.data.screen, 'pick')
  page.chooseMeal()
  assert.equal(page.data.screen, 'result')
  page.openRecordPanel()
  assert.equal(page.data.screen, 'record')
  page.backToResult()
  assert.equal(page.data.screen, 'result')
  page.backToPick()
  assert.equal(page.data.screen, 'pick')
})

test('page selection highlights multiple tags and clear keeps the meal time', () => {
  const page = environment().page('index')
  page.onShow()
  page.selectMealTime(tap('午饭'))
  page.toggleTag(tap('碳水'))
  page.toggleTag(tap('重口'))
  assert.equal(page.data.tagOptions.filter((item) => item.selected).length, 2)
  assert.ok(page.data.filteredMeals.length)
  page.clearTags()
  assert.equal(page.data.selectedMealTime, '午饭')
  assert.equal(page.data.tagOptions.filter((item) => item.selected).length, 0)
})

test('editing a meal out of the current filter clears the stale result', () => {
  const env = environment()
  const storage = env.load('utils/storage.js')
  const page = env.page('index')
  page.onShow()
  page.selectMealTime(tap('早饭'))
  page.chooseMeal()
  const id = page.data.resultMeal.id
  storage.updateMeal(id, { mealTimes: ['午饭'] })
  page.onShow()
  assert.equal(page.data.resultMeal, null)
  assert.equal(page.data.showRecordPanel, false)
  assert.equal(page.data.filteredMeals.some((meal) => meal.id === id), false)
})

test('reroll fades the old result, then reveals a different meal', async () => {
  const page = environment().page('index')
  page.onShow()
  page.chooseMeal()
  const firstId = page.data.resultMeal.id
  page.rerollMeal()
  assert.equal(page.data.resultAnimating, true)
  assert.equal(page.data.resultMotion, 'result-leave')
  page.rerollMeal()
  await new Promise((resolve) => setTimeout(resolve, 220))
  assert.equal(page.data.resultAnimating, false)
  assert.equal(page.data.resultMotion, 'result-enter')
  assert.notEqual(page.data.resultMeal.id, firstId)
})

test('changing filters cancels an in-flight reroll', async () => {
  const page = environment().page('index')
  page.onShow()
  page.chooseMeal()
  page.rerollMeal()
  page.selectMealTime(tap('早饭'))
  await new Promise((resolve) => setTimeout(resolve, 220))
  assert.equal(page.data.resultAnimating, false)
  assert.equal(page.data.resultMeal, null)
  assert.equal(page.data.selectedMealTime, '早饭')
})

test('empty optional record can be saved once and does not invent a meal time', async () => {
  const env = environment()
  const page = env.page('index')
  page.onShow()
  page.chooseMeal()
  assert.equal(env.load('utils/storage.js').getRecords().length, 0)
  await page.saveRecord()
  await page.saveRecord()
  const records = env.load('utils/storage.js').getRecords()
  assert.equal(records.length, 1)
  assert.equal(records[0].mealTime, '')
  assert.equal(records[0].photoPath, '')
  assert.equal(records[0].rating, '')
})

test('failed photo save keeps form and does not create a broken record', async () => {
  const env = environment()
  const page = env.page('index')
  page.onShow()
  page.chooseMeal()
  page.openRecordPanel()
  page.setData({ 'recordForm.photoPath': 'temp/photo.jpg', 'recordForm.note': '保留我' })
  env.state.failPhoto = true
  await page.saveRecord()
  assert.equal(env.load('utils/storage.js').getRecords().length, 0)
  assert.equal(page.data.recordForm.note, '保留我')
  assert.equal(page.data.recordForm.photoPath, 'temp/photo.jpg')
  assert.equal(page.data.isSaving, false)
  assert.ok(env.calls.modals.length)
})

test('storage failure after saving photo can retry without moving the photo twice', async () => {
  const env = environment()
  const page = env.page('index')
  page.onShow()
  page.chooseMeal()
  page.setData({ 'recordForm.photoPath': 'temp/photo.jpg', 'recordForm.note': '很好吃' })
  env.state.failWrite = true
  await page.saveRecord()
  assert.equal(page.data.resultRecorded, false)
  assert.equal(page.data.recordForm.photoPath, 'saved/photo-1.jpg')
  env.state.failWrite = false
  await page.saveRecord()
  assert.equal(env.calls.savedPhotos, 1)
  assert.equal(env.load('utils/storage.js').getRecords()[0].photoPath, 'saved/photo-1.jpg')
  assert.equal(page.data.resultRecorded, true)
})

test('double tap during pending photo save produces only one record', async () => {
  const env = environment()
  const page = env.page('index')
  page.onShow()
  page.chooseMeal()
  page.setData({ 'recordForm.photoPath': 'temp/photo.jpg' })
  let finish
  env.wx.saveFile = (args) => { finish = args.success }
  const first = page.saveRecord()
  await page.saveRecord()
  finish({ savedFilePath: 'saved/one.jpg' })
  await first
  assert.equal(env.load('utils/storage.js').getRecords().length, 1)
})

test('cancelling photo selection preserves previous choice', async () => {
  const env = environment()
  const page = env.page('index')
  page.setData({ 'recordForm.photoPath': 'previous.jpg' })
  env.state.cancelPhoto = true
  await page.choosePhoto()
  assert.equal(page.data.recordForm.photoPath, 'previous.jpg')
  assert.equal(page.data.isChoosingPhoto, false)
})

test('clear and delete remove only photos without remaining references', async () => {
  const env = environment()
  const photos = env.load('utils/photos.js')
  await photos.removePhotos([{ photoPath: 'a.jpg' }, { photoPath: 'b.jpg' }], [{ photoPath: 'b.jpg' }])
  assert.deepEqual(env.calls.removed, ['a.jpg'])
})

test('record summary handles user names that match Object keys and deletion cancel', () => {
  const env = environment()
  const storage = env.load('utils/storage.js')
  storage.addRecord({ mealName: '__proto__' })
  const page = env.page('records')
  page.onShow()
  assert.equal(page.data.summary.favoriteMealDisplay, '__proto__')
  assert.equal(page.data.summary.count, 1)
  env.state.confirm = false
  page.deleteRecord({ currentTarget: { dataset: { id: page.data.records[0].id } } })
  assert.equal(storage.getRecords().length, 1)
  env.state.confirm = true
  page.deleteRecord({ currentTarget: { dataset: { id: page.data.records[0].id } } })
  assert.equal(storage.getRecords().length, 0)
})

test('list editing updates options; cancel delete keeps data', () => {
  const env = environment()
  const page = env.page('wheel')
  page.onShow()
  const id = page.data.meals[0].id
  page.editMeal({ currentTarget: { dataset: { id } } })
  page.setData({ mealName: '自己改的名字' })
  page.saveMeal()
  page.onShow()
  assert.equal(page.data.meals.find((meal) => meal.id === id).name, '自己改的名字')
  env.state.confirm = false
  page.deleteMeal({ currentTarget: { dataset: { id } } })
  assert.ok(page.data.meals.some((meal) => meal.id === id))
})

test('templates avoid function calls, entity codes, and missing event handlers', () => {
  const env = environment()
  for (const name of ['index', 'wheel', 'records']) {
    const template = fs.readFileSync(path.join(root, 'pages', name, name + '.wxml'), 'utf8')
    const page = env.page(name)
    assert.doesNotMatch(template, /&#\d+;/)
    for (const binding of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      assert.doesNotMatch(binding[1], /\w+\s*\(/)
    }
    for (const handler of template.matchAll(/bind\w+="([^"]+)"/g)) {
      assert.equal(typeof page[handler[1]], 'function', handler[1])
    }
    new vm.Script(fs.readFileSync(path.join(root, 'pages', name, name + '.js'), 'utf8'))
  }
  for (const name of ['app.json', 'sitemap.json', 'project.config.example.json']) {
    JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
  }
})
