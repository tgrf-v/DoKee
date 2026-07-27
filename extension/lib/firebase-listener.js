/**
 * DoKee Chrome Extension - Firebase Client & Listener Helper
 * Real-time synchronization for Manifest V3 Service Worker
 */

const FIREBASE_API_KEY = "AIzaSyDemoKeyDoKeeFirebase2026";
const FIREBASE_PROJECT_ID = "dokee-d7356";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

class ExtensionFirebaseService {
  constructor() {
    this.uid = null;
    this.token = null;
    this.listeners = new Map();
  }

  async initAuth() {
    const data = await chrome.storage.local.get(['dokee_uid', 'dokee_token']);
    if (data.dokee_uid) {
      this.uid = data.dokee_uid;
      this.token = data.dokee_token;
      return true;
    }
    return false;
  }

  setAuth(uid, token) {
    this.uid = uid;
    this.token = token;
    chrome.storage.local.set({ dokee_uid: uid, dokee_token: token });
  }

  clearAuth() {
    this.uid = null;
    this.token = null;
    chrome.storage.local.remove(['dokee_uid', 'dokee_token']);
  }

  // Get Today's Date String YYYY-MM-DD
  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fetch Settings Document
  async getSettings(uid = this.uid) {
    if (!uid) return null;
    try {
      const res = await fetch(`${FIRESTORE_BASE_URL}/settings/${uid}`);
      if (!res.ok) return null;
      const data = await res.json();
      const fields = data.fields || {};
      const blocked_urls = fields.blocked_urls?.arrayValue?.values?.map(v => v.stringValue) || [];
      const tolerance_minutes = fields.tolerance_minutes?.integerValue || fields.tolerance_minutes?.doubleValue || 30;
      return { blocked_urls, tolerance_minutes: Number(tolerance_minutes) };
    } catch (e) {
      console.error('Error fetching settings:', e);
      return null;
    }
  }

  // Fetch Daily Log Document
  async getDailyLog(uid = this.uid, dateStr = this.getTodayString()) {
    if (!uid) return null;
    const docId = `${uid}_${dateStr}`;
    try {
      const res = await fetch(`${FIRESTORE_BASE_URL}/daily_logs/${docId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const fields = data.fields || {};
      return {
        user_id: fields.user_id?.stringValue || uid,
        log_date: fields.log_date?.stringValue || dateStr,
        remaining_seconds: Number(fields.remaining_seconds?.integerValue || fields.remaining_seconds?.doubleValue || 0),
        is_surrendered: !!fields.is_surrendered?.booleanValue
      };
    } catch (e) {
      console.error('Error fetching daily log:', e);
      return null;
    }
  }

  // Fetch Today's Daily Tasks
  async getDailyTasks(uid = this.uid, dateStr = this.getTodayString()) {
    if (!uid) return [];
    try {
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'daily_tasks' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'user_id' },
                    op: 'EQUAL',
                    value: { stringValue: uid }
                  }
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'target_date' },
                    op: 'EQUAL',
                    value: { stringValue: dateStr }
                  }
                }
              ]
            }
          }
        }
      };

      const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody)
      });

      if (!res.ok) return [];
      const results = await res.json();
      
      const tasks = [];
      for (const item of results) {
        if (item.document && item.document.fields) {
          const fields = item.document.fields;
          tasks.push({
            id: item.document.name.split('/').pop(),
            user_id: fields.user_id?.stringValue,
            title: fields.title?.stringValue,
            start_time: fields.start_time?.stringValue || '00:00',
            target_date: fields.target_date?.stringValue,
            is_completed: !!fields.is_completed?.booleanValue
          });
        }
      }
      return tasks;
    } catch (e) {
      console.error('Error fetching daily tasks:', e);
      return [];
    }
  }

  // Update Remaining Seconds in Firestore
  async updateRemainingSeconds(newRemainingSecs, uid = this.uid, dateStr = this.getTodayString()) {
    if (!uid) return false;
    const docId = `${uid}_${dateStr}`;
    try {
      const patchBody = {
        fields: {
          user_id: { stringValue: uid },
          log_date: { stringValue: dateStr },
          remaining_seconds: { integerValue: Math.max(0, Math.floor(newRemainingSecs)) },
          is_surrendered: { booleanValue: newRemainingSecs <= 0 }
        }
      };

      const res = await fetch(`${FIRESTORE_BASE_URL}/daily_logs/${docId}?updateMask.fieldPaths=remaining_seconds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });

      return res.ok;
    } catch (e) {
      console.error('Error updating remaining seconds:', e);
      return false;
    }
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.ExtensionFirebaseService = ExtensionFirebaseService;
}
