import React from 'react';
import { LayoutDashboard, ShoppingBag, Settings, Radio } from 'lucide-react';
import { TabView } from '../types';

interface LayoutProps {
  currentTab: TabView;
  onTabChange: (tab: TabView) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentTab, onTabChange, children }) => {
  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header - Desktop Only with Navigation Tabs */}
      <header className="hidden md:flex flex-col border-b border-slate-800 bg-slate-950">
        {/* Top Bar with Logo and Version */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold">E</div>
            <span className="font-bold text-xl tracking-tight">StreamElf</span>
          </div>
          <div className="text-sm text-slate-400">v1.0.0 Alpha</div>
        </div>
        {/* Navigation Tabs - Desktop */}
        <nav className="border-t border-slate-800">
          <div className="flex items-center h-16">
            <NavButton 
              active={currentTab === 'elf-select'} 
              onClick={() => onTabChange('elf-select')}
              icon={<LayoutDashboard size={20} />}
              label="Home"
            />
            <NavButton 
              active={currentTab === 'products'} 
              onClick={() => onTabChange('products')}
              icon={<ShoppingBag size={20} />}
              label="Products"
            />
            <NavButton 
              active={currentTab === 'connect'} 
              onClick={() => onTabChange('connect')}
              icon={<Settings size={20} />}
              label="Setup"
            />
            <NavButton 
              active={currentTab === 'live-room'} 
              onClick={() => onTabChange('live-room')}
              icon={<Radio size={20} />}
              label="Go Live"
              highlight
            />
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 pb-20 md:pb-0 relative ${
        currentTab === 'live-room' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}>
        {children}
      </main>

      {/* Bottom Navigation (Mobile First) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 pb-safe md:static md:hidden z-50">
        <div className="flex justify-around items-center h-16">
          <NavButton 
            active={currentTab === 'elf-select'} 
            onClick={() => onTabChange('elf-select')}
            icon={<LayoutDashboard size={20} />}
            label="Home"
          />
          <NavButton 
            active={currentTab === 'products'} 
            onClick={() => onTabChange('products')}
            icon={<ShoppingBag size={20} />}
            label="Products"
          />
          <NavButton 
            active={currentTab === 'connect'} 
            onClick={() => onTabChange('connect')}
            icon={<Settings size={20} />}
            label="Setup"
          />
          <NavButton 
            active={currentTab === 'live-room'} 
            onClick={() => onTabChange('live-room')}
            icon={<Radio size={20} />}
            label="Go Live"
            highlight
          />
        </div>
      </nav>
      
      {/* Desktop Sidebar (Mockup for responsive structure, simplified here to just act like bottom nav for consistency in this demo) */}
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, highlight }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col md:flex-row items-center justify-center gap-2 w-full h-full transition-colors px-4 ${
      active 
        ? highlight ? 'text-pink-400 bg-pink-500/10' : 'text-purple-400 bg-purple-500/10'
        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
    }`}
  >
    <div className={`p-1 rounded-lg ${highlight && active ? 'bg-pink-500/20' : ''}`}>
      {icon}
    </div>
    <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium">{label}</span>
  </button>
);

export default Layout;