const storage = require('../../utils/storage')
const photos = require('../../utils/photos')
const { showError } = require('../../utils/feedback')

Page({
  data: {
    records: [],
    summary: {
      count: 0,
      favoriteMealDisplay: '--',
      favoriteMetaDisplay: ''
    },
    texts: {
      title: '用餐记录',
      subtitle: '吃过的，都记在这里。',
      summaryCount: '\u5df2\u8bb0\u5f55',
      summarySuffix: '\u987f',
      favoriteLabel: '\u6700\u5e38\u9009\u7684',
      clearButton: '\u6e05\u7a7a\u8bb0\u5f55',
      deleteButton: '删除这条',
      localHint: '记录和照片保存在当前设备，不会同步给其他人。',
      listEmpty: '还没有记录，先去选一顿吧。',
      noteLabel: '\u8fd9\u987f\u60f3\u6cd5'
    }
  },

  onShow() {
    if (wx.hideTabBar) wx.hideTabBar({ animation: false })
    this.loadRecords()
  },

  switchMainTab(event) {
    wx.switchTab({ url: event.currentTarget.dataset.path })
  },

  loadRecords() {
    try {
      const records = storage.getRecords().map((item) => ({
        ...item,
        displayMeta: `${item.location || item.source} / ${item.dateText} ${item.timeText}`
      }))
      const countMap = Object.create(null)

      records.forEach((item) => {
        countMap[item.mealName] = (countMap[item.mealName] || 0) + 1
      })
      const favoriteEntry = Object.keys(countMap)
        .map((name) => ({ name, count: countMap[name] }))
        .sort((a, b) => b.count - a.count)[0]

      this.setData({
        records,
        summary: {
          count: records.length,
          favoriteMealDisplay: favoriteEntry ? favoriteEntry.name : '--',
          favoriteMetaDisplay: favoriteEntry ? `/ ${favoriteEntry.count} \u6b21` : ''
        }
      })
    } catch (error) {
      showError(error)
    }
  },

  previewPhoto(e) {
    const { path } = e.currentTarget.dataset
    if (!path) {
      return
    }

    wx.previewImage({
      current: path,
      urls: [path]
    })
  },

  clearRecords() {
    if (!this.data.records.length) {
      return
    }

    wx.showModal({
      title: '\u786e\u8ba4\u6e05\u7a7a',
      content: '\u6e05\u7a7a\u540e\u5c31\u6ca1\u6709\u5386\u53f2\u8bb0\u5f55\u4e86\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        try {
          const records = storage.getRecords()
          storage.saveRecords([])
          photos.removePhotos(records)
          this.loadRecords()
          wx.showToast({ title: '已清空', icon: 'none' })
        } catch (error) { showError(error) }
      }
    })
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条记录？',
      content: '这条记录和它的照片会从当前设备移除。',
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        try {
          const records = storage.getRecords()
          const remaining = storage.removeRecord(id)
          photos.removePhotos(records.filter((record) => record.id === id), remaining)
          this.loadRecords()
          wx.showToast({ title: '已删除', icon: 'none' })
        } catch (error) { showError(error) }
      }
    })
  }
})
