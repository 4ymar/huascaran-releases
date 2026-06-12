const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openPDF:      (base64Data) => ipcRenderer.invoke('open-pdf', base64Data),
    openExternal: (url)        => ipcRenderer.invoke('open-external', url),
    saveCSV: (data) => ipcRenderer.invoke('save-csv', data),
    saveExcel: (data) => ipcRenderer.invoke('save-excel', data),
    savePDFDialog:(data) => ipcRenderer.invoke('save-pdf-dialog', data),
    selectImage:  ()     => ipcRenderer.invoke('select-image'),
    saveSupportZip: (data) => ipcRenderer.invoke('save-support-zip', data),
    isElectron:   true,
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        checkForced:  () => ipcRenderer.invoke('updater:check-forced'),
        download: () => ipcRenderer.invoke('updater:download'),
        install: () => ipcRenderer.invoke('updater:install'),
        onStatus: (callback) => {
            const subscription = (event, status) => callback(status);
            ipcRenderer.on('updater:status', subscription);
            return () => ipcRenderer.removeListener('updater:status', subscription);
        }
    }
}); 
