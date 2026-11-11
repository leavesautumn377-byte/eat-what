function choosePhoto() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => resolve(res.tempFiles[0].tempFilePath),
      fail: (error) => {
        if ((error.errMsg || '').includes('cancel')) resolve('')
        else reject(new Error('暂时打不开相机或相册，请检查微信权限后重试'))
      }
    })
  })
}

function savePhoto(tempFilePath) {
  if (!tempFilePath) return Promise.resolve('')
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath,
      success: (res) => resolve(res.savedFilePath),
      fail: () => reject(new Error('照片没有保存成功，请腾出空间重试，或先移除照片再保存记录'))
    })
  })
}

function removePhotos(records, remaining = []) {
  const keep = new Set(remaining.map((record) => record.photoPath))
  const paths = new Set(records.map((record) => record.photoPath).filter((path) => path && !keep.has(path)))
  return Promise.all(Array.from(paths).map((filePath) => new Promise((resolve) => {
    if (typeof wx.removeSavedFile !== 'function') {
      resolve()
      return
    }
    try {
      wx.removeSavedFile({ filePath, complete: resolve })
    } catch (_) {
      resolve()
    }
  })))
}

module.exports = { choosePhoto, savePhoto, removePhotos }
