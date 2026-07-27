'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  Calendar,
  ListTodo,
  Shield,
  ChevronRight,
  ChevronDown,
  Trash2,
  Tag as TagIcon
} from 'lucide-react';
import { 
  db, 
  doc, 
  updateDoc, 
  deleteDoc,
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
  DailyLog,
  SubTask,
  UserSettings
} from '@/lib/firebase';

const CATEGORY_OPTIONS = [
  { value: 'Work', label: 'Work', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { value: 'Personal', label: 'Personal', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'Study', label: 'Study', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'Project', label: 'Project', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Log & Settings States
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [isSurrendered, setIsSurrendered] = useState<boolean>(false);
  
  // Tasks & Selected Task
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  
  // Add Task Input State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'Work' | 'Personal' | 'Study' | 'Project'>('Work');
  const [newTaskTime, setNewTaskTime] = useState('08:00');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Inspector Draft States
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftCategory, setDraftCategory] = useState<'Work' | 'Personal' | 'Study' | 'Project'>('Work');
  const [draftDeadlineType, setDraftDeadlineType] = useState<'daily' | 'project'>('daily');
  const [draftDeadlineDate, setDraftDeadlineDate] = useState('');
  const [draftSubtasks, setDraftSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Waiting Room Overlay State
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingRoomTimer, setWaitingRoomTimer] = useState(120);
  const [focusResetCount, setFocusResetCount] = useState(0);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const todayStr = getTodayDateString();

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Sync Draft Inspector whenever selectedTask changes
  useEffect(() => {
    if (selectedTask) {
      setDraftTitle(selectedTask.title || '');
      setDraftDescription(selectedTask.description || '');
      setDraftCategory((selectedTask.category as any) || 'Work');
      setDraftDeadlineType(selectedTask.deadline_type || 'daily');
      setDraftDeadlineDate(selectedTask.deadline_date || todayStr);
      setDraftSubtasks(selectedTask.subtasks || []);
    } else {
      setDraftTitle('');
      setDraftDescription('');
      setDraftSubtasks([]);
    }
  }, [selectedTask, todayStr]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Firestore Real-time Sync: Tasks List
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

      if (fetchedTasks.length > 0) {
        setSelectedTask((prev) => {
          if (!prev) return fetchedTasks[0];
          const updated = fetchedTasks.find((t) => t.id === prev.id);
          return updated || fetchedTasks[0];
        });
      } else {
        setSelectedTask(null);
      }
    });
    return () => unsubTasks();
  }, [user, todayStr]);

  // Waiting Room Focus Reset Protocol
  useEffect(() => {
    if (!showWaitingRoom) return;

    const handleFocusLoss = () => {
      setWaitingRoomTimer(120);
      setFocusResetCount((prev) => prev + 1);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleFocusLoss();
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

  // Add New Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;
    setIsAddingTask(true);
    try {
      const newTaskData = {
        user_id: user.uid,
        title: newTaskTitle.trim(),
        description: '',
        category: newTaskCategory,
        start_time: newTaskTime,
        target_date: todayStr,
        deadline_type: 'daily',
        deadline_time: newTaskTime,
        subtasks: [],
        is_completed: false,
        completed_at: null,
        created_at: serverTimestamp()
      };
      await addDoc(collection(db, 'daily_tasks'), newTaskData);
      setNewTaskTitle('');
    } catch (err) {
      console.error('Error adding task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle Task Completion Checkbox
  const handleToggleTaskComplete = async (taskId: string, currentCompletedState: boolean) => {
    if (!taskId) return;
    try {
      const taskRef = doc(db, 'daily_tasks', taskId);
      await updateDoc(taskRef, {
        is_completed: !currentCompletedState,
        completed_at: !currentCompletedState ? serverTimestamp() : null
      });
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  // Save Changes to Currently Selected Task
  const handleSaveChanges = async () => {
    if (!selectedTask || !selectedTask.id) return;
    setIsSavingChanges(true);
    try {
      const taskRef = doc(db, 'daily_tasks', selectedTask.id);
      const updatePayload = {
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        category: draftCategory,
        deadline_type: draftDeadlineType,
        deadline_date: draftDeadlineDate,
        subtasks: draftSubtasks
      };
      await updateDoc(taskRef, updatePayload);
    } catch (err) {
      console.error('Error saving task changes:', err);
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Delete Currently Selected Task
  const handleDeleteSelectedTask = async () => {
    if (!selectedTask || !selectedTask.id) return;
    try {
      const taskRef = doc(db, 'daily_tasks', selectedTask.id);
      await deleteDoc(taskRef);
      setSelectedTask(null);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Add Subtask to Draft
  const handleAddSubtaskDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      is_completed: false
    };
    setDraftSubtasks([...draftSubtasks, newSub]);
    setNewSubtaskTitle('');
  };

  // Toggle Subtask Draft Checkbox
  const handleToggleSubtaskDraft = (subId: string) => {
    setDraftSubtasks(draftSubtasks.map((st) => 
      st.id === subId ? { ...st, is_completed: !st.is_completed } : st
    ));
  };

  // Delete Subtask Draft Item
  const handleDeleteSubtaskDraft = (subId: string) => {
    setDraftSubtasks(draftSubtasks.filter((st) => st.id !== subId));
  };

  // Surrender Protocol Complete
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
      console.error('Error executing surrender:', err);
    }
  };

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
          <p className="text-sm font-medium opacity-70">Loading DoKee...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-screen">
      
      {/* Top Status & Surrender Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 mb-6 rounded-2xl glass-panel border-cyan-500/30">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isSurrendered ? 'bg-amber-400 animate-ping' : remainingSeconds > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-500" />
            Status ({todayStr}): {isSurrendered ? 'Surrendered Mode' : remainingSeconds > 0 ? 'Tolerance Active' : 'Tolerance Depleted'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-700/30 bg-gray-900/20 font-mono text-sm font-bold text-cyan-400">
            <Timer className="w-4 h-4 text-cyan-500" />
            <span>{formatMMSS(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setShowWaitingRoom(true)}
            disabled={isSurrendered}
            className="px-3.5 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Surrender</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid matching reference UI layout (Center Tasks + Right Details Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CENTER COLUMN: Tasks View (7/12 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Header Bar: "Today" & Count Badge */}
          <div className="flex items-center gap-3 px-1">
            <h1 className="text-3xl font-extrabold tracking-tight">Today</h1>
            <span className="px-3 py-1 rounded-xl bg-gray-800 border border-gray-700 font-mono text-sm font-bold opacity-80">
              {tasks.length}
            </span>
          </div>

          {/* "+ Add New Task" Quick Bar */}
          <form onSubmit={handleAddTask} className="flex items-center gap-2 p-2.5 rounded-xl glass-panel border-gray-700/40">
            <Plus className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
            <input
              type="text"
              required
              placeholder="Add New Task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-transparent text-sm placeholder-gray-500 focus:outline-none px-2"
            />
            <input
              type="time"
              value={newTaskTime}
              onChange={(e) => setNewTaskTime(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-xs font-mono focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAddingTask}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {/* Tasks List */}
          <div className="space-y-2.5">
            {tasks.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-700/40 rounded-2xl">
                <p className="text-xs opacity-50">No tasks scheduled for today.</p>
              </div>
            ) : (
              tasks.map((task) => {
                const isSelected = selectedTask?.id === task.id;
                const categoryStyle = CATEGORY_OPTIONS.find(c => c.value === task.category)?.color || 'bg-gray-800 text-cyan-400';

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                        : task.is_completed
                        ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                        : 'glass-panel border-gray-700/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 flex-1">
                      {/* Checkbox (Friction 1) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTaskComplete(task.id!, task.is_completed);
                        }}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          task.is_completed
                            ? 'bg-emerald-500 border-emerald-500 text-black'
                            : 'border-gray-500 hover:border-cyan-500'
                        }`}
                      >
                        {task.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      {/* Title & Metadata Pills */}
                      <div className="flex-1 space-y-1">
                        <p className={`text-sm font-semibold ${task.is_completed ? 'line-through opacity-60' : ''}`}>
                          {task.title}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {/* Time Badge */}
                          <span className="font-mono opacity-60 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {task.start_time}
                          </span>

                          {/* Subtask Count Badge */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 text-gray-300 font-mono text-[10px]">
                              {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length} Subtasks
                            </span>
                          )}

                          {/* Category Badge */}
                          {task.category && (
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${categoryStyle}`}>
                              {task.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Chevron > */}
                    <ChevronRight className={`w-4 h-4 opacity-40 transition-transform ${isSelected ? 'translate-x-1 opacity-100 text-cyan-400' : ''}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Task Detail Inspector (5/12 cols) matching reference layout */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-6 rounded-2xl space-y-6 border-gray-700/40 sticky top-4">
            <h2 className="text-xl font-bold border-b border-gray-700/30 pb-3">Task:</h2>

            {selectedTask ? (
              <div className="space-y-5">
                {/* Editable Title */}
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full text-base font-bold bg-transparent border-b border-gray-700/50 pb-2 focus:outline-none focus:border-cyan-500"
                />

                {/* Editable Description */}
                <div>
                  <label className="block text-xs font-semibold opacity-60 mb-1.5">Description</label>
                  <textarea
                    rows={4}
                    placeholder="Add description..."
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* List / Category Selector */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold opacity-60">List</span>
                  
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <span>{draftCategory}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute right-0 mt-1 w-36 glass-dropdown rounded-xl p-1 z-50 animate-fade-in">
                        {CATEGORY_OPTIONS.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              setDraftCategory(cat.value as any);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-left flex items-center gap-2 cursor-pointer ${
                              draftCategory === cat.value ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-gray-800/40 opacity-80'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${cat.value === 'Work' ? 'bg-cyan-400' : cat.value === 'Personal' ? 'bg-emerald-400' : cat.value === 'Study' ? 'bg-purple-400' : 'bg-amber-400'}`} />
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Due Date Selector */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold opacity-60">Due date</span>
                  <input
                    type="date"
                    value={draftDeadlineDate}
                    onChange={(e) => setDraftDeadlineDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Subtasks Section */}
                <div className="space-y-3 pt-3 border-t border-gray-700/30">
                  <h3 className="text-sm font-bold">Subtasks:</h3>

                  {/* Add Subtask Form */}
                  <form onSubmit={handleAddSubtaskDraft} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="+ Add New Subtask"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>

                  {/* Subtask Items Checklist */}
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {draftSubtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/40 border border-gray-800">
                        <label className="flex items-center gap-2.5 text-xs cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={st.is_completed}
                            onChange={() => handleToggleSubtaskDraft(st.id)}
                            className="rounded border-gray-700 text-cyan-500"
                          />
                          <span className={st.is_completed ? 'line-through opacity-50' : ''}>{st.title}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtaskDraft(st.id)}
                          className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Footer: Delete Task & Save Changes */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700/30 gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteSelectedTask}
                    className="px-4 py-2.5 rounded-xl border border-gray-700/50 bg-gray-900/20 hover:bg-red-500/10 hover:border-red-500/30 text-red-400 font-semibold text-xs transition-all cursor-pointer"
                  >
                    Delete Task
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={isSavingChanges}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shadow-md shadow-amber-400/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingChanges ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 opacity-50 text-xs">
                Select a task to view details.
              </div>
            )}
          </div>
        </div>

      </div>

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

            <div className="py-4 bg-black/60 rounded-2xl border border-red-500/30">
              <div className="text-6xl font-mono font-black text-red-500 tracking-tight">
                {waitingRoomTimer}s
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">Continuous Unbroken Focus</p>
            </div>

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
