const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('matrixNeon', {
  isElectron: true,
  platform: process.platform,
})
