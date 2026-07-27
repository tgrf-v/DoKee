'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  CheckSquare, 
  Settings, 
  LogOut, 
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
      <div className="md:hidden sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow">
            D
          </div>
          <span className="font-bold text-lg text-slate-900">Do<span className="text-cyan-600">Kee</span></span>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-700"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container (Floating Grey Card on Desktop) */}
      <aside
        className={`fixed md:sticky top-0 md:top-4 left-0 z-50 h-screen md:h-[calc(100vh-2rem)] md:my-4 md:ml-4 w-60 bg-[#f4f5f7] border border-slate-200/80 md:rounded-3xl flex flex-col justify-between p-5 transition-transform duration-300 shadow-sm ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Section: Brand & Nav Links */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-cyan-500/20">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Do<span className="text-cyan-600">Kee</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">Anti-Distraction Keeper</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile Dropdown */}
        <div className="space-y-3 pt-4 border-t border-slate-200/80">
          {/* Profile Dropdown Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-all flex items-center justify-center shadow-sm"
              title="Profile Options"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-sm">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute bottom-12 left-0 w-52 glass-dropdown rounded-2xl p-2.5 shadow-xl border border-slate-200 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Account</p>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-0.5" title={user.email || ''}>
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => { setIsProfileOpen(false); logOut(); }}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-all cursor-pointer"
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
