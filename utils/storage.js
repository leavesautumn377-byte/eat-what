const { MEAL_TIMES } = require('./options')
const REMOVED_TAGS = new Set(['震撼美味', '多巴胺疯狂分泌'])
const TAG_ALIASES = {
  '养生易消化': '养生', '养生局': '养生',
  '重口很上头': '重口', '重口味': '重口',
  '碳水让我快乐': '碳水', '碳水快乐': '碳水',
  '清爽没负担': '清爽', '清爽派': '清爽',
  '热乎乎很治愈': '热乎', '热乎乎': '热乎'
}
const SEED_VERSION_KEY = 'meal_choices_seed_version'
const SEED_VERSION = 'campus-20-v3'
const MEAL_BACKUP_KEY = 'meal_choices_before_campus_20'
let sequence = 0

function key(name) {
  return getApp().globalData.storageKeys[name]
}

function createId() {
  sequence += 1
  return Date.now().toString(36) + '-' + sequence.toString(36)
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((item, index) => typeof item === 'string' && item && value.indexOf(item) === index)
    : []
}

function visibleTags(value) {
  return [...new Set(stringArray(value)
    .filter((tag) => !REMOVED_TAGS.has(tag))
    .map((tag) => TAG_ALIASES[tag] || tag))]
}

function normalizeMeal(item) {
  const legacyTags = {
    '面食': ['面食'], '米饭': ['米饭'], '正餐': ['米饭'], '减脂': ['轻食', '养生']
  }
  const times = stringArray(item.mealTimes)
  return {
    ...item,
    id: item.id ? String(item.id) : createId(),
    name: text(item.name, '未命名餐食'),
    location: text(item.location),
    mealTimes: times.length ? times : item.category === '早饭' ? ['早饭'] : MEAL_TIMES.slice(),
    tags: Array.isArray(item.tags) ? visibleTags(item.tags) : legacyTags[item.category] || []
  }
}

function normalizeRecord(item) {
  return {
    ...item,
    id: item.id ? String(item.id) : createId(),
    mealId: item.mealId ? String(item.mealId) : '',
    mealName: text(item.mealName, '未命名餐食'),
    location: text(item.location),
    mealTime: text(item.mealTime),
    tags: visibleTags(item.tags),
    rating: text(item.rating),
    note: text(item.note),
    photoPath: text(item.photoPath),
    source: text(item.source, '手动记录'),
    dateText: text(item.dateText),
    timeText: text(item.timeText)
  }
}

function validItems(items) {
  return items.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
}

function mealKey(meal) {
  return meal.location + '\u0000' + meal.name
}

function onlyCampusMeals(meals) {
  const matches = new Map()
  meals.forEach((meal) => {
    const key = mealKey(meal)
    if (!matches.has(key)) matches.set(key, meal)
  })
  const defaults = getDefaultMeals()
  const preservedIds = new Set(defaults.map((meal) => matches.get(mealKey(meal))?.id).filter(Boolean))
  return defaults.map((meal) => {
    const existing = matches.get(mealKey(meal))
    if (existing) return { ...meal, id: existing.id }
    while (preservedIds.has(meal.id)) meal.id = createId()
    preservedIds.add(meal.id)
    return meal
  })
}

function getMeals() {
  const saved = wx.getStorageSync(key('meals'))
  if (Array.isArray(saved)) {
    const meals = validItems(saved).map(normalizeMeal)
    if (wx.getStorageSync(SEED_VERSION_KEY) === SEED_VERSION) return meals
    const updated = onlyCampusMeals(meals)
    if (!wx.getStorageSync(MEAL_BACKUP_KEY)) wx.setStorageSync(MEAL_BACKUP_KEY, saved)
    saveMeals(updated)
    wx.setStorageSync(SEED_VERSION_KEY, SEED_VERSION)
    return updated
  }
  if (saved !== '' && saved !== undefined && saved !== null) {
    throw new Error('吃饭清单读取失败，请先保留数据并重试')
  }
  const defaults = getDefaultMeals()
  saveMeals(defaults)
  wx.setStorageSync(SEED_VERSION_KEY, SEED_VERSION)
  return defaults
}

