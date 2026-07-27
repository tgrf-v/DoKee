importScripts('lib/firebase-listener.js');

const firebaseService = new ExtensionFirebaseService();

let currentState = {
  uid: null,
  blockedUrls: ['youtube.com', 'westmanga.co'],
  toleranceMinutes: 30,
  remainingSeconds: 30 * 60,
  isSurrendered: false,
  hasPendingTasks: false,
  tasks: []
};

let activeBlockedTabSession = null; // { tabId, url, entryTime }
let syncAlarmInterval = null;

// Initialize Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('DoKee Extension Installed.');
  initServiceWorker();
});

chrome.runtime.onStartup.addListener(() => {
  initServiceWorker();
});

async function initServiceWorker() {
  await firebaseService.initAuth();
  const data = await chrome.storage.local.get(['dokee_uid', 'dokee_token', 'dokee_state']);
  
  if (data.dokee_uid) {
    currentState.uid = data.dokee_uid;
  }
  if (data.dokee_state) {
    currentState = { ...currentState, ...data.dokee_state };
  }

  // Periodic Firestore Sync (Poll every 10 seconds for real-time responsiveness)
  chrome.alarms.create('dokee_realtime_sync', { periodInMinutes: 0.25 });
  refreshFirestoreState();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dokee_realtime_sync') {
    refreshFirestoreState();
  }
});

// Refresh state from Firestore
async function refreshFirestoreState() {
  if (!currentState.uid) {
    const authSuccess = await firebaseService.initAuth();
    if (!authSuccess) return;
    currentState.uid = firebaseService.uid;
  }

  const todayStr = firebaseService.getTodayString();

  // 1. Fetch settings
  const settings = await firebaseService.getSettings(currentState.uid);
  if (settings) {
    currentState.blockedUrls = settings.blocked_urls || [];
    currentState.toleranceMinutes = settings.tolerance_minutes || 30;
  }

  // 2. Fetch daily log
  const log = await firebaseService.getDailyLog(currentState.uid, todayStr);
  if (log) {
    currentState.remainingSeconds = log.remaining_seconds;
    currentState.isSurrendered = log.is_surrendered;
  }

  // 3. Fetch daily tasks & evaluate hasPendingTasks
  const tasks = await firebaseService.getDailyTasks(currentState.uid, todayStr);
  currentState.tasks = tasks;

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const previousPending = currentState.hasPendingTasks;
  currentState.hasPendingTasks = tasks.some(t => !t.is_completed && t.start_time <= currentHHMM);

  // Save to storage
  await chrome.storage.local.set({ dokee_state: currentState });

  // Real-time Instant Unblock trigger if tasks were completed
  if (previousPending && !currentState.hasPendingTasks) {
    notifyAllTabsUnblock();
  }

  // Update badge text
  updateBadge();
  // Check active tab
  checkCurrentActiveTab();
}

function updateBadge() {
  if (!currentState.uid) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
    return;
  }

  if (currentState.isSurrendered) {
    chrome.action.setBadgeText({ text: 'FREE' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    return;
  }

  if (currentState.hasPendingTasks) {
    const mins = Math.ceil(currentState.remainingSeconds / 60);
    chrome.action.setBadgeText({ text: `${mins}m` });
    chrome.action.setBadgeBackgroundColor({ color: currentState.remainingSeconds <= 0 ? '#EF4444' : '#F59E0B' });
  } else {
    chrome.action.setBadgeText({ text: 'OK' });
    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  }
}

// URL Matcher against blocked_urls
function isBlockedUrl(url) {
  if (!url || !currentState.blockedUrls || currentState.blockedUrls.length === 0) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return currentState.blockedUrls.some(blocked => {
      const clean = blocked.toLowerCase().trim();
      return hostname === clean || hostname.endsWith('.' + clean);
    });
  } catch (e) {
    return false;
  }
}

// Tab updates & Activation handlers
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleTabChange(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      handleTabChange(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // Tab closed or unaccessible
  }
});

function handleTabChange(tabId, url) {
  const nowSecs = Math.floor(Date.now() / 1000);

  // If leaving a previously active blocked session
  if (activeBlockedTabSession && activeBlockedTabSession.tabId !== tabId) {
    finalizeBlockedSession(nowSecs);
  }

  const matches = isBlockedUrl(url);

  if (matches) {
    activeBlockedTabSession = {
      tabId,
      url,
      entryTime: nowSecs
    };

    // Send state to content script
    chrome.tabs.sendMessage(tabId, {
      action: 'UPDATE_BLOCKER_STATE',
      state: {
        remaining_seconds: currentState.remainingSeconds,
        hasPendingTasks: currentState.hasPendingTasks,
        is_surrendered: currentState.isSurrendered,
        blocked_urls: currentState.blockedUrls
      }
    }).catch(() => {
      // Content script may not be loaded yet
    });
  } else {
    activeBlockedTabSession = null;
  }
}

async function finalizeBlockedSession(currentSecs = Math.floor(Date.now() / 1000)) {
  if (!activeBlockedTabSession) return;

  const durationSpent = currentSecs - activeBlockedTabSession.entryTime;
  activeBlockedTabSession = null;

  if (durationSpent > 0 && currentState.hasPendingTasks && !currentState.isSurrendered) {
    currentState.remainingSeconds = Math.max(0, currentState.remainingSeconds - durationSpent);
    await chrome.storage.local.set({ dokee_state: currentState });
    
    // Sync to Firestore
    if (currentState.uid) {
      await firebaseService.updateRemainingSeconds(currentState.remainingSeconds, currentState.uid);
    }

    updateBadge();
  }
}

async function checkCurrentActiveTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      handleTabChange(activeTab.id, activeTab.url);
    }
  } catch (e) {}
}

function notifyAllTabsUnblock() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'UNBLOCK' }).catch(() => {});
      }
    }
  });
}

// Message Listener for Auth Sync & Content Script queries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOKEE_AUTH_SYNC') {
    firebaseService.setAuth(message.uid, message.token);
    currentState.uid = message.uid;
    refreshFirestoreState();
    sendResponse({ status: 'OK' });
    return true;
  }

  if (message.type === 'DOKEE_AUTH_LOGOUT') {
    firebaseService.clearAuth();
    currentState.uid = null;
    updateBadge();
    sendResponse({ status: 'OK' });
    return true;
  }

  if (message.action === 'GET_STATE') {
    sendResponse({ state: currentState });
    return true;
  }

  if (message.action === 'TIME_TICK') {
    // Content script ticking active seconds
    if (currentState.hasPendingTasks && !currentState.isSurrendered && currentState.remainingSeconds > 0) {
      currentState.remainingSeconds = Math.max(0, currentState.remainingSeconds - 1);
      if (currentState.remainingSeconds === 0 && currentState.uid) {
        firebaseService.updateRemainingSeconds(0, currentState.uid);
      }
      updateBadge();
    }
    sendResponse({ remaining_seconds: currentState.remainingSeconds });
    return true;
  }
});
