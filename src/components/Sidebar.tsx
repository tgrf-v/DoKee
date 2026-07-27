'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  CheckSquare, 
  Settings, 
  Sun, 
  Moon, 
  LogOut, 
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Theme Persistence
  useEffect(() => {
    const savedTheme = (localStorage.getItem('dokee_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dokee_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Do not render sidebar on login page
  if (pathname === '/login' || !user) {
    return null;
  }

  const navItems = [
    { name: 'Tasks', href: '/', icon: CheckSquare },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-40 border-b border-gray-700/30 bg-[var(--nav-bg)] backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-extrabold text-sm">
            D
          </div>
          <span className="font-bold text-lg">Do<span className="text-cyan-500">Kee</span></span>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg border border-gray-700/30 glass-panel"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 border-r border-gray-700/30 bg-[var(--nav-bg)] backdrop-blur-md flex flex-col justify-between p-4 transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Section: Brand & Nav Links */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-extrabold text-lg shadow-md shadow-cyan-500/20">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Do<span className="text-cyan-500">Kee</span>
              </h1>
              <p className="text-[10px] opacity-60">Anti-Distraction Keeper</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                      : 'opacity-70 hover:opacity-100 hover:bg-gray-800/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Theme Toggle & Profile Dropdown */}
        <div className="space-y-3 pt-4 border-t border-gray-700/30">
          {/* Minimalist Icon-Only Theme Toggle */}
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] opacity-60 font-medium">Theme</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-gray-700/40 bg-gray-900/10 hover:bg-gray-800/20 text-xs font-semibold flex items-center justify-center cursor-pointer transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-700/40 bg-gray-900/10 hover:bg-gray-800/20 text-xs font-semibold cursor-pointer transition-all"
              title="Profile Options"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="truncate text-xs font-medium">{user.email}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {isProfileOpen && (
              <div className="absolute bottom-12 left-0 right-0 glass-panel rounded-2xl p-2 shadow-2xl border border-gray-700/40 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-gray-700/30">
                  <p className="text-[10px] opacity-50 uppercase tracking-wider font-semibold">Account</p>
                  <p className="text-xs font-medium truncate mt-0.5" title={user.email || ''}>
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => { setIsProfileOpen(false); logOut(); }}
                  className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
