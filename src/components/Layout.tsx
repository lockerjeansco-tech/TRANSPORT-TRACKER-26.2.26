import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PackagePlus, Search, FileBarChart, Settings, LogOut, Shield, AlertTriangle, Menu, X, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { syncOfflineData, getPendingParcels } from '../services/offlineService';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, userProfile, permissionError } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  React.useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        syncOfflineData();
      }
    };

    const checkPending = async () => {
      const pending = await getPendingParcels();
      setPendingCount(pending.length);
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    // Initial sync check
    if (navigator.onLine) {
      syncOfflineData();
    }

    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    auth.signOut();
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/entry', icon: PackagePlus, label: 'New Entry' },
    { to: '/search', icon: Search, label: 'Search & Manage' },
    { to: '/payments', icon: FileBarChart, label: 'Payment Management' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-20 shadow-lg">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <PackagePlus className="text-indigo-400" aria-hidden="true" size={20} />
          ParcelTracker
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar (Mobile & Desktop) */}
      <aside 
        className={cn(
          "bg-slate-900 text-white fixed h-full z-40 flex flex-col transition-transform duration-300 md:translate-x-0 md:w-64",
          isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
        )}
        role="navigation"
        aria-label="Sidebar Navigation"
      >
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PackagePlus className="text-indigo-400" aria-hidden="true" />
            ParcelTracker
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {userProfile?.email}
          </p>
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700">
            {isAdmin ? <Shield className="w-3 h-3 mr-1 text-indigo-400" aria-hidden="true" /> : null}
            {isAdmin ? 'Admin Access' : 'Staff Access'}
          </div>

          <div className="mt-4 space-y-2" aria-live="polite">
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium border",
              isOnline ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
            )}>
              {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
              {isOnline ? 'System Online' : 'System Offline'}
            </div>
            
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                {pendingCount} entries pending sync
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sidebar Header */}
        <div className="p-6 border-b border-slate-800 md:hidden flex justify-between items-center">
          <div>
            <h2 className="font-bold text-indigo-400">ParcelTracker</h2>
            <p className="text-xs text-slate-400 truncate max-w-[150px]">{userProfile?.email}</p>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut size={18} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 min-w-0" id="main-content">
        {permissionError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" role="alert">
            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-red-800">Database Connection Issue</h3>
              <p className="text-sm text-red-700 mt-1">
                The app cannot access the database due to permission settings. 
                Please go to <strong>Settings</strong> to see how to fix the Firestore Security Rules.
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
};
