document.addEventListener('DOMContentLoaded', () => {
  const syncStatus = document.getElementById('sync-status');
  const authVal = document.getElementById('auth-val');
  const timerVal = document.getElementById('timer-val');
  const pendingVal = document.getElementById('pending-val');
  const surrenderVal = document.getElementById('surrender-val');
  const urlCount = document.getElementById('url-count');
  const urlList = document.getElementById('url-list');
  const syncBtn = document.getElementById('sync-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');

  function updatePopupUI() {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
      if (!response || !response.state) return;
      const state = response.state;

      if (state.uid) {
        syncStatus.textContent = 'CONNECTED';
        syncStatus.style.borderColor = 'rgba(52, 211, 153, 0.4)';
        syncStatus.style.color = '#34d399';
        syncStatus.style.backgroundColor = 'rgba(52, 211, 153, 0.15)';
        authVal.textContent = state.uid.substring(0, 10) + '...';
        authVal.className = 'val val-green';
      } else {
        syncStatus.textContent = 'DISCONNECTED';
        syncStatus.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        syncStatus.style.color = '#f87171';
        syncStatus.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
        authVal.textContent = 'Not Synced';
        authVal.className = 'val val-red';
      }

      // Format remaining time MM:SS
      const secs = state.remainingSeconds || 0;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      timerVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      timerVal.className = secs <= 300 ? 'val val-red' : 'val val-cyan';

      pendingVal.textContent = state.hasPendingTasks ? 'YES (Active)' : 'NO';
      pendingVal.className = state.hasPendingTasks ? 'val val-red' : 'val val-green';

      surrenderVal.textContent = state.isSurrendered ? 'YES' : 'NO';
      surrenderVal.className = state.isSurrendered ? 'val val-amber' : 'val';

      // Blocked URLs
      const urls = state.blockedUrls || [];
      urlCount.textContent = urls.length;
      urlList.innerHTML = '';
      if (urls.length === 0) {
        urlList.innerHTML = '<li>No URLs blocked</li>';
      } else {
        urls.forEach(u => {
          const li = document.createElement('li');
          li.textContent = u;
          urlList.appendChild(li);
        });
      }
    });
  }

  updatePopupUI();
  setInterval(updatePopupUI, 1000);

  // Sync Auth from active Web App tab
  syncBtn.addEventListener('click', async () => {
    syncBtn.textContent = 'Scanning active tabs...';
    try {
      const tabs = await chrome.tabs.query({});
      let foundTab = false;

      for (const tab of tabs) {
        if (tab.url && (tab.url.includes('localhost') || tab.url.includes('dokee'))) {
          foundTab = true;
          // Inject script to extract dokee credentials from localStorage
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                uid: localStorage.getItem('dokee_uid'),
                token: localStorage.getItem('dokee_token')
              };
            }
          });

          if (results && results[0] && results[0].result && results[0].result.uid) {
            const { uid, token } = results[0].result;
            chrome.runtime.sendMessage({ type: 'DOKEE_AUTH_SYNC', uid, token });
            syncBtn.textContent = 'Auth Synced Successfully!';
            setTimeout(() => { syncBtn.textContent = 'Sync Auth from Web App'; }, 2000);
            updatePopupUI();
            return;
          }
        }
      }

      if (!foundTab) {
        syncBtn.textContent = 'Open DoKee Web App first!';
        setTimeout(() => { syncBtn.textContent = 'Sync Auth from Web App'; }, 2500);
      }
    } catch (e) {
      console.error(e);
      syncBtn.textContent = 'Sync Failed. Log in on Web App.';
      setTimeout(() => { syncBtn.textContent = 'Sync Auth from Web App'; }, 2500);
    }
  });

  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });
});
