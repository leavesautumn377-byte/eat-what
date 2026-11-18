'use strict'

const TIMES = ['早饭', '午饭', '晚饭', '夜宵']
const TAGS = ['养生', '重口', '碳水', '清爽', '热乎']
const TAG_ALIASES = { '养生易消化': '养生', '养生局': '养生', '重口很上头': '重口', '重口味': '重口', '碳水让我快乐': '碳水', '碳水快乐': '碳水', '清爽没负担': '清爽', '清爽派': '清爽', '热乎乎很治愈': '热乎', '热乎乎': '热乎' }
const RATINGS = ['好吃', '一般', '不想再吃']
const defaults = [
  { name: '咖喱菠萝鸡饭', location: '三食堂三楼', mealTimes: ['午饭', '晚饭'], tags: ['碳水'] },
  { name: '椒麻鸡饭', location: '一食堂一楼', mealTimes: ['午饭', '晚饭'], tags: ['重口', '碳水'] },
  { name: '石锅饭', location: '一三', mealTimes: ['午饭', '晚饭'], tags: ['热乎', '碳水'] },
  { name: '自选', location: '一三', mealTimes: ['午饭', '晚饭'], tags: [] },
  { name: '滑蛋饭', location: '一三', mealTimes: ['午饭', '晚饭'], tags: ['碳水', '热乎'] },
  { name: '临榆炸鸡腿', location: '首联', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['重口'] },
  { name: '肉蛋堡', location: '首联', mealTimes: ['早饭', '午饭', '夜宵'], tags: ['碳水'] },
  { name: '炸鸡', location: '三食堂旁红房子', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['重口'] },
  { name: '煎饼', location: '三食堂旁红房子', mealTimes: ['早饭', '午饭', '晚饭'], tags: ['碳水'] },
  { name: '杭州小吃', location: '小洞天', mealTimes: ['午饭', '晚饭'], tags: [] },
  { name: '冒菜', location: '小洞天', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['重口', '热乎'] },
  { name: '塔斯汀', location: '小洞天', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['碳水'] },
  { name: '肯德基', location: '首联', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['重口'] },
  { name: '醉面', location: '首联', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['碳水', '热乎'] },
  { name: '袁记云饺', location: '首联', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['热乎'] },
  { name: '壹号烧烤', location: '北街', mealTimes: ['晚饭', '夜宵'], tags: ['重口'] },
  { name: '戳子肉', location: '北街', mealTimes: ['晚饭', '夜宵'], tags: ['重口'] },
  { name: '火锅鸡', location: '北街', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['重口', '热乎'] },
  { name: '小城故事', location: '北街', mealTimes: ['午饭', '晚饭'], tags: [] },
  { name: '沙威玛', location: '北街', mealTimes: ['午饭', '晚饭', '夜宵'], tags: ['碳水'] }
]
const seedVersion = 'campus-20-v3'
const storageKey = 'eatwhat.android.v1'
const state = { tab: 'pick', page: '', mealTime: '', tags: [], budgetText: '', seenIds: [], unavailableIds: [], resultId: '', rating: '', photo: '', note: '', editingId: '', formTimes: [], formTags: [], formName: '', formLocation: '', formPrice: '' }
let db
let noticeTimer

