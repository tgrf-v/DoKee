/**
 * DoKee Chrome Extension - Content Script
 * Visual Blocker, Reflection Warning Banner & Black Screen of Death (BSOD)
 */

(function () {
  let currentState = null;
  let isAwareDismissed = false;
  let tickInterval = null;

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'UPDATE_BLOCKER_STATE') {
      currentState = message.state;
      renderUI();
      startLocalTicker();
    } else if (message.action === 'UNBLOCK') {
      unblockPage();
    }
  });

  // Query state on initial script execution
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
    if (response && response.state) {
      currentState = response.state;
      renderUI();
      startLocalTicker();
    }
  });

  function startLocalTicker() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      if (currentState && currentState.hasPendingTasks && !currentState.isSurrendered) {
        chrome.runtime.sendMessage({ action: 'TIME_TICK' }, (res) => {
          if (res && res.remaining_seconds !== undefined) {
            currentState.remaining_seconds = res.remaining_seconds;
            renderUI();
          }
        });
      }
    }, 1000);
  }

  function renderUI() {
    if (!currentState) return;

    const { remaining_seconds, hasPendingTasks, is_surrendered } = currentState;

    // Condition 1: Freedom or Tasks Completed -> Remove all blockers
    if (!hasPendingTasks || is_surrendered) {
      unblockPage();
      return;
    }

    // Condition 2: Remaining Time Depleted (remaining_seconds <= 0) AND Has Pending Tasks -> Black Screen of Death
    if (remaining_seconds <= 0) {
      removeWarningBanner();
      renderBlackScreenOfDeath();
      return;
    }

    // Condition 3: Active Tolerance Time Remaining -> Show Reflection Warning Banner (unless user clicked "Ya, saya sadar")
    removeBlackScreenOfDeath();
    if (!isAwareDismissed) {
      renderReflectionWarningBanner(remaining_seconds);
    }
  }

  function renderBlackScreenOfDeath() {
    let bsod = document.getElementById('dokee-blocker-bsod-overlay');
    if (!bsod) {
      bsod = document.createElement('div');
      bsod.id = 'dokee-blocker-bsod-overlay';
      bsod.innerHTML = `
        <div class="dokee-badge">DoKee Anti-Distraction Enforcement</div>
        <h1>AKSES DIBLOKIR.</h1>
        <p>SELESAIKAN TUGASMU DI DOKEE UNTUK MEMBUKA AKSES WEB INI.</p>
        <div style="font-family: monospace; color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">
          [Snapshot Sync Active • Complete tasks in Web App to unlock in real-time]
        </div>
      `;
      document.documentElement.appendChild(bsod);
    }

    document.body?.classList.add('dokee-bsod-hidden');
  }

  function removeBlackScreenOfDeath() {
    const bsod = document.getElementById('dokee-blocker-bsod-overlay');
    if (bsod) {
      bsod.remove();
    }
    document.body?.classList.remove('dokee-bsod-hidden');
  }

  function renderReflectionWarningBanner(secondsLeft) {
    const minutes = Math.ceil(secondsLeft / 60);
    let banner = document.getElementById('dokee-warning-banner');

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dokee-warning-banner';
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <h3>
        <span>⚠️</span> Jeda Refleksi DoKee
      </h3>
      <p>Waktu toleransimu sisa <strong>${minutes} menit</strong> (${secondsLeft}s). Fokus pada tugasmu!</p>
      <button id="dokee-warning-btn">Ya, saya sadar</button>
    `;

    const btn = document.getElementById('dokee-warning-btn');
    if (btn) {
      btn.onclick = () => {
        isAwareDismissed = true;
        removeWarningBanner();
      };
    }
  }

  function removeWarningBanner() {
    const banner = document.getElementById('dokee-warning-banner');
    if (banner) {
      banner.remove();
    }
  }

  function unblockPage() {
    if (tickInterval) clearInterval(tickInterval);
    removeBlackScreenOfDeath();
    removeWarningBanner();
    isAwareDismissed = false;
  }
})();
