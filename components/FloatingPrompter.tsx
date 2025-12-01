import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Product } from '../types';

interface FloatingPrompterProps {
  products: Product[];
  currentProductIndex: number;
}

const chunkTextIntoSentences = (text: string): string[] => {
  const rawSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return rawSentences.map(s => s.trim()).filter(s => s.length > 0);
};

const FloatingPrompter: React.FC<FloatingPrompterProps> = ({ products, currentProductIndex }) => {
  const [scriptSentences, setScriptSentences] = useState<string[]>([]);
  const [sentenceWords, setSentenceWords] = useState<string[][]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [fontSize, setFontSize] = useState(20);
  const prompterRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  const activeProduct = products[currentProductIndex];

  // Listen for updates from main window
  useEffect(() => {
    console.log('[FloatingPrompter] Setting up IPC listener...');
    if ((window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;
      console.log('[FloatingPrompter] electronAPI available, setting up onPrompterUpdate listener');
      const cleanup = electronAPI.onPrompterUpdate((data: any) => {
        console.log('[FloatingPrompter] 📥 Received update from main window:', data);
        if (data && typeof data === 'object') {
          if (data.activeSentenceIndex !== undefined) {
            console.log('[FloatingPrompter] Updating activeSentenceIndex:', data.activeSentenceIndex);
            setActiveSentenceIndex(data.activeSentenceIndex);
          }
          if (data.activeWordIndex !== undefined) {
            console.log('[FloatingPrompter] Updating activeWordIndex:', data.activeWordIndex);
            setActiveWordIndex(data.activeWordIndex);
          }
          if (data.scriptSentences) {
            console.log('[FloatingPrompter] Updating scriptSentences:', data.scriptSentences.length, 'sentences');
            setScriptSentences(data.scriptSentences);
          }
          if (data.sentenceWords) {
            console.log('[FloatingPrompter] Updating sentenceWords:', data.sentenceWords.length, 'sentence word arrays');
            setSentenceWords(data.sentenceWords);
          }
        } else {
          console.warn('[FloatingPrompter] ⚠️ Received invalid update data:', data);
        }
      });
      console.log('[FloatingPrompter] ✅ IPC listener set up, cleanup function:', typeof cleanup);
      return cleanup; // Cleanup function to remove listener
    } else {
      console.error('[FloatingPrompter] ❌ electronAPI not available!');
    }
  }, []);

  // Fallback: Load from product if no updates received
  useEffect(() => {
    if (scriptSentences.length === 0 && activeProduct && activeProduct.generatedScript) {
      const { intro, features, objections, cta } = activeProduct.generatedScript;
      const fullFlow = `${intro} ${features} ${objections} ${cta}`;
      const sentences = chunkTextIntoSentences(fullFlow);
      setScriptSentences(sentences);
      setSentenceWords(sentences.map(sentence => sentence.match(/\S+/g) || []));
      setActiveSentenceIndex(0);
      setActiveWordIndex(0);
    } else if (scriptSentences.length === 0) {
      const fallback = ["No script generated. Please go to Products tab and generate one."];
      setScriptSentences(fallback);
      setSentenceWords(fallback.map(sentence => sentence.match(/\S+/g) || []));
      setActiveSentenceIndex(0);
      setActiveWordIndex(0);
    }
  }, [activeProduct, scriptSentences.length]);

  useEffect(() => {
    if (activeSentenceRef.current && prompterRef.current) {
      const container = prompterRef.current;
      const node = activeSentenceRef.current;
      const target = node.offsetTop - container.clientHeight * 0.5 + (node.offsetHeight || 0) * 0.5;
      container.scrollTo({
        top: target,
        behavior: 'smooth'
      });
    }
  }, [activeSentenceIndex, activeWordIndex]);

  const handleClose = () => {
    if ((window as any).electronAPI?.closePrompterWindow) {
      (window as any).electronAPI.closePrompterWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="w-full h-full bg-black/90 backdrop-blur-md text-white flex flex-col" style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}>
      <div
        className="bg-black/80 border-b border-white/10 p-2 flex items-center justify-between"
        style={{ WebkitAppRegion: 'drag', WebkitUserSelect: 'none' }}
      >
        <span className="text-xs text-slate-400">提示词窗口</span>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => setFontSize(Math.max(12, fontSize - 2))}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            -
          </button>
          <span className="text-xs w-12 text-center">{fontSize}px</span>
          <button
            onClick={() => setFontSize(Math.min(40, fontSize + 2))}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            +
          </button>
          <button
            onClick={handleClose}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title="关闭悬浮窗口"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div
        ref={prompterRef}
        className="flex-1 overflow-y-auto p-4 scroll-smooth"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {scriptSentences.map((sentence, index) => {
          const isActive = index === activeSentenceIndex;
          const words = sentenceWords[index] || sentence.match(/\S+/g) || [];
          
          const containerClasses = isActive
            ? 'opacity-100 bg-black/25 box-decoration-clone px-3 py-2 rounded-xl shadow-sm border border-white/5'
            : 'opacity-70 text-slate-400';
          
          return (
            <div
              key={index}
              ref={isActive ? activeSentenceRef : null}
              className={`mb-0 leading-relaxed cursor-pointer transition-all duration-500 ease-out ${containerClasses}`}
              style={{ fontSize: `${fontSize}px` }}
            >
              {words.map((word, wordIndex) => {
                const isRead = isActive ? wordIndex < activeWordIndex : false;
                const isCurrent = isActive && wordIndex === activeWordIndex;
                
                let wordClasses = 'inline-block px-1 rounded select-none relative';
                let wordStyle: React.CSSProperties = {
                  position: 'relative',
                  display: 'inline-block',
                };
                
                if (!isActive) {
                  wordClasses += ' text-slate-200/60';
                } else if (isRead) {
                  // Fully read words: solid green with glow
                  wordClasses += ' text-green-300';
                  wordStyle.textShadow = '0 0 6px rgba(74, 222, 128, 0.6)';
                  wordStyle.transition = 'all 0.2s ease-out';
                } else if (isCurrent) {
                  // Current word: smooth fill animation (K歌 style)
                  wordClasses += ' text-white/40';
                  wordStyle.transition = 'all 0.2s ease-out';
                } else {
                  // Unread words: transparent white
                  wordClasses += ' text-white/40';
                  wordStyle.transition = 'all 0.2s ease-out';
                }
                
                return (
                  <span
                    key={`${word}-${wordIndex}`}
                    ref={isCurrent ? activeWordRef : null}
                    className={wordClasses}
                    style={{ ...wordStyle, WebkitAppRegion: 'no-drag' }}
                  >
                    {isCurrent && (
                      <span
                        className="absolute left-0 top-0 w-full h-full text-green-300 overflow-hidden"
                        style={{
                          clipPath: `inset(0 ${100 - 50}% 0 0)`, // 50% filled
                          animation: 'fillWord 0.3s linear forwards',
                          textShadow: '0 0 6px rgba(74, 222, 128, 0.6)',
                          transition: 'all 0.2s ease-out',
                          width: '100%',
                          height: '100%',
                          WebkitAppRegion: 'no-drag',
                        }}
                      >
                        {word}
                      </span>
                    )}
                    <span
                      className="relative"
                      style={isCurrent ? { color: 'transparent', WebkitAppRegion: 'no-drag' } : { WebkitAppRegion: 'no-drag' }}
                    >
                      {word}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingPrompter;

