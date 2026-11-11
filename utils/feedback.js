function showError(error) {
  wx.showModal({
    title: '操作没有完成',
    content: error && error.message ? error.message : '保存失败，请检查手机存储空间后重试。',
    showCancel: false
  })
}

module.exports = { showError }
