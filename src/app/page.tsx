'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  CheckSquare, 
  AlertTriangle, 
  Plus, 
  Clock, 
  Check, 
  Flame, 
  Activity, 
  Timer,
  Info
} from 'lucide-react';
import { 
  db, 
  doc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  getTodayDateString,
  getDailyLogId,
  DailyTask,
  DailyLog
} from '@/lib/firebase';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tasks & Log States
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [isSurrendered, setIsSurrendered] = useState<boolean>(false);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('08:00');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Waiting Room States
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingRoomTimer, setWaitingRoomTimer] = useState(120);
  const [focusResetCount, setFocusResetCount] = useState(0);
  const [waitingRoomStatusText, setWaitingRoomStatusText] = useState('Focus on this window to complete surrender protocol.');

  const todayStr = getTodayDateString();

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Firestore Real-time Sync: Daily Log
  useEffect(() => {
    if (!user) return;

    const logDocId = getDailyLogId(user.uid, todayStr);
    const logRef = doc(db, 'daily_logs', logDocId);

    const unsubLog = onSnapshot(logRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DailyLog;
        setRemainingSeconds(data.remaining_seconds);
        setIsSurrendered(!!data.is_surrendered);
      }
    });

    return () => unsubLog();
  }, [user, todayStr]);

  // Firestore Real-time Sync: Daily Tasks
  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(
      collection(db, 'daily_tasks'),
      where('user_id', '==', user.uid),
      where('target_date', '==', todayStr),
      orderBy('start_time', 'asc')
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks: DailyTask[] = [];
      snapshot.forEach((docSnap) => {
        fetchedTasks.push({ id: docSnap.id, ...docSnap.data() } as DailyTask);
      });
      setTasks(fetchedTasks);
    });

    return () => unsubTasks();
  }, [user, todayStr]);

  // Waiting Room Focus Reset Protocol
  useEffect(() => {
    if (!showWaitingRoom) return;

    const handleFocusLoss = () => {
      setWaitingRoomTimer(120);
      setFocusResetCount((prev) => prev + 1);
      setWaitingRoomStatusText('Focus lost! Timer reset to 120s.');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      setWaitingRoomTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSurrenderComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [showWaitingRoom]);

  // Add Task to Firestore
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taskTitle.trim()) return;
    setIsAddingTask(true);
    try {
      await addDoc(collection(db, 'daily_tasks'), {
        user_id: user.uid,
        title: taskTitle.trim(),
        start_time: taskStartTime,
        target_date: todayStr,
        is_completed: false,
        completed_at: null,
        created_at: serverTimestamp()
      });
      setTaskTitle('');
    } catch (err) {
      console.error('Error adding task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle Task Complete Checkbox
  const handleToggleTaskComplete = async (taskId: string, currentCompletedState: boolean) => {
    if (!taskId) return;
    try {
      const taskRef = doc(db, 'daily_tasks', taskId);
      await updateDoc(taskRef, {
        is_completed: !currentCompletedState,
        completed_at: !currentCompletedState ? serverTimestamp() : null
      });
    } catch (err) {
      console.error('Error updating task state:', err);
    }
  };

  // Surrender Complete Execution
  const handleSurrenderComplete = async () => {
    if (!user) return;
    try {
      const logDocId = getDailyLogId(user.uid, todayStr);
      const logRef = doc(db, 'daily_logs', logDocId);
      await updateDoc(logRef, {
        is_surrendered: true,
        remaining_seconds: 0
      });
      setIsSurrendered(true);
      setRemainingSeconds(0);
      setShowWaitingRoom(false);
    } catch (err) {
      console.error('Error completing surrender:', err);
    }
  };

  // Formatter MM:SS
  const formatMMSS = (totalSecs: number) => {
    const safeSecs = Math.max(0, totalSecs);
    const m = Math.floor(safeSecs / 60);
    const s = safeSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium opacity-70">Loading Tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      
      {/* Status Alert Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border-cyan-500/30">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isSurrendered ? 'bg-amber-400 animate-ping' : remainingSeconds > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-500" />
              Today&apos;s Status ({todayStr}): {isSurrendered ? 'Surrendered' : remainingSeconds > 0 ? 'Active' : 'Tolerance Depleted - Blocked'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700/30 bg-gray-900/20">
          <Timer className="w-4 h-4 text-cyan-500" />
          <span className="text-xs uppercase opacity-60 font-semibold tracking-wider">Remaining:</span>
          <span className={`text-xl font-mono font-bold ${remainingSeconds <= 300 ? 'text-red-500 animate-pulse' : 'text-cyan-500'}`}>
            {formatMMSS(remainingSeconds)}
          </span>
        </div>
      </div>

      {/* Daily Task List Section */}
      <section className="glass-panel p-6 rounded-2xl space-y-6">
        <div className="border-b border-gray-700/30 pb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-cyan-500" />
            Daily Tasks
          </h2>

          <div className="text-xs text-cyan-500 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 font-mono flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{tasks.filter((t) => t.is_completed).length} / {tasks.length} Completed</span>
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-gray-700/30 bg-gray-900/10">
          <div className="flex-1">
            <input
              type="text"
              required
              placeholder="Task title (e.g. Upload Shorts)..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-xs placeholder-[var(--input-placeholder)] focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="w-full sm:w-36">
            <input
              type="time"
              required
              value={taskStartTime}
              onChange={(e) => setTaskStartTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={isAddingTask}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>

        {/* Tasks List */}
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {tasks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700/40 rounded-xl">
              <p className="text-xs opacity-60">No daily tasks scheduled yet.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  task.is_completed
                    ? 'bg-emerald-500/10 border-emerald-500/30 opacity-70'
                    : 'glass-panel border-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Friction 1 Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleTaskComplete(task.id!, task.is_completed)}
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                      task.is_completed
                        ? 'bg-emerald-500 border-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'border-cyan-500 hover:bg-cyan-500/20'
                    }`}
                    title="Click to toggle status"
                  >
                    {task.is_completed && <Check className="w-5 h-5 stroke-[3]" />}
                  </button>

                  <div>
                    <p className={`text-sm font-semibold ${task.is_completed ? 'line-through opacity-60' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Start: {task.start_time}
                      </span>
                      {task.is_completed && (
                        <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* The Waiting Room Section (Emergency Protocol) */}
      <section className="glass-panel-danger p-6 sm:p-8 rounded-2xl border border-red-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider mb-1">
              <AlertTriangle className="w-4 h-4" />
              Emergency Protocol
              <span title="Emergency surrender option: Requires 120s continuous focus without leaving tab" className="cursor-help text-red-400/80 hover:text-red-300">
                <Info className="w-3.5 h-3.5" />
              </span>
            </div>
            <h3 className="text-xl font-bold">The Waiting Room</h3>
          </div>

          <button
            onClick={() => {
              setShowWaitingRoom(true);
              setWaitingRoomTimer(120);
              setFocusResetCount(0);
              setWaitingRoomStatusText('Focus on this window for 120 continuous seconds.');
            }}
            disabled={isSurrendered}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Flame className="w-4 h-4" />
            <span>{isSurrendered ? 'Already Surrendered' : 'Saya Menyerah Hari Ini'}</span>
          </button>
        </div>
      </section>

      {/* Waiting Room Fullscreen Overlay Modal */}
      {showWaitingRoom && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="max-w-md w-full glass-panel-danger p-8 rounded-3xl space-y-6 border border-red-500/40 relative">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">THE WAITING ROOM</h2>
              <p className="text-xs text-red-400 mt-1 uppercase font-semibold tracking-wider">
                Strict Focus Protocol Active
              </p>
            </div>

            {/* Countdown Display */}
            <div className="py-4 bg-black/60 rounded-2xl border border-red-500/30">
              <div className="text-6xl font-mono font-black text-red-500 tracking-tight">
                {waitingRoomTimer}s
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">Continuous Unbroken Focus</p>
            </div>

            {/* Warning Message & Reset Counter */}
            <div className="space-y-2 text-xs">
              <p className="text-amber-300 font-semibold bg-amber-500/10 py-2 px-3 rounded-lg border border-amber-500/20 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>DO NOT switch tabs or minimize window! Focus loss resets timer to 120s!</span>
              </p>
              {focusResetCount > 0 && (
                <p className="text-red-400 font-mono text-[11px]">
                  Resets triggered so far: {focusResetCount} time(s)
                </p>
              )}
              <p className="text-gray-400 text-[11px]">{waitingRoomStatusText}</p>
            </div>

            <button
              onClick={() => setShowWaitingRoom(false)}
              className="text-xs text-gray-500 hover:text-gray-300 font-semibold underline pt-2 cursor-pointer"
            >
              Cancel Protocol
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