function saveMeals(meals) {
  wx.setStorageSync(key('meals'), meals)
}

function getRecords() {
  const saved = wx.getStorageSync(key('records'))
  if (Array.isArray(saved)) return validItems(saved).map(normalizeRecord)
  if (saved !== '' && saved !== undefined && saved !== null) {
    throw new Error('吃饭记录读取失败，请先保留数据并重试')
  }
  return []
}

function saveRecords(records) {
  wx.setStorageSync(key('records'), records)
}

function addMeal(payload) {
  const meals = getMeals()
  const meal = normalizeMeal({ ...payload, id: createId() })
  const next = [meal].concat(meals)
  saveMeals(next)
  return next
}

function updateMeal(id, payload) {
  const meals = getMeals()
  if (!meals.some((meal) => meal.id === id)) throw new Error('这份吃的已经被删除了')
  const next = meals.map((meal) => meal.id === id ? normalizeMeal({ ...meal, ...payload, id }) : meal)
  saveMeals(next)
  return next
}

function removeMeal(id) {
  const next = getMeals().filter((meal) => meal.id !== id)
  saveMeals(next)
  return next
}

function addRecord(payload) {
  const records = getRecords()
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const record = normalizeRecord({
    ...payload,
    id: createId(),
    dateText: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
    timeText: pad(now.getHours()) + ':' + pad(now.getMinutes())
  })
  const next = [record].concat(records)
  saveRecords(next)
  return next
}

function removeRecord(id) {
  const next = getRecords().filter((record) => record.id !== id)
  saveRecords(next)
  return next
}

function getDefaultMeals() {
  return [
    ['三食堂三楼', '咖喱菠萝鸡饭', ['午饭', '晚饭'], ['碳水']],
    ['一食堂一楼', '椒麻鸡饭', ['午饭', '晚饭'], ['重口', '碳水']],
    ['一三', '石锅饭', ['午饭', '晚饭'], ['热乎', '碳水']],
    ['一三', '自选', ['午饭', '晚饭'], []],
    ['一三', '滑蛋饭', ['午饭', '晚饭'], ['碳水', '热乎']],
    ['首联', '临榆炸鸡腿', ['午饭', '晚饭', '夜宵'], ['重口']],
    ['首联', '肉蛋堡', ['早饭', '午饭', '夜宵'], ['碳水']],
    ['三食堂旁红房子', '炸鸡', ['午饭', '晚饭', '夜宵'], ['重口']],
    ['三食堂旁红房子', '煎饼', ['早饭', '午饭', '晚饭'], ['碳水']],
    ['小洞天', '杭州小吃', ['午饭', '晚饭'], []],
    ['小洞天', '冒菜', ['午饭', '晚饭', '夜宵'], ['重口', '热乎']],
    ['小洞天', '塔斯汀', ['午饭', '晚饭', '夜宵'], ['碳水']],
    ['首联', '肯德基', ['午饭', '晚饭', '夜宵'], ['重口']],
    ['首联', '醉面', ['午饭', '晚饭', '夜宵'], ['碳水', '热乎']],
    ['首联', '袁记云饺', ['午饭', '晚饭', '夜宵'], ['热乎']],
    ['北街', '壹号烧烤', ['晚饭', '夜宵'], ['重口']],
    ['北街', '戳子肉', ['晚饭', '夜宵'], ['重口']],
    ['北街', '火锅鸡', ['午饭', '晚饭', '夜宵'], ['重口', '热乎']],
    ['北街', '小城故事', ['午饭', '晚饭'], []],
    ['北街', '沙威玛', ['午饭', '晚饭', '夜宵'], ['碳水']]
  ].map(([location, name, mealTimes, tags], index) => normalizeMeal({
    id: 'default-' + (index + 1), location, name, mealTimes, tags
  }))
}

module.exports = {
  addMeal, updateMeal, removeMeal, getMeals, saveMeals,
  addRecord, removeRecord, getRecords, saveRecords
}
