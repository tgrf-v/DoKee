'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User 
} from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  logOut: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Auth Sync with Chrome Extension via Web Messaging
      if (typeof window !== 'undefined' && currentUser) {
        currentUser.getIdToken().then((token) => {
          const authData = {
            type: 'DOKEE_AUTH_SYNC',
            uid: currentUser.uid,
            email: currentUser.email,
            token: token
          };
          window.postMessage(authData, '*');
          // Also store in localStorage so extension content script can read if needed
          try {
            localStorage.setItem('dokee_uid', currentUser.uid);
            localStorage.setItem('dokee_email', currentUser.email || '');
            localStorage.setItem('dokee_token', token);
          } catch (e) {
            console.error('Storage sync error:', e);
          }
        });
      } else if (typeof window !== 'undefined' && !currentUser) {
        window.postMessage({ type: 'DOKEE_AUTH_LOGOUT' }, '*');
        try {
          localStorage.removeItem('dokee_uid');
          localStorage.removeItem('dokee_email');
          localStorage.removeItem('dokee_token');
        } catch (e) {
          console.error('Storage clear error:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
