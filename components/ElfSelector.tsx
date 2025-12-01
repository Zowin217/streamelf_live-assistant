import React from 'react';
import { ELF_PERSONALITIES } from '../constants';
import { ElfPersonality } from '../types';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface ElfSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
}

const ElfSelector: React.FC<ElfSelectorProps> = ({ selectedId, onSelect, onStart }) => {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
          Choose Your Digital Companion
        </h1>
        <p className="text-slate-400">Select an AI personality to co-host your stream.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {ELF_PERSONALITIES.map((elf) => (
          <div 
            key={elf.id}
            onClick={() => onSelect(elf.id)}
            className={`relative group cursor-pointer border rounded-3xl p-4 transition-all duration-300 flex flex-col items-center ${
              selectedId === elf.id 
                ? `border-${elf.themeColor.replace('bg-', '')} bg-slate-800 shadow-2xl shadow-purple-900/30 -translate-y-2` 
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800'
            }`}
          >
            {/* Selection Indicator */}
            {selectedId === elf.id && (
              <div className="absolute top-4 right-4 text-green-400 z-10">
                <CheckCircle2 size={24} fill="currentColor" className="text-green-900" />
              </div>
            )}

            {/* Avatar - Full Body Display */}
            <div className={`w-full h-48 mb-4 relative flex items-center justify-center`}>
              {/* Background Glow */}
              <div className={`absolute inset-0 opacity-20 blur-2xl rounded-full ${elf.themeColor} transition-opacity group-hover:opacity-40`}></div>
              
              <img 
                src={elf.avatar} 
                alt={elf.name} 
                className={`h-full w-auto object-contain drop-shadow-xl transition-transform duration-500 ${selectedId === elf.id ? 'scale-110 animate-breathe' : 'group-hover:scale-105'}`} 
              />
            </div>
            
            <div className="text-center w-full">
              <h3 className="text-xl font-bold text-white mb-2">
                {elf.name}
              </h3>
              <div className={`inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold text-white shadow-sm mb-3 ${elf.themeColor}`}>
                {elf.tagline}
              </div>
              <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                {elf.description}
              </p>
            </div>
            
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-8">
        <button 
          onClick={onStart}
          disabled={!selectedId}
          className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all shadow-xl transform ${
            selectedId 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white translate-y-0 opacity-100 hover:scale-105 active:scale-95' 
              : 'bg-slate-800 text-slate-500 cursor-not-allowed translate-y-2 opacity-50'
          }`}
        >
          <Sparkles size={20} />
          {selectedId ? "Enter Studio" : "Select a Companion"}
        </button>
      </div>
      
      {selectedId && (
        <div className="text-center text-sm text-slate-400 animate-in fade-in">
          Great choice! Click above to start managing your products.
        </div>
      )}
    </div>
  );
};

export default ElfSelector;