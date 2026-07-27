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
  Tag as TagIcon,
  ListTodo,
  Shield,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Trash2,
  FileText
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
  DailyLog,
  SubTask,
  UserSettings
} from '@/lib/firebase';

const CATEGORY_OPTIONS = [
  { value: 'Work', label: 'Work', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'Personal', label: 'Personal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'Study', label: 'Study', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'Project', label: 'Project', color: 'bg-amber-50 text-amber-700 border-amber-200' },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Settings & Log States
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(30);
  const [isSurrendered, setIsSurrendered] = useState<boolean>(false);
  const [blockedUrls, setBlockedUrls] = useState<string[]>([]);
  
  // Tasks & Selection States
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('08:00');
  const [taskCategory, setTaskCategory] = useState<'Personal' | 'Work' | 'Study' | 'Project'>('Work');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Custom Dropdown Open States
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isDetailCategoryOpen, setIsDetailCategoryOpen] = useState(false);
  const [isDetailDeadlineTypeOpen, setIsDetailDeadlineTypeOpen] = useState(false);

  const addCategoryRef = useRef<HTMLDivElement>(null);
  const detailCategoryRef = useRef<HTMLDivElement>(null);
  const detailDeadlineRef = useRef<HTMLDivElement>(null);

  // Detail Inspector Subtask State
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Waiting Room States
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingRoomTimer, setWaitingRoomTimer] = useState(120);
  const [focusResetCount, setFocusResetCount] = useState(0);
  const [waitingRoomStatusText, setWaitingRoomStatusText] = useState('Focus on this window to complete surrender protocol.');

  const todayStr = getTodayDateString();

  // Close Custom Dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addCategoryRef.current && !addCategoryRef.current.contains(e.target as Node)) {
        setIsAddCategoryOpen(false);
      }
      if (detailCategoryRef.current && !detailCategoryRef.current.contains(e.target as Node)) {
        setIsDetailCategoryOpen(false);
      }
      if (detailDeadlineRef.current && !detailDeadlineRef.current.contains(e.target as Node)) {
        setIsDetailDeadlineTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Firestore Real-time Sync: Settings
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
      const newTaskData = {
        user_id: user.uid,
        title: taskTitle.trim(),
        description: '',
        category: taskCategory,
        start_time: taskStartTime,
        target_date: todayStr,
        deadline_type: 'daily',
        deadline_time: taskStartTime,
        subtasks: [],
        is_completed: false,
        completed_at: null,
        created_at: serverTimestamp()
      };
      await addDoc(collection(db, 'daily_tasks'), newTaskData);
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

  // Update Detail Inspector Task Attributes
  const handleUpdateTaskDetail = async (fields: Partial<DailyTask>) => {
    if (!selectedTask || !selectedTask.id) return;
    try {
      const taskRef = doc(db, 'daily_tasks', selectedTask.id);
      await updateDoc(taskRef, fields);
      setSelectedTask({ ...selectedTask, ...fields });
    } catch (err) {
      console.error('Error updating task details:', err);
    }
  };

  // Add Subtask to Selected Task
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !selectedTask.id || !newSubtaskTitle.trim()) return;

    const newSub: SubTask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      is_completed: false
    };

    const currentSubtasks = selectedTask.subtasks || [];
    const updatedSubtasks = [...currentSubtasks, newSub];

    await handleUpdateTaskDetail({ subtasks: updatedSubtasks });
    setNewSubtaskTitle('');
  };

  // Toggle Subtask Completion
  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask || !selectedTask.id) return;
    const currentSubtasks = selectedTask.subtasks || [];
    const updatedSubtasks = currentSubtasks.map((st) => 
      st.id === subtaskId ? { ...st, is_completed: !st.is_completed } : st
    );

    await handleUpdateTaskDetail({ subtasks: updatedSubtasks });
  };

  // Remove Subtask
  const handleRemoveSubtask = async (subtaskId: string) => {
    if (!selectedTask || !selectedTask.id) return;
    const currentSubtasks = selectedTask.subtasks || [];
    const updatedSubtasks = currentSubtasks.filter((st) => st.id !== subtaskId);

    await handleUpdateTaskDetail({ subtasks: updatedSubtasks });
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

  // Stats Calculations
  const completedTasksCount = tasks.filter((t) => t.is_completed).length;
  const totalTasksCount = tasks.length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading DoKee...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto p-4 md:py-4 md:pr-4 md:pl-0 space-y-6">
      


      {/* 2 : 1.2 Grid Proportions Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr] gap-6 items-start">
        
        {/* CENTER COLUMN: Main Content (Pure White Card with Border) */}
        <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] overflow-y-auto">
          
          {/* Daily Task List Section */}
          <section className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-cyan-600" />
                Daily Tasks
              </h2>

              <div className="text-xs text-cyan-700 bg-cyan-50 px-3.5 py-1.5 rounded-xl border border-cyan-200 font-mono font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{completedTasksCount} / {totalTasksCount} Completed</span>
              </div>
            </div>

            {/* Add Task Form with Custom Dropdown */}
            <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Upload Shorts)..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm"
                />
              </div>

              {/* Custom Category Dropdown */}
              <div className="relative w-32" ref={addCategoryRef}>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(!isAddCategoryOpen)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all shadow-sm"
                >
                  <span>{taskCategory}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isAddCategoryOpen && (
                  <div className="absolute top-12 left-0 right-0 glass-dropdown rounded-2xl p-1.5 z-50 animate-fade-in">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => {
                          setTaskCategory(cat.value as any);
                          setIsAddCategoryOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 cursor-pointer ${
                          taskCategory === cat.value ? 'bg-cyan-50 text-cyan-700 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cat.value === 'Work' ? 'bg-cyan-500' : cat.value === 'Personal' ? 'bg-emerald-500' : cat.value === 'Study' ? 'bg-purple-500' : 'bg-amber-500'}`} />
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-28">
                <input
                  type="time"
                  required
                  value={taskStartTime}
                  onChange={(e) => setTaskStartTime(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-cyan-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingTask}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-600/20"
                title="Add task"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </form>

            {/* Tasks List */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 font-medium">No daily tasks scheduled yet.</p>
                </div>
              ) : (
                tasks.map((task) => {
                  const isSelected = selectedTask?.id === task.id;
                  const categoryStyle = CATEGORY_OPTIONS.find(c => c.value === task.category)?.color || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-cyan-500 bg-cyan-50/50 shadow-sm'
                          : task.is_completed
                          ? 'bg-emerald-50/40 border-emerald-200/80 opacity-80'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTaskComplete(task.id!, task.is_completed);
                          }}
                          className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            task.is_completed
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                              : 'border-cyan-500 hover:bg-cyan-50 text-cyan-600'
                          }`}
                          title="Click to toggle status"
                        >
                          {task.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold text-slate-900 ${task.is_completed ? 'line-through opacity-50' : ''}`}>
                              {task.title}
                            </p>
                            {task.category && (
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${categoryStyle}`}>
                                {task.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                            <span className="font-mono text-cyan-700 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Start: {task.start_time}
                            </span>
                            {task.deadline_type === 'project' && (
                              <span className="font-mono text-amber-700 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Project Deadline: {task.deadline_date || 'TBD'}
                              </span>
                            )}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <span className="flex items-center gap-1 font-mono text-slate-600">
                                <ListTodo className="w-3 h-3" /> {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length} subtasks
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className={`w-4 h-4 opacity-30 transition-transform ${isSelected ? 'translate-x-1 opacity-100 text-cyan-600' : ''}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Emergency Waiting Room Section */}
          <section className="p-5 rounded-2xl bg-red-50/80 border border-red-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-red-600 text-xs font-bold uppercase tracking-wider mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Emergency Protocol
                  <span title="Emergency surrender option: Requires 120s continuous focus without leaving tab" className="cursor-help text-red-500 hover:text-red-700">
                    <Info className="w-3.5 h-3.5" />
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">The Waiting Room</h3>
              </div>

              <button
                onClick={() => {
                  setShowWaitingRoom(true);
                  setWaitingRoomTimer(120);
                  setFocusResetCount(0);
                  setWaitingRoomStatusText('Focus on this window for 120 continuous seconds.');
                }}
                disabled={isSurrendered}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Flame className="w-4 h-4" />
                <span>{isSurrendered ? 'Already Surrendered' : 'Saya Menyerah Hari Ini'}</span>
              </button>
            </div>
          </section>

        </div>

        {/* RIGHT UTILITY PANEL: Floating Grey Card (Grey Container) */}
        <div className="space-y-6 bg-[#f4f5f7] p-6 rounded-3xl border border-slate-200/80 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] overflow-y-auto">
          
          {/* 1. SELECTED TASK DETAIL INSPECTOR */}
          <section className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-cyan-700">
                <FileText className="w-4 h-4 text-cyan-600" />
                Task Details Inspector
              </h3>
              {selectedTask && (
                <span className="text-[10px] font-mono text-slate-400">ID: #{selectedTask.id?.substring(0, 6)}</span>
              )}
            </div>

            {selectedTask ? (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Task Title</label>
                  <input
                    type="text"
                    value={selectedTask.title}
                    onChange={(e) => handleUpdateTaskDetail({ title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description & Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Add description or notes..."
                    value={selectedTask.description || ''}
                    onChange={(e) => handleUpdateTaskDetail({ description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Custom Category & Custom Deadline Type Selectors */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Custom Detail Category Selector */}
                  <div className="relative" ref={detailCategoryRef}>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <TagIcon className="w-3 h-3 text-cyan-600" /> Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDetailCategoryOpen(!isDetailCategoryOpen)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all"
                    >
                      <span>{selectedTask.category || 'Work'}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isDetailCategoryOpen && (
                      <div className="absolute top-14 left-0 right-0 glass-dropdown rounded-xl p-1.5 z-50 animate-fade-in">
                        {CATEGORY_OPTIONS.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              handleUpdateTaskDetail({ category: cat.value });
                              setIsDetailCategoryOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all flex items-center gap-2 cursor-pointer ${
                              selectedTask.category === cat.value ? 'bg-cyan-50 text-cyan-700 font-bold' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${cat.value === 'Work' ? 'bg-cyan-500' : cat.value === 'Personal' ? 'bg-emerald-500' : cat.value === 'Study' ? 'bg-purple-500' : 'bg-amber-500'}`} />
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Custom Detail Deadline Type Selector */}
                  <div className="relative" ref={detailDeadlineRef}>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-600" /> Deadline Type
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDetailDeadlineTypeOpen(!isDetailDeadlineTypeOpen)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all"
                    >
                      <span>{selectedTask.deadline_type === 'project' ? 'Project Date' : 'Daily Schedule'}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isDetailDeadlineTypeOpen && (
                      <div className="absolute top-14 left-0 right-0 glass-dropdown rounded-xl p-1.5 z-50 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateTaskDetail({ deadline_type: 'daily' });
                            setIsDetailDeadlineTypeOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                            selectedTask.deadline_type !== 'project' ? 'bg-cyan-50 text-cyan-700 font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Daily Schedule
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateTaskDetail({ deadline_type: 'project' });
                            setIsDetailDeadlineTypeOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                            selectedTask.deadline_type === 'project' ? 'bg-cyan-50 text-cyan-700 font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          Project Date
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deadline Date if Project */}
                {selectedTask.deadline_type === 'project' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <label className="block text-[11px] font-bold text-amber-800 uppercase">Target Completion Date</label>
                    <input
                      type="date"
                      value={selectedTask.deadline_date || todayStr}
                      onChange={(e) => handleUpdateTaskDetail({ deadline_date: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Subtasks Checklist Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5 text-cyan-600" />
                      Subtasks Checklist
                    </label>
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">
                      {selectedTask.subtasks?.filter(s => s.is_completed).length || 0} / {selectedTask.subtasks?.length || 0}
                    </span>
                  </div>

                  {/* Add Subtask Form */}
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask step..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-cyan-500 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  {/* Subtask Items */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedTask.subtasks?.map((st) => (
                      <div key={st.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={st.is_completed}
                            onChange={() => handleToggleSubtask(st.id)}
                            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className={st.is_completed ? 'line-through opacity-40' : ''}>{st.title}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(st.id)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                Select a task from the list to inspect details & subtasks.
              </div>
            )}
          </section>

          {/* 2. MINI PROGRESS & FOCUS STATS WIDGET ⭐ */}
          <section className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-cyan-700">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                Focus Stats & Progress
              </h3>
              <span className="text-xs font-bold font-mono text-cyan-700">{progressPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono font-medium">
                <span>{completedTasksCount} Completed</span>
                <span>{totalTasksCount - completedTasksCount} Remaining</span>
              </div>
            </div>

            {/* Streak & Time Summary Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-black text-slate-900 font-mono">5 Days</p>
                <p className="text-[10px] text-amber-800 uppercase font-bold">Focus Streak</p>
              </div>

              <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-center">
                <Timer className="w-5 h-5 text-cyan-600 mx-auto mb-1" />
                <p className="text-lg font-black text-slate-900 font-mono">{toleranceMinutes}m</p>
                <p className="text-[10px] text-cyan-800 uppercase font-bold">Daily Limit</p>
              </div>
            </div>
          </section>

          {/* 3. CHROME EXTENSION LIVE STATUS CARD 🛡️ */}
          <section className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-800">
                <Shield className="w-4 h-4 text-emerald-600" />
                Extension Status
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Firestore real-time sync connected. Currently monitoring <strong className="text-cyan-700">{blockedUrls.length} blocked domains</strong> for distraction enforcement.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {blockedUrls.map((url) => (
                <span key={url} className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700">
                  {url}
                </span>
              ))}
            </div>
          </section>

        </div>

      </div>

      {/* Waiting Room Fullscreen Overlay Modal */}
      {showWaitingRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="max-w-md w-full glass-panel-danger p-8 rounded-3xl space-y-6 border border-red-300 relative shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-100 border border-red-300 flex items-center justify-center mx-auto text-red-600">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">THE WAITING ROOM</h2>
              <p className="text-xs text-red-600 mt-1 uppercase font-bold tracking-wider">
                Strict Focus Protocol Active
              </p>
            </div>

            <div className="py-4 bg-white rounded-2xl border border-red-200 shadow-inner">
              <div className="text-6xl font-mono font-black text-red-600 tracking-tight">
                {waitingRoomTimer}s
              </div>
              <p className="text-xs text-slate-500 mt-2 font-semibold">Continuous Unbroken Focus</p>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-amber-800 font-bold bg-amber-50 py-2.5 px-3 rounded-xl border border-amber-200 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>DO NOT switch tabs or minimize window! Focus loss resets timer to 120s!</span>
              </p>
              {focusResetCount > 0 && (
                <p className="text-red-600 font-mono text-[11px] font-bold">
                  Resets triggered so far: {focusResetCount} time(s)
                </p>
              )}
              <p className="text-slate-500 text-[11px] font-medium">{waitingRoomStatusText}</p>
            </div>

            <button
              onClick={() => setShowWaitingRoom(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold underline pt-2 cursor-pointer"
            >
              Cancel Protocol
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
