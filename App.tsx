import React, { useState, useEffect } from 'react';
import { AppState, TabView } from './types';
import { ELF_PERSONALITIES } from './constants';
import Layout from './components/Layout';
import ElfSelector from './components/ElfSelector';
import ProductManager from './components/ProductManager';
import LiveDashboard from './components/LiveDashboard';
import FloatingPrompter from './components/FloatingPrompter';
import FloatingElf from './components/FloatingElf';
import { Settings, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'streamelf-app-state';

// Load state from localStorage
const loadState = (): AppState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }
  return null;
};

// Save state to localStorage
const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = loadState();
    return saved || {
    currentTab: 'elf-select',
    selectedElfId: null,
    products: [],
    streamSettings: {
      roomLink: '',
      streamKey: '',
      isConnected: false
    }
    };
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const handleTabChange = (tab: TabView) => {
    setState(prev => ({ ...prev, currentTab: tab }));
  };

  const selectedElf = ELF_PERSONALITIES.find(e => e.id === state.selectedElfId) || null;

  // Check if we're in a floating window (via hash)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#prompter' || hash === '#elf') {
      // This is a floating window, don't render the normal layout
      return;
    }
  }, []);

  // Render content based on current tab or hash
  const renderContent = () => {
    // Check if we're in a floating window
    const hash = window.location.hash;
    
    if (hash === '#prompter') {
      // Floating prompter window
      // Get current product index from localStorage or default to 0
      const savedIndex = localStorage.getItem('currentProductIndex');
      const productIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
      return <FloatingPrompter products={state.products} currentProductIndex={productIndex} />;
    }
    
    if (hash === '#elf') {
      // Floating elf window
      const selectedElf = ELF_PERSONALITIES.find(e => e.id === state.selectedElfId);
      if (!selectedElf) {
        return (
          <div className="flex h-full items-center justify-center" style={{ backgroundColor: 'transparent' }}>
            <p className="text-slate-400">请先选择小精灵</p>
          </div>
        );
      }
      return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
          <FloatingElf elf={selectedElf} />
        </div>
      );
    }

    // Normal app flow
    switch (state.currentTab) {
      case 'elf-select':
        return (
          <ElfSelector 
            selectedId={state.selectedElfId} 
            onSelect={(id) => setState(prev => ({ ...prev, selectedElfId: id }))}
            onStart={() => handleTabChange('products')}
          />
        );
      
      case 'products':
        return (
          <ProductManager 
            products={state.products}
            setProducts={(newProducts) => {
               // Functional update for products inside state
               if (typeof newProducts === 'function') {
                 setState(prev => ({ ...prev, products: newProducts(prev.products) }));
               } else {
                 setState(prev => ({ ...prev, products: newProducts }));
               }
            }}
            selectedElf={selectedElf}
          />
        );

      case 'connect':
        return (
          <div className="p-6 max-w-2xl mx-auto mb-20 md:mb-0">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Settings className="text-purple-400" /> 
              Stream Connection
            </h1>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
              <div className="bg-blue-900/30 border border-blue-700/50 text-blue-300 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">💡 Demo Mode</p>
                <p>In a production app, this would connect to Twitch/YouTube API via OAuth. For this demo, you can proceed directly to the dashboard.</p>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Stream Room Link (Optional)</label>
                <input 
                  type="text" 
                  value={state.streamSettings.roomLink}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    streamSettings: { ...prev.streamSettings, roomLink: e.target.value }
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-purple-500" 
                  placeholder="https://twitch.tv/yourchannel or https://youtube.com/yourchannel" 
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Stream Key (Optional)</label>
                <input 
                  type="password" 
                  value={state.streamSettings.streamKey}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    streamSettings: { ...prev.streamSettings, streamKey: e.target.value }
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-purple-500" 
                  placeholder="••••••••••••" 
                />
                <p className="text-xs text-slate-500 mt-1">This is stored locally and never sent anywhere</p>
              </div>

              {!selectedElf && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded-lg text-sm">
                  ⚠️ Please select an Elf companion first from the Home tab
                </div>
              )}

              {state.products.length === 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded-lg text-sm">
                  ⚠️ Add at least one product with a generated script for the best experience
                </div>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      streamSettings: { ...prev.streamSettings, isConnected: true }
                    }));
                    handleTabChange('live-room');
                  }}
                  disabled={!selectedElf}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-green-900/20 transform hover:-translate-y-0.5 disabled:transform-none"
                >
                  <ExternalLink size={18} />
                  Go To Live Dashboard
                </button>
                {selectedElf && (
                  <p className="text-center text-sm text-slate-400">
                    Ready to go live with <span className="text-purple-400 font-semibold">{selectedElf.name}</span>!
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'live-room':
        if (!selectedElf) {
          return (
             <div className="flex h-full items-center justify-center flex-col gap-4">
               <p className="text-slate-400">You need to select an Elf first!</p>
               <button onClick={() => handleTabChange('elf-select')} className="text-purple-400 underline">Go to Home</button>
             </div>
          );
        }
        return <LiveDashboard elf={selectedElf} products={state.products} />;
        
      default:
        return <div>Not Found</div>;
    }
  };

  // Check if we're in a floating window
  const hash = window.location.hash;
  if (hash === '#prompter' || hash === '#elf') {
    // Render floating window without layout
    return <div className="w-full h-full">{renderContent()}</div>;
  }

  return (
    <Layout currentTab={state.currentTab} onTabChange={handleTabChange}>
      {renderContent()}
    </Layout>
  );
}