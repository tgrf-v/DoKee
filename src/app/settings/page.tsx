'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Settings, 
  Clock, 
  Shield, 
  Plus, 
  X, 
  Info, 
  Check,
  Smartphone
} from 'lucide-react';
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  serverTimestamp,
  getTodayDateString,
  getDailyLogId,
  UserSettings,
  DailyLog
} from '@/lib/firebase';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Settings States
  const [blockedUrls, setBlockedUrls] = useState<string[]>(['youtube.com', 'westmanga.co']);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(30);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const todayStr = getTodayDateString();
  const toleranceOptions = [10, 15, 20, 25, 30, 60];

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Firestore Real-time Sync for Settings
  useEffect(() => {
    if (!user) return;

    const settingsRef = doc(db, 'settings', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserSettings;
        setBlockedUrls(data.blocked_urls || []);
        setToleranceMinutes(data.tolerance_minutes ?? 30);
      }
    });

    return () => unsubSettings();
  }, [user]);

  // Save Settings to Firestore
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const settingsRef = doc(db, 'settings', user.uid);
      await setDoc(settingsRef, {
        blocked_urls: blockedUrls,
        tolerance_minutes: Number(toleranceMinutes),
        updated_at: serverTimestamp()
      }, { merge: true });

      // Update remaining seconds in today's log if applicable
      const logDocId = getDailyLogId(user.uid, todayStr);
      const logRef = doc(db, 'daily_logs', logDocId);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        const logData = logSnap.data() as DailyLog;
        if (!logData.is_surrendered && logData.remaining_seconds > Number(toleranceMinutes) * 60) {
          await updateDoc(logRef, {
            remaining_seconds: Number(toleranceMinutes) * 60
          });
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addBlockedUrl = () => {
    let clean = newUrlInput.trim().toLowerCase();
    clean = clean.replace(/^(https?:\/\/)?(www\.)?/, '');
    if (clean && !blockedUrls.includes(clean)) {
      setBlockedUrls([...blockedUrls, clean]);
      setNewUrlInput('');
    }
  };

  const removeBlockedUrl = (urlToRemove: string) => {
    setBlockedUrls(blockedUrls.filter((u) => u !== urlToRemove));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium opacity-70">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-700/30 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-500" />
            System Settings
          </h1>
          <p className="text-xs opacity-60 mt-1">Configure global anti-distraction rules & tolerance limits</p>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Section 1: Daily Tolerance Limits */}
        <section className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold uppercase tracking-wider opacity-80 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              Daily Tolerance Minutes
            </label>
            <span title="Total accumulated minutes allowed per day across all blocked sites" className="cursor-help opacity-50 hover:opacity-100">
              <Info className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {toleranceOptions.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setToleranceMinutes(mins)}
                className={`py-3 rounded-xl font-mono text-sm font-bold transition-all cursor-pointer border ${
                  toleranceMinutes === mins
                    ? 'bg-cyan-500 text-black border-cyan-500 shadow-md shadow-cyan-500/20'
                    : 'bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] hover:border-cyan-500/50'
                }`}
              >
                {mins} mins
              </button>
            ))}
          </div>
        </section>

        {/* Section 2: Blocked URLs / Distraction Sites */}
        <section className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold uppercase tracking-wider opacity-80 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-500" />
              Blocked Domains ({blockedUrls.length})
            </label>
            <span title="Websites that will trigger warning and penalty overlays when tasks are overdue" className="cursor-help opacity-50 hover:opacity-100">
              <Info className="w-4 h-4" />
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. youtube.com, westmanga.co"
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlockedUrl(); } }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-sm placeholder-[var(--input-placeholder)] focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={addBlockedUrl}
              className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs font-bold border border-gray-700 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {blockedUrls.map((url) => (
              <span
                key={url}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 text-xs font-mono"
              >
                {url}
                <button
                  type="button"
                  onClick={() => removeBlockedUrl(url)}
                  className="text-gray-400 hover:text-red-500 font-bold cursor-pointer"
                  title="Remove domain"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Section 3: Extension Sync Instructions */}
        <section className="glass-panel p-6 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-500">
            <Smartphone className="w-4 h-4" />
            Chrome Extension Sync
          </div>
          <p className="text-xs opacity-70 leading-relaxed">
            Ensure you have loaded the DoKee Chrome Extension in your browser. Open the extension popup and click <strong>Sync Auth from Web App</strong> to keep distractor blockers in sync with your account.
          </p>
        </section>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {isSaving ? 'Saving Settings...' : 'Save Settings'}
        </button>
      </form>
    </main>
  );
}
