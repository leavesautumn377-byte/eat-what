const storage = require('../../utils/storage')
const options = require('../../utils/options')
const photos = require('../../utils/photos')
const { showError } = require('../../utils/feedback')

Page({
  data: {
    screen: 'pick',
    meals: [],
    filteredMeals: [],
    seenMealIds: [],
    unavailableMealIds: [],
    remainingCount: 0,
    recentRecords: [],
    selectedMealTime: '',
    selectedTags: [],
    budgetText: '',
    resultMeal: null,
    resultMotion: '',
    resultAnimating: false,
    lastResultId: '',
    showRecordPanel: false,
    isSaving: false,
    isChoosingPhoto: false,
    resultRecorded: false,
    tagOptions: options.optionItems(options.TAGS, []),
    recordForm: {
      rating: '',
      note: '',
      photoPath: ''
    },
    mealTimes: options.MEAL_TIMES,
    ratings: options.RATINGS,
    texts: {
      title: '\u4eca\u5929\u5403\u4ec0\u4e48',
      subtitle: '不要纠结，把平常吃的都记录下来，让小程序帮你做决定。',
      mealTimeTitle: '时段',
      allMealTimes: '\u5168\u90e8',
      tagTitle: '口味',
      clearTags: '清除',
      candidateText: '可选',
      candidateSuffix: '样',
      chooseButton: '抽一顿',
      rerollButton: '\u6362\u4e00\u4e2a',
      unavailableButton: '现在不方便',
      restartButton: '重新抽一轮',
      resultTitle: '抽到了',
      recordButton: '\u8bb0\u8fd9\u4e00\u987f',
      recordTitle: '记录这一顿',
      recordHint: '照片、评价、想法都可以跳过。',
      recordedButton: '这顿已记录',
      noMatches: '还没有符合这些感觉的吃的，少选一个吧。',
      emptyMeals: '清单是空的，先添加几样平常吃的吧。',
      goList: '去添加',
      localHint: '记录和照片只保存在当前设备，暂不支持换机同步。',
      ratingTitle: '评价',
      photoTitle: '照片',
      noteTitle: '\u60f3\u6cd5',
      addPhoto: '拍照或选照片',
      changePhoto: '\u6362\u4e00\u5f20',
      removePhoto: '\u4e0d\u8981\u8fd9\u5f20',
      notePlaceholder: '这顿怎么样？',
      saveRecord: '保存记录',
      latestTitle: '最近记录',
      latestEmpty: '还没有记录'
    }
  },

  onShow() {
    if (wx.hideTabBar) wx.hideTabBar({ animation: false })
    this.cancelResultAnimation()
    this.loadData()
  },

  switchMainTab(event) {
    wx.switchTab({ url: event.currentTarget.dataset.path })
  },

  onHide() {
    this.cancelResultAnimation()
    if (!this.data.isSaving && !this.data.isChoosingPhoto) this.setData({ screen: 'pick' })
  },

  onUnload() {
    this.cancelResultAnimation()
    this.releaseDraftPhoto()
  },

  cancelResultAnimation() {
    if (this.resultTimer) {
      clearTimeout(this.resultTimer)
      this.resultTimer = null
    }
    if (this.data.resultAnimating) {
      this.setData({ resultAnimating: false, resultMotion: '' })
    }
  },

  releaseDraftPhoto() {
    if (this.savedDraftPhoto) {
      photos.removePhotos([{ photoPath: this.savedDraftPhoto }])
      this.savedDraftPhoto = ''
    }
  },

  loadData() {
    try {
      const meals = storage.getMeals()
      const records = storage.getRecords().slice(0, 3).map((item) => ({
        ...item,
        displayMeta: `${item.location || item.source} / ${item.dateText} ${item.timeText}`
      }))
      const filteredMeals = options.filterMeals(meals, this.data.selectedMealTime, this.data.selectedTags, this.getBudget())
      const resultMeal = this.data.resultMeal
        ? filteredMeals.find((meal) => meal.id === this.data.resultMeal.id) || null
        : null

      if (!resultMeal) this.releaseDraftPhoto()
      this.setData({
        meals,
        recentRecords: records,
        filteredMeals,
        resultMeal,
        resultRecorded: resultMeal ? this.data.resultRecorded : false,
        showRecordPanel: resultMeal ? this.data.showRecordPanel : false,
        recordForm: resultMeal ? this.data.recordForm : { rating: '', note: '', photoPath: '' },
        screen: resultMeal ? this.data.screen : 'pick'
      })
      this.applyFilters()
    } catch (error) {
      this.setData({ meals: [], filteredMeals: [], resultMeal: null, showRecordPanel: false, screen: 'pick' })
      showError(error)
    }
  },

  selectMealTime(e) {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.cancelResultAnimation()
    this.releaseDraftPhoto()
    const value = e.currentTarget.dataset.value
    this.setData({
      selectedMealTime: value,
      seenMealIds: [],
      unavailableMealIds: [],
      screen: 'pick',
      resultMeal: null,
      lastResultId: '',
      showRecordPanel: false
    })
    this.applyFilters()
  },

  toggleTag(e) {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.cancelResultAnimation()
    this.releaseDraftPhoto()
    const value = e.currentTarget.dataset.value
    const tags = this.data.selectedTags.slice()
    const index = tags.indexOf(value)

    if (index >= 0) {
      tags.splice(index, 1)
    } else {
      tags.push(value)
    }

    this.setData({
      selectedTags: tags,
      seenMealIds: [],
      unavailableMealIds: [],
      screen: 'pick',
      resultMeal: null,
      lastResultId: '',
      showRecordPanel: false
    })
    this.applyFilters()
  },

  clearTags() {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.cancelResultAnimation()
    this.releaseDraftPhoto()
    this.setData({
      selectedTags: [],
      seenMealIds: [],
      unavailableMealIds: [],
      screen: 'pick',
      resultMeal: null,
      lastResultId: '',
      showRecordPanel: false
    })
    this.applyFilters()
  },

  getBudget() {
    const value = this.data.budgetText.trim()
    const budget = Number(value)
    return value && Number.isFinite(budget) && budget >= 0 ? budget : null
  },

  onBudgetInput(e) {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    const value = e.detail.value
    if (value && (!/^\d{0,3}(\.\d{0,2})?$/.test(value) || Number(value) > 999.99)) return this.data.budgetText
    this.cancelResultAnimation()
    this.releaseDraftPhoto()
    this.setData({ budgetText: value, seenMealIds: [], unavailableMealIds: [], screen: 'pick', resultMeal: null, lastResultId: '', showRecordPanel: false })
    this.applyFilters()
  },

  applyFilters() {
    const filteredMeals = options.filterMeals(this.data.meals, this.data.selectedMealTime, this.data.selectedTags, this.getBudget())

    this.setData({
      filteredMeals,
      remainingCount: filteredMeals.filter((meal) => !this.data.seenMealIds.includes(meal.id) && !this.data.unavailableMealIds.includes(meal.id)).length,
      tagOptions: options.optionItems(options.TAGS, this.data.selectedTags)
    })
  },

  chooseMeal() {
    this.pickMeal(false)
  },

  rerollMeal() {
    this.pickMeal(true)
  },

  skipUnavailable() {
    if (!this.data.resultMeal || this.data.isSaving || this.data.isChoosingPhoto || this.data.resultAnimating) return
    const id = this.data.resultMeal.id
    this.setData({ unavailableMealIds: [...new Set([...this.data.unavailableMealIds, id])] })
    this.applyFilters()
    if (this.data.remainingCount) {
      this.pickMeal(true)
    } else {
      this.releaseDraftPhoto()
      this.setData({ screen: 'pick', resultMeal: null, showRecordPanel: false })
      wx.pageScrollTo({ scrollTop: 0, duration: 220 })
    }
  },

  restartRound() {
    if (this.data.isSaving || this.data.isChoosingPhoto || this.data.resultAnimating) return
    this.releaseDraftPhoto()
    this.setData({ seenMealIds: [], unavailableMealIds: [], resultMeal: null, lastResultId: '', screen: 'pick', showRecordPanel: false })
    this.applyFilters()
  },

  pickMeal(excludeCurrent) {
    if (this.data.isSaving || this.data.isChoosingPhoto || this.data.resultAnimating) return
    const candidates = this.data.filteredMeals.filter((meal) => !this.data.seenMealIds.includes(meal.id) && !this.data.unavailableMealIds.includes(meal.id))

    if (!candidates.length) {
      wx.showToast({
        title: this.data.filteredMeals.length ? '这轮都看过了，重新抽一轮吧' : '\u8fd9\u4e2a\u7b5b\u9009\u6761\u4ef6\u4e0b\u8fd8\u6ca1\u6709\u53ef\u9009\u5185\u5bb9',
        icon: 'none'
      })
      return
    }

    const chosenMeal = options.pickMeal(candidates, this.data.resultMeal ? this.data.lastResultId : '', storage.getRecords())
    if (this.data.resultMeal) {
      this.setData({ resultAnimating: true, resultMotion: 'result-leave' })
      this.resultTimer = setTimeout(() => {
        this.resultTimer = null
        this.showChosenMeal(chosenMeal)
      }, 180)
      return
    }

    this.showChosenMeal(chosenMeal)
  },

  showChosenMeal(chosenMeal) {
    this.releaseDraftPhoto()
    this.setData({
      resultMeal: chosenMeal,
      seenMealIds: [...this.data.seenMealIds, chosenMeal.id],
      remainingCount: this.data.remainingCount - 1,
      screen: 'result',
      resultMotion: 'result-enter',
      resultAnimating: false,
      lastResultId: chosenMeal.id,
      showRecordPanel: false,
      resultRecorded: false,
      recordForm: {
        rating: '',
        note: '',
        photoPath: ''
      }
    }, () => {
      wx.pageScrollTo({ scrollTop: 0, duration: 320 })
    })
  },

  backToPick() {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.cancelResultAnimation()
    this.setData({ screen: 'pick', showRecordPanel: false })
    wx.pageScrollTo({ scrollTop: 0, duration: 220 })
  },

  backToResult() {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.setData({ screen: 'result', showRecordPanel: false })
    wx.pageScrollTo({ scrollTop: 0, duration: 220 })
  },

  openRecordPanel() {
    if (!this.data.resultMeal || this.data.resultRecorded || this.data.isSaving || this.data.resultAnimating) {
      return
    }

    this.setData({ showRecordPanel: true, screen: 'record' }, () => {
      wx.pageScrollTo({ scrollTop: 0, duration: 250 })
    })
  },

  selectRating(e) {
    if (this.data.isSaving) return
    const value = e.currentTarget.dataset.value
    this.setData({
      'recordForm.rating': this.data.recordForm.rating === value ? '' : value
    })
  },

  onNoteInput(e) {
    this.setData({
      'recordForm.note': e.detail.value
    })
  },

  async choosePhoto() {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.setData({ isChoosingPhoto: true })
    try {
      const path = await photos.choosePhoto()
      if (path) {
        this.releaseDraftPhoto()
        this.setData({ 'recordForm.photoPath': path })
      }
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ isChoosingPhoto: false })
    }
  },

  removePhoto() {
    if (this.data.isSaving || this.data.isChoosingPhoto) return
    this.releaseDraftPhoto()
    this.setData({
      'recordForm.photoPath': ''
    })
  },

  async saveRecord() {
    if (!this.data.resultMeal || this.data.isSaving || this.data.isChoosingPhoto || this.data.resultRecorded) {
      return
    }

    this.setData({ isSaving: true })
    try {
      const meal = this.data.resultMeal
      const sourcePrefix = this.data.selectedMealTime || '\u5168\u90e8'
      let photoPath = this.data.recordForm.photoPath
      if (photoPath && photoPath !== this.savedDraftPhoto) {
        photoPath = await photos.savePhoto(photoPath)
        this.savedDraftPhoto = photoPath
        this.setData({ 'recordForm.photoPath': photoPath })
      }

      storage.addRecord({
        mealId: meal.id,
        mealName: meal.name,
        location: meal.location,
        price: meal.price,
        mealTime: this.data.selectedMealTime,
        tags: meal.tags,
        rating: this.data.recordForm.rating,
        note: this.data.recordForm.note.trim(),
        photoPath,
        source: `${sourcePrefix}\u968f\u673a`
      })

      this.savedDraftPhoto = ''
      this.setData({
        showRecordPanel: false,
        screen: 'result',
        resultRecorded: true,
        recordForm: {
          rating: '',
          note: '',
          photoPath: ''
        }
      })
      this.loadData()
      wx.showToast({
        title: '\u5df2\u7ecf\u8bb0\u4e0b\u6765\u4e86',
        icon: 'success'
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ isSaving: false })
    }
  },

  goList() {
    wx.switchTab({ url: '/pages/wheel/wheel' })
  }
})