function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9) }
function normalizePrice(value) {
  if (value === '' || value === null || value === undefined) return null
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 && price <= 999.99 ? Math.round(price * 100) / 100 : null
}
function budget() { return state.budgetText === '' ? null : Number(state.budgetText) }
function onlyCampusMeals(meals) {
  const key = meal => JSON.stringify([meal.location, meal.name])
  const matches = new Map()
  meals.forEach(meal => { if (!matches.has(key(meal))) matches.set(key(meal), meal) })
  return defaults.map(meal => ({ ...meal, id: matches.get(key(meal))?.id || id(), price: null }))
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (saved && Array.isArray(saved.meals) && Array.isArray(saved.records)) {
      if (saved.seedVersion !== seedVersion && localStorage.getItem(storageKey + '.before-campus-20') === null) {
        localStorage.setItem(storageKey + '.before-campus-20', JSON.stringify(saved))
      }
      const migrate = item => ({ ...item, price: normalizePrice(item.price), tags: Array.isArray(item.tags) ? [...new Set(item.tags.map(tag => TAG_ALIASES[tag] || tag))] : [] })
      const meals = saved.meals.map(migrate)
      return { ...saved, meals: saved.seedVersion === seedVersion ? meals : onlyCampusMeals(meals), records: saved.records.map(migrate), seedVersion }
    }
  } catch (_) { /* Keep a damaged store untouched for recovery. */ }
  if (localStorage.getItem(storageKey) !== null) throw new Error('本地数据读取失败，请不要清除应用数据')
  return { meals: defaults.map(meal => ({ ...meal, id: id(), price: null })), records: [], seedVersion }
}
function save(next) {
  localStorage.setItem(storageKey, JSON.stringify(next))
  db = next
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]) }
function chips(values, selected, action) { return values.map(value => `<button class="chip ${selected.includes(value) ? 'active' : ''}" data-action="${action}" data-value="${esc(value)}">${esc(value)}</button>`).join('') }
function tags(values) { return values.map(value => `<span class="tag">${esc(value)}</span>`).join('') }
function filtered() { return db.meals.filter(meal => (!state.mealTime || meal.mealTimes.includes(state.mealTime)) && state.tags.every(tag => meal.tags.includes(tag)) && (budget() === null || (typeof meal.price === 'number' && meal.price <= budget()))) }
function remaining() { return filtered().filter(meal => !state.seenIds.includes(meal.id) && !state.unavailableIds.includes(meal.id)) }
function pickFrom(meals, previousId) {
  const pool = meals.length > 1 ? meals.filter(meal => meal.id !== previousId) : meals
  const recent = db.records.slice(0, 3)
  const fresh = pool.filter(meal => !recent.some(record => record.mealId
    ? record.mealId === meal.id
    : record.mealName === meal.name && record.location === meal.location))
  const choices = fresh.length ? fresh : pool
  return choices[Math.floor(Math.random() * choices.length)]
}
function resetResult() { state.resultId = ''; state.page = ''; state.photo = ''; state.rating = ''; state.note = ''; state.seenIds = []; state.unavailableIds = [] }
function renderPick() {
  const pool = filtered()
  const left = remaining()
  return `<section class="pick-hero" aria-label="事已至此，先吃饭吧"><p class="hero-kicker">今天吃什么</p></section>
    <section class="section"><h2>时段</h2><div class="chips">${chips(['全部', ...TIMES], [state.mealTime || '全部'], 'time')}</div>
    <div class="row" style="margin-top:24px"><h2>口味</h2>${state.tags.length ? '<button class="button small" data-action="clear-tags">清除</button>' : ''}</div>
    <div class="chips">${chips(TAGS, state.tags, 'filter-tag')}</div>
    <div class="budget-row"><label for="budget">预算</label><input id="budget" type="number" min="0" max="999.99" step="0.01" inputmode="decimal" value="${esc(state.budgetText)}" placeholder="不限"><span>元以内</span></div>
    <p class="hint" id="pool-count">本轮可选 ${left.length} 样${state.budgetText !== '' ? ' · 未填价格的餐食不参与' : ''}</p>
    <button id="draw-button" class="button wide" data-action="pick" ${left.length ? '' : 'disabled'}>抽一顿</button>
    <button id="restart-button" class="button wide" data-action="restart-round" ${pool.length && !left.length ? '' : 'hidden'}>重新抽一轮</button>
    ${pool.length ? '' : `<p class="empty">${db.meals.length ? '还没有符合这些感觉的吃的，少选一个吧。' : '清单是空的，先添加几样平常吃的吧。'}</p>`}</section>`
}
function backButton() { return '<button class="back" data-action="back">‹ 返回</button>' }
function renderResult() {
  const meal = db.meals.find(item => item.id === state.resultId)
  if (!meal) { state.page = ''; return renderPick() }
  return `${backButton()}<section class="section result"><p class="eyebrow">这一顿，交给它</p><h1>抽到了</h1><div class="result-name">${esc(meal.name)}</div>${meal.location ? `<p class="meta">${esc(meal.location)}</p>` : ''}${meal.price !== null ? `<p class="meta">约 ¥${esc(meal.price)}</p>` : ''}<div class="result-tags">${tags([...meal.mealTimes, ...meal.tags])}</div><div class="actions"><button class="button" data-action="${remaining().length ? 'pick' : 'restart-round'}">${remaining().length ? '换一个' : '重新抽一轮'}</button><button class="button" data-action="record-open">记这一顿</button></div><button class="button small skip-unavailable" data-action="skip-unavailable">现在不方便</button></section>`
}
function renderRecordForm() {
  const meal = db.meals.find(item => item.id === state.resultId)
  if (!meal) { state.page = ''; return renderPick() }
  return `${backButton()}<section class="section"><p class="eyebrow">${esc(meal.name)}</p><h1>记录这一顿</h1><p class="hint">照片、评价、想法都可以跳过。</p>
    <h3>照片</h3><label class="button photo-button">${state.photo ? '换一张' : '拍照或选照片'}<input id="photo-input" type="file" accept="image/*" capture="environment"></label>
    ${state.photo ? `<img class="photo" src="${state.photo}" alt="这顿饭的照片"><button class="button small" data-action="remove-photo">不要这张</button>` : ''}
    <h3 style="margin-top:20px">评价</h3><div class="chips">${chips(RATINGS, [state.rating], 'rating')}</div>
    <label class="field" for="note">想法</label><textarea id="note" maxlength="200" placeholder="这顿怎么样？">${esc(state.note)}</textarea>
    <button class="button wide save-button" data-action="save-record">保存记录</button></section>`
}
function renderList() {
  return `<section class="section"><div class="row"><h1>餐食清单</h1><button class="button small" data-action="add">添加吃的</button></div><p class="hint">${db.meals.length} 样吃的</p></section>
    <section class="section">${db.meals.map(item => `<div class="meal"><div class="name" style="font-size:23px">${esc(item.name)}</div><div class="meta">${esc(item.location)}${item.price !== null ? ` · 约 ¥${esc(item.price)}` : ''}</div><div>${tags([...item.mealTimes, ...item.tags])}</div><div class="actions"><button class="button small" data-action="edit" data-id="${esc(item.id)}">修改</button><button class="button small" data-action="delete-meal" data-id="${esc(item.id)}">删除</button></div></div>`).join('') || '<p class="empty">清单是空的，先添加几样你平常吃的吧。</p>'}</section>`
}
function renderMealForm() {
  return `${backButton()}<section class="section"><h1>${state.editingId ? '修改吃的' : '添加吃的'}</h1><label class="field" for="meal-name">吃什么</label><input id="meal-name" type="text" maxlength="30" value="${esc(state.formName)}" placeholder="比如：番茄牛肉饭">
    <label class="field" for="location">店名 / 食堂名（选填）</label><input id="location" type="text" maxlength="40" value="${esc(state.formLocation)}">
    <label class="field" for="price">大概价格（选填）</label><input id="price" type="number" min="0" max="999.99" step="0.01" inputmode="decimal" value="${esc(state.formPrice)}" placeholder="例如 15 元">
    <h3>时段</h3><p class="hint">可多选，不选则不限时段</p><div class="chips">${chips(TIMES, state.formTimes, 'form-time')}</div>
    <h3 style="margin-top:22px">标签（可多选）</h3><div class="chips">${chips(TAGS, state.formTags, 'form-tag')}</div>
    <button class="button wide save-button" data-action="save-meal">保存</button></section>`
}
function renderRecords() {
  const counts = Object.create(null)
  db.records.forEach(record => { counts[record.mealName] = (counts[record.mealName] || 0) + 1 })
  const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return `<section class="section"><h1>用餐记录</h1><p class="lead">吃过的，都记在这里。</p><p>已记录 ${db.records.length} 顿　最常选的 ${esc(favorite?.[0] || '--')}</p>${db.records.length ? '<button class="button small" data-action="clear-records">清空记录</button>' : ''}</section>
    <section class="section">${db.records.map(record => `<article class="meal"><div class="name" style="font-size:23px">${esc(record.mealName)}</div><div class="meta">${esc(record.location || record.source)} / ${esc(record.dateText)} ${esc(record.timeText)}${record.price != null ? ` · 约 ¥${esc(record.price)}` : ''}</div>
    <div>${tags(record.tags || [])}</div>${record.photo ? `<img class="photo" src="${record.photo}" alt="${esc(record.mealName)}的照片">` : ''}${record.rating ? `<p>${esc(record.rating)}</p>` : ''}${record.note ? `<p>${esc(record.note)}</p>` : ''}<button class="button small" data-action="delete-record" data-id="${esc(record.id)}">删除这条</button></article>`).join('') || '<p class="empty">还没有记录，先去选一顿吧。</p>'}</section>
    <p class="hint">记录和照片保存在这个安卓 App 内，不会同步给其他人。</p>`
}
function render() {
  if (document.body) document.body.dataset.view = state.page || state.tab
  document.getElementById('screen').innerHTML = state.page === 'result' ? renderResult() : state.page === 'recordForm' ? renderRecordForm() : state.page === 'mealForm' ? renderMealForm() : state.tab === 'pick' ? renderPick() : state.tab === 'list' ? renderList() : renderRecords()
  document.querySelectorAll('#tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab))
}
function toggle(list, value) { const index = list.indexOf(value); if (index < 0) list.push(value); else list.splice(index, 1) }
function toast(message, tone = 'success') {
  const notice = document.getElementById('notice')
  if (!notice) return
  clearTimeout(noticeTimer)
  notice.textContent = message
  notice.className = tone === 'error' ? 'notice notice-error' : 'notice'
  notice.hidden = false
  noticeTimer = setTimeout(() => { notice.hidden = true }, tone === 'error' ? 3600 : 2400)
}
document.addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]')
  if (tab) { state.tab = tab.dataset.tab; state.page = ''; render(); window.scrollTo(0, 0); return }
  const button = event.target.closest('[data-action]')
  if (!button) return
  const { action, value, id: targetId } = button.dataset
  if (action === 'back' || action === 'cancel-form') {
    state.page = state.page === 'recordForm' ? 'result' : ''
    render(); window.scrollTo(0, 0); return
  }
  if (action === 'time') { state.mealTime = value === '全部' ? '' : value; resetResult() }
  if (action === 'filter-tag') { toggle(state.tags, value); resetResult() }
  if (action === 'clear-tags') { state.tags = []; resetResult() }
  if (action === 'restart-round') { resetResult(); state.tab = 'pick' }
  if (action === 'pick') {
    if (state.budgetText !== '' && (!/^\d+(\.\d{1,2})?$/.test(state.budgetText) || Number(state.budgetText) > 999.99)) { toast('预算填 0～999.99 元', 'error'); return }
    const pool = remaining()
    if (!pool.length && state.resultId) { toast('这轮都看过了，重新抽一轮吧', 'error'); return }
    if (!pool.length) return
    state.resultId = pickFrom(pool, state.resultId).id
    state.seenIds.push(state.resultId)
    state.page = 'result'; state.photo = ''; state.rating = ''; state.note = ''
  }
  if (action === 'skip-unavailable' && state.resultId) {
    state.unavailableIds.push(state.resultId)
    const pool = remaining()
    if (pool.length) {
      state.resultId = pickFrom(pool, state.resultId).id
      state.seenIds.push(state.resultId)
      state.page = 'result'
    } else {
      state.resultId = ''
      state.page = ''
    }
  }
  if (action === 'record-open') state.page = 'recordForm'
  if (action === 'rating') state.rating = state.rating === value ? '' : value
  if (action === 'remove-photo') state.photo = ''
  if (action === 'save-record') {
    const meal = db.meals.find(item => item.id === state.resultId)
    if (!meal) return
    const now = new Date()
    const next = { ...db, records: [{ id: id(), mealId: meal.id, mealName: meal.name, location: meal.location, price: meal.price, mealTime: state.mealTime, tags: meal.tags, rating: state.rating, note: state.note.trim(), photo: state.photo, source: `${state.mealTime || '全部'}随机`, dateText: now.toLocaleDateString('sv-SE'), timeText: now.toTimeString().slice(0, 5) }, ...db.records] }
    try { save(next); state.page = ''; state.tab = 'records'; state.photo = ''; toast('这一顿，记下来了') } catch (_) { toast('保存失败，可能是照片占用空间太多；请先移除照片重试', 'error'); return }
  }
  if (action === 'add' || action === 'edit') {
    const meal = db.meals.find(item => item.id === targetId)
    state.page = 'mealForm'; state.editingId = meal?.id || ''; state.formName = meal?.name || ''; state.formLocation = meal?.location || ''; state.formPrice = meal?.price == null ? '' : String(meal.price); state.formTimes = meal ? [...meal.mealTimes] : []; state.formTags = meal ? meal.tags.filter(tag => TAGS.includes(tag)) : []
  }
  if (action === 'form-time') toggle(state.formTimes, value)
  if (action === 'form-tag') toggle(state.formTags, value)
  if (action === 'save-meal') {
    const name = state.formName.trim()
    const location = state.formLocation.trim()
    if (!name) { toast('先写一个名称', 'error'); return }
    const rawPrice = state.formPrice.trim()
    const price = Number(rawPrice)
    if (rawPrice && (!Number.isFinite(price) || price < 0 || price > 999.99 || !/^\d+(\.\d{1,2})?$/.test(rawPrice))) { toast('价格填 0～999.99 元', 'error'); return }
    const meal = { id: state.editingId || id(), name, location, price: rawPrice ? price : null, mealTimes: state.formTimes.length ? [...state.formTimes] : [...TIMES], tags: [...state.formTags] }
    const meals = state.editingId ? db.meals.map(item => item.id === state.editingId ? meal : item) : [meal, ...db.meals]
    try { save({ ...db, meals }); state.page = ''; state.editingId = ''; resetResult() } catch (_) { toast('保存失败，请检查手机空间', 'error'); return }
  }
  if (action === 'delete-meal' && confirm('删除这份吃的？以前的记录会保留。')) { save({ ...db, meals: db.meals.filter(meal => meal.id !== targetId) }); resetResult() }
  if (action === 'delete-record' && confirm('删除这条记录和照片？')) save({ ...db, records: db.records.filter(record => record.id !== targetId) })
  if (action === 'clear-records' && confirm('确定清空全部吃饭记录吗？')) save({ ...db, records: [] })
  render()
  if (['pick', 'record-open', 'add', 'edit', 'save-meal', 'save-record'].includes(action)) window.scrollTo(0, 0)
})
document.addEventListener('change', event => {
  if (event.target.id !== 'photo-input' || !event.target.files?.[0]) return
  const file = event.target.files[0]
  if (!file.type.startsWith('image/')) { toast('请选择照片', 'error'); return }
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height))
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    state.photo = canvas.toDataURL('image/jpeg', .72)
    render()
    URL.revokeObjectURL(image.src)
  }
  image.onerror = () => toast('照片读取失败，请换一张试试', 'error')
  image.src = URL.createObjectURL(file)
})
document.addEventListener('input', event => {
  if (event.target.id === 'note') state.note = event.target.value
  if (event.target.id === 'meal-name') state.formName = event.target.value
  if (event.target.id === 'location') state.formLocation = event.target.value
  if (event.target.id === 'price') state.formPrice = event.target.value
  if (event.target.id === 'budget') {
    state.budgetText = event.target.value
    state.seenIds = []; state.unavailableIds = []; state.resultId = ''
    const count = document.getElementById('pool-count')
    if (count) count.textContent = `本轮可选 ${remaining().length} 样${state.budgetText !== '' ? ' · 未填价格的餐食不参与' : ''}`
    const pickButton = document.getElementById('draw-button')
    if (pickButton) pickButton.disabled = !remaining().length
    const restartButton = document.getElementById('restart-button')
    if (restartButton) restartButton.hidden = true
  }
})
window.androidBack = () => { if (state.page === 'recordForm') state.page = 'result'; else if (state.page) state.page = ''; else state.tab = 'pick'; render() }
try { db = load(); if (localStorage.getItem(storageKey) !== JSON.stringify(db)) save(db); render() } catch (error) { document.getElementById('screen').textContent = error.message }
