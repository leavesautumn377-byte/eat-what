const storage = require('../../utils/storage')
const { MEAL_TIMES, TAGS, optionItems } = require('../../utils/options')
const { showError } = require('../../utils/feedback')

Page({
  data: {
    meals: [], showForm: false, editingId: '', mealName: '', location: '',
    selectedMealTimes: [], selectedTags: [],
    timeOptions: optionItems(MEAL_TIMES, []),
    tagOptions: optionItems(TAGS, []),
    texts: {
      title: '餐食清单',
      add: '添加吃的', editTitle: '修改吃的', namePlaceholder: '吃什么，比如：番茄牛肉饭',
      locationPlaceholder: '店名 / 食堂名（选填）', timeTitle: '时段',
      timeHint: '可多选，不选则不限时段', tagTitle: '标签（可多选）',
      save: '保存', cancel: '取消', edit: '修改', remove: '删除',
      empty: '清单是空的，先添加几样你平常吃的吧。', count: '样吃的'
    }
  },

  onShow() {
    if (wx.hideTabBar) wx.hideTabBar({ animation: false })
    this.loadMeals()
  },

  switchMainTab(event) {
    wx.switchTab({ url: event.currentTarget.dataset.path })
  },

  loadMeals() {
    try { this.setData({ meals: storage.getMeals() }) }
    catch (error) { showError(error) }
  },

  refreshOptions() {
    this.setData({
      timeOptions: optionItems(MEAL_TIMES, this.data.selectedMealTimes),
      tagOptions: optionItems(TAGS, this.data.selectedTags)
    })
  },

  openAdd() {
    this.setData({
      showForm: true, editingId: '', mealName: '', location: '',
      selectedMealTimes: [], selectedTags: []
    })
    this.refreshOptions()
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  editMeal(e) {
    const meal = this.data.meals.find((item) => item.id === e.currentTarget.dataset.id)
    if (!meal) return
    this.setData({
      showForm: true, editingId: meal.id, mealName: meal.name, location: meal.location,
      selectedMealTimes: meal.mealTimes.slice(), selectedTags: meal.tags.filter((tag) => TAGS.includes(tag))
    })
    this.refreshOptions()
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  cancelEdit() {
    this.setData({ showForm: false, editingId: '' })
  },

  onMealNameInput(e) { this.setData({ mealName: e.detail.value }) },
  onLocationInput(e) { this.setData({ location: e.detail.value }) },
  toggleMealTime(e) { this.toggleValue('selectedMealTimes', e.currentTarget.dataset.value) },
  toggleTag(e) { this.toggleValue('selectedTags', e.currentTarget.dataset.value) },

  toggleValue(field, value) {
    const list = this.data[field].slice()
    const index = list.indexOf(value)
    if (index < 0) list.push(value)
    else list.splice(index, 1)
    this.setData({ [field]: list })
    this.refreshOptions()
  },

  saveMeal() {
    const name = this.data.mealName.trim()
    const location = this.data.location.trim()
    if (!name) {
      wx.showToast({ title: '先写一个名称', icon: 'none' })
      return
    }
    const payload = {
      name, location,
      mealTimes: this.data.selectedMealTimes.length ? this.data.selectedMealTimes : MEAL_TIMES,
      tags: this.data.selectedTags
    }
    try {
      const meals = this.data.editingId
        ? storage.updateMeal(this.data.editingId, payload)
        : storage.addMeal(payload)
      this.setData({ meals, showForm: false, editingId: '', mealName: '', location: '' })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) { showError(error) }
  },

  deleteMeal(e) {
    const id = e.currentTarget.dataset.id
    const meal = this.data.meals.find((item) => item.id === id)
    if (!meal) return
    wx.showModal({
      title: '删除这份吃的？',
      content: '将从清单移除“' + meal.name + '”，以前的吃饭记录会保留。',
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        try {
          const meals = storage.removeMeal(id)
          this.setData({ meals })
          if (this.data.editingId === id) this.cancelEdit()
          wx.showToast({ title: '已删除', icon: 'none' })
        } catch (error) { showError(error) }
      }
    })
  }
})
