const { contextBridge, ipcRenderer } = require('electron');

// Log immediately when preload script starts
console.log('[Preload] ========== Preload script STARTING ==========');
console.log('[Preload] Script file: preload.js');
console.log('[Preload] contextBridge available:', typeof contextBridge !== 'undefined');
console.log('[Preload] ipcRenderer available:', typeof ipcRenderer !== 'undefined');

// Verify we're in the right context
if (typeof process !== 'undefined') {
  console.log('[Preload] Process type:', process.type);
  console.log('[Preload] Process versions:', process.versions);
}

// Safe IPC wrapper to prevent async response errors
const safeSend = (channel, ...args) => {
  try {
    console.log(`[Preload] Sending IPC message to ${channel}`);
    ipcRenderer.send(channel, ...args);
  } catch (error) {
    console.error(`[Preload] Error sending IPC message to ${channel}:`, error);
  }
};

const safeOn = (channel, callback) => {
  try {
    const handler = (event, ...args) => {
      try {
        console.log(`[Preload] Received IPC message from ${channel}`);
        callback(...args);
      } catch (error) {
        console.error(`[Preload] Error in IPC callback for ${channel}:`, error);
      }
    };
    ipcRenderer.on(channel, handler);
    // Return cleanup function
    return () => {
      try {
        ipcRenderer.removeListener(channel, handler);
      } catch (error) {
        console.error(`[Preload] Error removing listener for ${channel}:`, error);
      }
    };
  } catch (error) {
    console.error(`[Preload] Error setting up IPC listener for ${channel}:`, error);
    return () => {}; // Return no-op cleanup
  }
};

try {
  const electronAPI = {
    createPrompterWindow: () => safeSend('create-prompter-window'),
    createElfWindow: () => safeSend('create-elf-window'),
    closePrompterWindow: () => safeSend('close-prompter-window'),
    closeElfWindow: () => safeSend('close-elf-window'),
    updatePrompter: (data) => safeSend('update-prompter', data),
    updateElf: (data) => safeSend('update-elf', data),
    onPrompterUpdate: (callback) => safeOn('prompter-update', callback),
    onElfUpdate: (callback) => safeOn('elf-update', callback),
    isElectron: true
  };
  
  console.log('[Preload] Attempting to expose electronAPI...');
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('[Preload] ✅ electronAPI exposed to window successfully');
  console.log('[Preload] electronAPI methods:', Object.keys(electronAPI));
} catch (error) {
  console.error('[Preload] ❌ Error exposing electronAPI:', error);
  console.error('[Preload] Error stack:', error.stack);
  
  // Note: Cannot set window directly in preload script due to context isolation
  // The error above means contextBridge failed, which is a critical issue
}

console.log('[Preload] ========== Preload script COMPLETE ==========');

