import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoKeyDoKeeFirebase2026",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dokee-d7356.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dokee-d7356",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dokee-d7356.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "113028816861",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:113028816861:web:abcdef1234567890"
};

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export { app };
export { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
};

export type { User, Unsubscribe };

// Date & Helper utilities for Firestore schemas
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyLogId(uid: string, dateStr: string = getTodayDateString()): string {
  return `${uid}_${dateStr}`;
}

export interface UserSettings {
  blocked_urls: string[];
  tolerance_minutes: number;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
}

export interface SubTask {
  id: string;
  title: string;
  is_completed: boolean;
}

export interface DailyTask {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  category?: 'Personal' | 'Work' | 'Study' | 'Project' | string;
  start_time: string; // "HH:mm"
  target_date: string; // "YYYY-MM-DD"
  deadline_type?: 'daily' | 'project';
  deadline_date?: string; // "YYYY-MM-DD"
  deadline_time?: string; // "HH:mm"
  subtasks?: SubTask[];
  is_completed: boolean;
  completed_at?: Timestamp | null;
  created_at?: Timestamp | null;
}

export interface DailyLog {
  user_id: string;
  log_date: string; // "YYYY-MM-DD"
  remaining_seconds: number;
  is_surrendered: boolean;
}
