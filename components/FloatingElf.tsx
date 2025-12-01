import React from 'react';
import { X } from 'lucide-react';
import { ElfPersonality } from '../types';

interface FloatingElfProps {
  elf: ElfPersonality;
  message?: string;
  messageChinese?: string;
  isThinking?: boolean;
  isSpeaking?: boolean;
}

const FloatingElf: React.FC<FloatingElfProps> = ({ 
  elf: initialElf, 
  message: initialMessage = '', 
  messageChinese: initialMessageChinese = '', 
  isThinking: initialIsThinking = false, 
  isSpeaking: initialIsSpeaking = false 
}) => {
  const [elf] = React.useState(initialElf);
  const [message, setMessage] = React.useState(initialMessage);
  const [messageChinese, setMessageChinese] = React.useState(initialMessageChinese);
  const [isThinking, setIsThinking] = React.useState(initialIsThinking);
  const [isSpeaking, setIsSpeaking] = React.useState(initialIsSpeaking);

  // Listen for updates from main window
  React.useEffect(() => {
    if ((window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;
      const cleanup = electronAPI.onElfUpdate((data: any) => {
        if (data && typeof data === 'object') {
          if (data.message !== undefined) setMessage(data.message);
          if (data.messageChinese !== undefined) setMessageChinese(data.messageChinese);
          if (data.isThinking !== undefined) setIsThinking(data.isThinking);
          if (data.isSpeaking !== undefined) setIsSpeaking(data.isSpeaking);
        }
      });
      return cleanup; // Cleanup function to remove listener
    }
  }, []);

  let avatarAnimationClass = "animate-breathe";
  if (isThinking) avatarAnimationClass = "animate-sway";
  if (isSpeaking) avatarAnimationClass = "animate-talk";

  const handleClose = () => {
    if ((window as any).electronAPI?.closeElfWindow) {
      (window as any).electronAPI.closeElfWindow();
    } else {
      window.close();
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-end"
      style={{ backgroundColor: 'transparent', background: 'transparent', WebkitAppRegion: 'drag', WebkitUserSelect: 'none' }}
    >
      <div className="absolute top-2 right-2 z-20" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          title="关闭悬浮窗口"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <X size={14} />
        </button>
      </div>
      {/* Chat Bubble */}
      {(isSpeaking && message) || isThinking ? (
        <div className="absolute bottom-full mb-4 w-64 animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="bg-white/95 backdrop-blur text-slate-900 p-4 rounded-2xl rounded-br-none shadow-2xl text-sm font-bold border-2 border-white relative">
            {isThinking ? (
              <div className="flex gap-1 justify-center py-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
              </div>
            ) : message ? (
              <div className="space-y-2">
                <div className="text-slate-900">{message}</div>
                {messageChinese && (
                  <div className="text-xs text-slate-600 border-t border-slate-300 pt-2 mt-2">
                    {messageChinese}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Avatar */}
      <div className="relative w-full h-full flex items-end justify-center" style={{ backgroundColor: 'transparent', WebkitAppRegion: 'drag' }}>
        <img 
          src={elf.avatar} 
          alt="Digital Assistant" 
          className={`w-full h-full object-contain drop-shadow-2xl filter brightness-110 contrast-110 ${avatarAnimationClass}`} 
          style={{ transformOrigin: 'bottom center' }}
        />
        {isThinking && <div className="absolute top-10 right-10 text-4xl animate-bounce">🤔</div>}
        {isSpeaking && (
          <div className="absolute top-20 -right-2 bg-black/50 p-2 rounded-full backdrop-blur border border-white/20">
            <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingElf;

