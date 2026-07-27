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
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Container */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-600" />
            System Settings
          </h1>
          <span title="Configure global anti-distraction rules & tolerance limits" className="cursor-help text-cyan-600 hover:text-cyan-700">
            <Info className="w-4 h-4" />
          </span>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* Section 1: Daily Tolerance Limits */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              Daily Tolerance Minutes
            </label>
            <span title="Total accumulated minutes allowed per day across all blocked sites" className="cursor-help text-slate-400 hover:text-slate-600">
              <Info className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {toleranceOptions.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setToleranceMinutes(mins)}
                className={`py-3 rounded-2xl font-mono text-sm font-bold transition-all cursor-pointer border ${
                  toleranceMinutes === mins
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/20'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-cyan-500 hover:bg-slate-100'
                }`}
              >
                {mins} mins
              </button>
            ))}
          </div>
        </section>

        {/* Section 2: Blocked URLs / Distraction Sites */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-600" />
              Blocked Domains ({blockedUrls.length})
            </label>
            <span title="Websites that will trigger warning and penalty overlays when tasks are overdue" className="cursor-help text-slate-400 hover:text-slate-600">
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={addBlockedUrl}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold border border-slate-800 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {blockedUrls.map((url) => (
              <span
                key={url}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-mono font-semibold"
              >
                {url}
                <button
                  type="button"
                  onClick={() => removeBlockedUrl(url)}
                  className="text-cyan-400 hover:text-red-600 font-bold cursor-pointer"
                  title="Remove domain"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Section 3: Extension Sync Instructions */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700">
            <Smartphone className="w-4 h-4 text-cyan-600" />
            Chrome Extension Sync
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Ensure you have loaded the DoKee Chrome Extension in your browser. Open the extension popup and click <strong>Sync Auth from Web App</strong> to keep distractor blockers in sync with your account.
          </p>
        </section>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-cyan-600/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {isSaving ? 'Saving Settings...' : 'Save Settings'}
        </button>
      </form>
    </main>
  );
}
