import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ElfPersonality, Product, ViewerComment } from '../types';
import { MOCK_COMMENTS } from '../constants';
import { generateElfReply, generateTopicSentence } from '../services/deepseekService';
import { initializeLiveTalking, getLiveTalkingService, LiveTalkingConfig } from '../services/livetalkingService';
import { transcribeWithFasterWhisper, checkFasterWhisperHealth, FasterWhisperConfig } from '../services/fasterWhisperService';
import { translateToChinese } from '../services/translationService';
// Removed Whisper - using Web Speech API and faster-whisper instead
import { MessageCircle, Play, Pause, ChevronUp, ChevronDown, ShoppingBag, Eye, Mic, Activity, AlignLeft, Type, Minimize2, Maximize2, MoveVertical, RotateCcw, SkipForward, SkipBack, Send, X, Maximize } from 'lucide-react';

// Add type support for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface LiveDashboardProps {
  elf: ElfPersonality;
  products: Product[];
}

// Helper to chunk text into sentences
const chunkTextIntoSentences = (text: string): string[] => {
  if (!text) return [];
  // Split by common sentence delimiters, keeping the delimiter
  const rawSentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return rawSentences.map(s => s.trim()).filter(s => s.length > 0);
};

const LiveDashboard: React.FC<LiveDashboardProps> = ({ elf, products }) => {
  const detectElectronEnv = () => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).electronAPI;
  };
  const isElectronEnv = detectElectronEnv();
  // --- State ---
  const [comments, setComments] = useState<ViewerComment[]>([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(() => {
    const saved = localStorage.getItem('currentProductIndex');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // Save current product index to localStorage
  useEffect(() => {
    localStorage.setItem('currentProductIndex', currentProductIndex.toString());
  }, [currentProductIndex]);
  
  // Teleprompter Settings
  const [isPrompterActive, setIsPrompterActive] = useState(false);
  const [prompterMode, setPrompterMode] = useState<'voice' | 'interactive'>('voice');
  const [prompterScrollMode, setPrompterScrollMode] = useState<'voice' | 'timer'>('voice'); // For voice mode: voice sync or timer auto-scroll
  const [prompterSpeed, setPrompterSpeed] = useState(1); // For timer mode
  const [fontSize, setFontSize] = useState(20); // default px
  
  // Interactive Mode State
  const [isListening, setIsListening] = useState(false);
  const [lastUserSpeech, setLastUserSpeech] = useState<string>('');
  const [currentTranscript, setCurrentTranscript] = useState<string>(''); // Real-time transcript display
  const [voiceErrorMessage, setVoiceErrorMessage] = useState<string | null>(null);
  const [useFasterWhisper, setUseFasterWhisper] = useState(() => detectElectronEnv()); // Default to faster-whisper inside Electron
  const [fasterWhisperAvailable, setFasterWhisperAvailable] = useState(false);
  const mediaRecorderForWhisper = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  
  // Elf State
  const [elfMessage, setElfMessage] = useState(""); // Empty by default - only show after user speaks
  const [elfMessageChinese, setElfMessageChinese] = useState(""); // Chinese translation of elf message
  const [isElfThinking, setIsElfThinking] = useState(false);
  const [isElfSpeaking, setIsElfSpeaking] = useState(false);
  
  // Topic sentences for interactive mode
  const [topicSentences, setTopicSentences] = useState<string[]>([]);
  
  // Draggable positions
  const [prompterPosition, setPrompterPosition] = useState({ x: 0, y: 0 });
  const [elfPosition, setElfPosition] = useState({ x: 0, y: 0 });
  const [isDraggingPrompter, setIsDraggingPrompter] = useState(false);
  const [isDraggingElf, setIsDraggingElf] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const prompterElementRef = useRef<HTMLDivElement>(null);
  const elfElementRef = useRef<HTMLDivElement>(null);
  
  // Script State
  const [scriptSentences, setScriptSentences] = useState<string[]>([]);
  const [sentenceWords, setSentenceWords] = useState<string[][]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  
  // Keep refs in sync with state
  useEffect(() => {
    activeSentenceIndexRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  // Automatically enable Faster-Whisper when running inside Electron
  useEffect(() => {
    if (detectElectronEnv()) {
      setUseFasterWhisper(true);
    }
  }, []);
  
  useEffect(() => {
    activeWordIndexRef.current = activeWordIndex;
  }, [activeWordIndex]);
  
  useEffect(() => {
    sentenceWordsRef.current = sentenceWords;
  }, [sentenceWords]);
  
  useEffect(() => {
    scriptSentencesRef.current = scriptSentences;
  }, [scriptSentences]);
  
  useEffect(() => {
    prompterModeRef.current = prompterMode;
    console.log(`[Mode] 🔄 Mode changed to: ${prompterMode}`);
  }, [prompterMode]);
  
  useEffect(() => {
    isElfSpeakingRef.current = isElfSpeaking;
  }, [isElfSpeaking]);
  
  useEffect(() => {
    isPrompterActiveRef.current = isPrompterActive;
  }, [isPrompterActive]);
  
  // Refs
  const prompterRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const wordTimerRef = useRef<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const speakingTimeoutRef = useRef<number | null>(null);
  // Reuse mediaRecorderRef for Web Speech API recognition object
  const mediaRecorderRef = useRef<any>(null);
  // Track last match time to prevent stalling
  const lastMatchTimeRef = useRef<number>(Date.now());
  const stallTimeoutRef = useRef<number | null>(null);
  // LiveTalking video element ref
  const liveTalkingVideoRef = useRef<HTMLVideoElement>(null);
  const liveTalkingServiceRef = useRef<any>(null);
  const [useLiveTalking, setUseLiveTalking] = useState(false); // Toggle between LiveTalking and TTS
  const [liveTalkingConnected, setLiveTalkingConnected] = useState(false);
  // Refs to access latest state without causing re-renders
  const activeSentenceIndexRef = useRef(activeSentenceIndex);
  const activeWordIndexRef = useRef(activeWordIndex);
  const sentenceWordsRef = useRef(sentenceWords);
  const scriptSentencesRef = useRef(scriptSentences);
  // Ref to track current mode for use in event handlers (to avoid stale closures)
  const prompterModeRef = useRef(prompterMode);
  const isElfSpeakingRef = useRef(isElfSpeaking);
  const isPrompterActiveRef = useRef(isPrompterActive);
  // Refs for recognition restart control
  const restartTimeoutRef = useRef<number | null>(null);
  const restartCountRef = useRef<number>(0);
  const isRestartingRef = useRef<boolean>(false);
  const lastRestartTimeRef = useRef<number>(0);
  // Ref for tracking last sentence jump to prevent frequent jumping
  const lastSentenceJumpRef = useRef<number>(0);
  const lastJumpSentenceIndexRef = useRef<number>(-1);
  // Track last speech time to detect when user has finished speaking (for interactive mode)
  const lastSpeechTimeRef = useRef<number>(0);
  const speechTimeoutRef = useRef<number | null>(null);

  const activeProduct = products[currentProductIndex];

  const goToSentence = (index: number, wordIndex = 0) => {
    if (scriptSentences.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, scriptSentences.length - 1));
    const words = sentenceWords[safeIndex] || [];
    const safeWordIndex = Math.max(0, Math.min(wordIndex, Math.max(words.length - 1, 0)));
    console.log(`[Navigation] goToSentence called: sentence ${safeIndex}, word ${safeWordIndex}`);
    setActiveSentenceIndex(safeIndex);
    setActiveWordIndex(safeWordIndex);
    // Force scroll after state update
    setTimeout(() => {
      const node = activeWordRef.current || activeSentenceRef.current;
      if (node && prompterRef.current) {
        const container = prompterRef.current;
        // Center the active sentence in the middle of the container
        const target = node.offsetTop - container.clientHeight * 0.5 + (node.offsetHeight || 0) * 0.5;
        console.log(`[Navigation] Forcing scroll to: ${target}`);
        smoothScrollToTarget(Math.max(0, target));
      }
    }, 50);
  };

  const cleanupRecording = (stopStream = false) => {
    // Cleanup Web Speech API recognition
    if (mediaRecorderRef.current) {
      const recognition = mediaRecorderRef.current as any;
      if (recognition && recognition.stop) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      mediaRecorderRef.current = null;
    }
  };

  const goToNextSentence = () => {
    setActiveSentenceIndex(prev => {
      if (prev < scriptSentences.length - 1) {
        setActiveWordIndex(0);
        return prev + 1;
      }
      setIsPrompterActive(false);
      return prev;
    });
  };

  const goToPreviousSentence = () => {
    setActiveSentenceIndex(prev => {
      if (prev > 0) {
        setActiveWordIndex(0);
        return prev - 1;
      }
      return prev;
    });
  };

  const smoothScrollToTarget = (target: number) => {
    if (!prompterRef.current) return;
    const container = prompterRef.current;
    const start = container.scrollTop;
    const distance = target - start;
    const duration = 400;
    let startTime: number | null = null;

    if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);

    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      container.scrollTop = start + distance * easeInOutQuad(progress);
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    scrollAnimationRef.current = requestAnimationFrame(animate);
  };

  // Auto-start voice/interactive mode listening when appropriate
  useEffect(() => {
    if ((prompterMode === 'voice' && prompterScrollMode === 'voice' && scriptSentences.length > 0) || prompterMode === 'interactive') {
      setIsPrompterActive(true);
    } else if (prompterMode === 'voice' && prompterScrollMode === 'timer') {
      setIsPrompterActive(true);
    }
  }, [prompterMode, prompterScrollMode, scriptSentences.length]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space bar to toggle teleprompter
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsPrompterActive(prev => !prev);
      }
      // Arrow keys for navigation (when not in input)
      if (e.target === document.body || (e.target as HTMLElement).tagName !== 'INPUT') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPreviousSentence();
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextSentence();
        }
        // Home key to reset
        if (e.key === 'Home') {
          e.preventDefault();
          goToSentence(0, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeSentenceIndex, scriptSentences.length]);

  // Load saved positions from localStorage
  useEffect(() => {
    const savedPrompterPos = localStorage.getItem('prompterPosition');
    const savedElfPos = localStorage.getItem('elfPosition');
    if (savedPrompterPos) {
      try {
        setPrompterPosition(JSON.parse(savedPrompterPos));
      } catch (e) {
        console.warn('Failed to load prompter position:', e);
      }
    }
    if (savedElfPos) {
      try {
        setElfPosition(JSON.parse(savedElfPos));
      } catch (e) {
        console.warn('Failed to load elf position:', e);
      }
    }
  }, []);

  // Save positions to localStorage
  useEffect(() => {
    localStorage.setItem('prompterPosition', JSON.stringify(prompterPosition));
  }, [prompterPosition]);

  useEffect(() => {
    localStorage.setItem('elfPosition', JSON.stringify(elfPosition));
  }, [elfPosition]);

  // Handle dragging for prompter
  const handlePrompterMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select')) {
      return; // Don't drag if clicking on interactive elements
    }
    setIsDraggingPrompter(true);
    dragStartPos.current = {
      x: e.clientX - prompterPosition.x,
      y: e.clientY - prompterPosition.y
    };
  };

  const handleElfMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('button, input, textarea, select')) {
      return; // Don't drag if clicking on interactive elements
    }
    setIsDraggingElf(true);
    dragStartPos.current = {
      x: e.clientX - elfPosition.x,
      y: e.clientY - elfPosition.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPrompter) {
        setPrompterPosition({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y
        });
      }
      if (isDraggingElf) {
        setElfPosition({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPrompter(false);
      setIsDraggingElf(false);
    };

    if (isDraggingPrompter || isDraggingElf) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingPrompter, isDraggingElf]);

  // --- 1. Prepare Script ---
  useEffect(() => {
    if (activeProduct && activeProduct.generatedScript) {
      const { intro, features, objections, cta } = activeProduct.generatedScript;
      const fullFlow = `${intro} ${features} ${objections} ${cta}`;
      const sentences = chunkTextIntoSentences(fullFlow);
      setScriptSentences(sentences);
      setSentenceWords(sentences.map(sentence => sentence.match(/\S+/g) || []));
      setActiveSentenceIndex(0);
      setActiveWordIndex(0);
      setIsPrompterActive(false);
    } else {
      const fallback = ["No script generated. Please go to Products tab and generate one."];
      setScriptSentences(fallback);
      setSentenceWords(fallback.map(sentence => sentence.match(/\S+/g) || []));
      setActiveSentenceIndex(0);
      setActiveWordIndex(0);
    }
    
    // Generate initial topic sentences (not from script, but new ones)
    if (activeProduct) {
      generateInitialTopicSentences(activeProduct).catch((error) => {
        console.error('[Interactive] Failed to generate topic sentences:', error);
        // Fallback to simple topics if generation fails
        const fallbacks = [
          `Tell me about ${activeProduct.name}`,
          `What are the features of ${activeProduct.name}?`,
          `Why should I buy ${activeProduct.name}?`,
          `What makes ${activeProduct.name} special?`,
          `How does ${activeProduct.name} work?`
        ];
        setTopicSentences(fallbacks);
      });
    } else {
      setTopicSentences([]);
    }
  }, [activeProduct, elf]);
  
  // Generate initial topic sentences (5 sentences)
  const generateInitialTopicSentences = async (product: Product) => {
    console.log('[Interactive] 🎯 Generating topic sentences for product:', product.name);
    const initialSentences: string[] = [];
    // Generate 5 topic sentences one by one
    for (let i = 0; i < 5; i++) {
      try {
        const sentence = await generateTopicSentence(product, elf, initialSentences);
        if (sentence) {
          initialSentences.push(sentence);
          console.log(`[Interactive] ✅ Generated topic sentence ${i + 1}/5:`, sentence);
        } else {
          // Fallback if generation fails
          const fallbacks = [
            `Tell me about ${product.name}`,
            `What are the features of ${product.name}?`,
            `Why should I buy ${product.name}?`,
            `What makes ${product.name} special?`,
            `How does ${product.name} work?`
          ];
          if (i < fallbacks.length) {
            initialSentences.push(fallbacks[i]);
            console.log(`[Interactive] ⚠️ Using fallback topic sentence ${i + 1}/5:`, fallbacks[i]);
          }
        }
      } catch (error) {
        console.error(`[Interactive] ❌ Error generating topic sentence ${i + 1}:`, error);
        // Use fallback
        const fallbacks = [
          `Tell me about ${product.name}`,
          `What are the features of ${product.name}?`,
          `Why should I buy ${product.name}?`,
          `What makes ${product.name} special?`,
          `How does ${product.name} work?`
        ];
        if (i < fallbacks.length) {
          initialSentences.push(fallbacks[i]);
        }
      }
    }
    console.log('[Interactive] ✅ Finished generating topic sentences, total:', initialSentences.length);
    setTopicSentences(initialSentences);
  };
  
  // Generate a new topic sentence to replace a removed one
  const generateNewTopicSentence = async () => {
    if (!activeProduct) return;
    
    const newSentence = await generateTopicSentence(activeProduct, elf, topicSentences);
    if (newSentence) {
      setTopicSentences(prev => [...prev, newSentence]);
    } else {
      // Fallback
      const fallback = `Tell me more about ${activeProduct.name}`;
      setTopicSentences(prev => [...prev, fallback]);
    }
  };
  
  // Remove a topic sentence and generate a new one
  const removeTopicSentence = async (index: number) => {
    setTopicSentences(prev => prev.filter((_, i) => i !== index));
    // Generate a new one to replace it
    await generateNewTopicSentence();
  };

  // Check faster-whisper service availability
  useEffect(() => {
    if (prompterMode === 'interactive') {
      checkFasterWhisperHealth().then((available) => {
        setFasterWhisperAvailable(available);
        console.log(`[Faster-Whisper] Service available: ${available}`);
      }).catch((error) => {
        // Silently handle connection errors - service might not be running
        console.log('[Faster-Whisper] Service not available (this is OK if you\'re not using it)');
        setFasterWhisperAvailable(false);
      });
      
      // Ensure topic sentences are generated when switching to interactive mode
      if (activeProduct && topicSentences.length === 0) {
        console.log('[Interactive] 🔄 No topic sentences found, generating...');
        generateInitialTopicSentences(activeProduct).catch((error) => {
          console.error('[Interactive] Failed to generate topic sentences:', error);
          // Fallback to simple topics if generation fails
          const fallbacks = [
            `Tell me about ${activeProduct.name}`,
            `What are the features of ${activeProduct.name}?`,
            `Why should I buy ${activeProduct.name}?`,
            `What makes ${activeProduct.name} special?`,
            `How does ${activeProduct.name} work?`
          ];
          setTopicSentences(fallbacks);
        });
      }
    }
  }, [prompterMode, activeProduct]);

  useEffect(() => {
    if (useFasterWhisper && !fasterWhisperAvailable) {
      setVoiceErrorMessage('Faster-Whisper 服务未运行。请在终端执行 npm run server:faster-whisper 后再启用。');
    } else if (useFasterWhisper && fasterWhisperAvailable) {
      setVoiceErrorMessage(null);
    }
  }, [useFasterWhisper, fasterWhisperAvailable]);

  // Faster-Whisper for real-time voice recognition (alternative to Web Speech API)
  useEffect(() => {
    // Only use faster-whisper in interactive mode when enabled
    if (!isPrompterActive || prompterMode !== 'interactive' || !useFasterWhisper || !fasterWhisperAvailable) {
      // Cleanup
      if (mediaRecorderForWhisper.current) {
        mediaRecorderForWhisper.current.stop();
        mediaRecorderForWhisper.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      audioChunksRef.current = [];
      setIsListening(false);
      return;
    }

    console.log('[Faster-Whisper] Starting audio recording...');
    
    // Request microphone permission and start recording
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        console.log('[Faster-Whisper] Microphone access granted');
        setIsListening(true);
        
        // Create MediaRecorder
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        mediaRecorderForWhisper.current = recorder;
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        recorder.onstop = async () => {
          console.log('[Faster-Whisper] Recording stopped, processing audio...');
          
          // Skip processing if elf is speaking (to avoid feedback loop)
          if (isElfSpeakingRef.current) {
            console.log('[Faster-Whisper] ⏸️ Skipping transcription - elf is speaking');
            audioChunksRef.current = [];
            return;
          }
          
          // Combine all chunks into a single blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          audioChunksRef.current = [];
          
          if (audioBlob.size > 0) {
            // Transcribe with faster-whisper (use base model for better accuracy)
            const transcript = await transcribeWithFasterWhisper(audioBlob, {
              model: 'base', // Use base model for better accuracy (balance between speed and accuracy)
              device: 'cpu',
              computeType: 'int8',
              language: 'en',
            });
            
            // Double-check paused state and elf is not speaking before processing transcript
            if (transcript && transcript.trim() && !isElfSpeakingRef.current && isPrompterActiveRef.current) {
              console.log(`[Faster-Whisper] Transcript: "${transcript}"`);
              setCurrentTranscript(transcript);
              handleInteractiveSpeech(transcript);
            } else if (!isPrompterActiveRef.current) {
              console.log('[Faster-Whisper] ⏸️ Discarding transcript - paused');
            } else if (isElfSpeakingRef.current) {
              console.log('[Faster-Whisper] ⏸️ Discarding transcript - elf started speaking during processing');
            }
          }
        };
        
        // Start recording in chunks (every 2 seconds for near real-time)
        recorder.start();
        console.log('[Faster-Whisper] Recording started');
        
        // Record in chunks for near real-time transcription (0.5 second for fastest response on CPU)
        recordingIntervalRef.current = window.setInterval(() => {
          // Skip if elf is speaking
          if (isElfSpeakingRef.current) {
            console.log('[Faster-Whisper] ⏸️ Pausing recording - elf is speaking');
            if (recorder.state === 'recording') {
              recorder.stop();
            }
            return;
          }
          
          if (recorder.state === 'recording') {
            recorder.stop();
            // Start new recording immediately (only if elf is not speaking)
            setTimeout(() => {
              if (mediaRecorderForWhisper.current && isPrompterActive && prompterMode === 'interactive' && useFasterWhisper && !isElfSpeakingRef.current) {
                audioChunksRef.current = [];
                mediaRecorderForWhisper.current.start();
              }
            }, 20); // Minimal delay for fastest restart
          }
        }, 500); // Reduced to 0.5 second chunks for fastest response on CPU
        
      })
      .catch((error) => {
        console.error('[Faster-Whisper] Microphone access denied:', error);
        alert('无法访问麦克风。请允许浏览器访问麦克风权限。');
        setUseFasterWhisper(false);
      });
    
    return () => {
      // Cleanup
      if (mediaRecorderForWhisper.current) {
        mediaRecorderForWhisper.current.stop();
        mediaRecorderForWhisper.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      audioChunksRef.current = [];
    };
  }, [isPrompterActive, prompterMode, useFasterWhisper, fasterWhisperAvailable]);

  // Initialize LiveTalking when enabled
  useEffect(() => {
    if (useLiveTalking && liveTalkingVideoRef.current && !liveTalkingServiceRef.current) {
      const initLiveTalking = async () => {
        try {
          const config: LiveTalkingConfig = {
            serverUrl: ((import.meta as any).env?.VITE_LIVETALKING_URL as string) || 'http://localhost:8010',
            model: 'wav2lip',
            avatarId: 'wav2lip256_avatar1',
            transport: 'webrtc',
          };
          
          const service = initializeLiveTalking(config);
          liveTalkingServiceRef.current = service;
          
          await service.initializeWebRTC(liveTalkingVideoRef.current!);
          setLiveTalkingConnected(true);
          console.log('[LiveTalking] ✅ Connected successfully');
        } catch (error) {
          console.error('[LiveTalking] ❌ Failed to initialize:', error);
          setLiveTalkingConnected(false);
        }
      };
      
      initLiveTalking();
    } else if (!useLiveTalking && liveTalkingServiceRef.current) {
      // Disconnect when disabled
      liveTalkingServiceRef.current.disconnect();
      liveTalkingServiceRef.current = null;
      setLiveTalkingConnected(false);
    }
    
    return () => {
      if (liveTalkingServiceRef.current) {
        liveTalkingServiceRef.current.disconnect();
      }
    };
  }, [useLiveTalking]);

  // --- 2. Scroll to Center Logic ---
  useEffect(() => {
    console.log(`[Scroll] State changed - activeWordIndex: ${activeWordIndex}, activeSentenceIndex: ${activeSentenceIndex}`);
    // Use multiple requestAnimationFrame to ensure DOM has fully updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = activeWordRef.current || activeSentenceRef.current;
        if (!node) {
          console.warn(`[Scroll] No node found. activeWordRef: ${!!activeWordRef.current}, activeSentenceRef: ${!!activeSentenceRef.current}`);
          // Try again after a short delay
          setTimeout(() => {
            const retryNode = activeWordRef.current || activeSentenceRef.current;
            if (retryNode && prompterRef.current) {
              const container = prompterRef.current;
              // Center the active sentence in the middle of the container
              const target = retryNode.offsetTop - container.clientHeight * 0.5 + (retryNode.offsetHeight || 0) * 0.5;
              console.log(`[Scroll] Retry scroll to: ${target}`);
              smoothScrollToTarget(Math.max(0, target));
            }
          }, 100);
          return;
        }
        if (!prompterRef.current) {
          console.warn(`[Scroll] No prompterRef found`);
          return;
        }
        const container = prompterRef.current;
        // Center the active sentence in the middle of the container (50% instead of 35%)
        const target = node.offsetTop - container.clientHeight * 0.5 + (node.offsetHeight || 0) * 0.5;
        const currentScroll = container.scrollTop;
        console.log(`[Scroll] Scrolling to target: ${target}, current scroll: ${currentScroll}, node offsetTop: ${node.offsetTop}, container height: ${container.clientHeight}`);
        if (Math.abs(currentScroll - target) > 5) {
          smoothScrollToTarget(Math.max(0, target));
        } else {
          console.log(`[Scroll] Already at target, skipping scroll`);
        }
      });
    });
  }, [activeSentenceIndex, activeWordIndex]);

  // --- 3. Timer-Based Word Highlighting ---
  useEffect(() => {
    if (!(isPrompterActive && prompterMode === 'voice' && prompterScrollMode === 'timer')) {
      if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
        return;
      }

    const words = sentenceWords[activeSentenceIndex] || [];
    if (words.length === 0) {
      goToNextSentence();
      return;
    }

    const baseWordsPerMinute = 180;
    const durationPerWord = Math.max(200, (60_000 / (baseWordsPerMinute * prompterSpeed)));

    wordTimerRef.current = window.setTimeout(() => {
      setActiveWordIndex(prev => {
        if (prev + 1 >= words.length) {
          goToNextSentence();
          return words.length;
        }
        return prev + 1;
      });
    }, durationPerWord);

    return () => {
      if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
    };
  }, [isPrompterActive, prompterMode, activeSentenceIndex, sentenceWords, activeWordIndex, prompterSpeed]);

  // Send updates to floating prompter window
  useEffect(() => {
    if ((window as any).electronAPI && (window as any).electronAPI.updatePrompter) {
      const updateData = {
        activeSentenceIndex,
        activeWordIndex,
        scriptSentences,
        sentenceWords // Also send word breakdown for proper highlighting
      };
      console.log('[LiveDashboard] 📤 Sending prompter update to floating window:', {
        activeSentenceIndex,
        activeWordIndex,
        sentencesCount: scriptSentences.length,
        wordsCount: sentenceWords.length
      });
      (window as any).electronAPI.updatePrompter(updateData);
    } else {
      console.warn('[LiveDashboard] ⚠️ electronAPI not available, cannot update floating window');
    }
  }, [activeSentenceIndex, activeWordIndex, scriptSentences, sentenceWords]);

  // Send updates to floating elf window
  useEffect(() => {
    if ((window as any).electronAPI && (window as any).electronAPI.updateElf) {
      (window as any).electronAPI.updateElf({
        message: elfMessage,
        messageChinese: elfMessageChinese,
        isThinking: isElfThinking,
        isSpeaking: isElfSpeaking
      });
    }
  }, [elfMessage, elfMessageChinese, isElfThinking, isElfSpeaking]);

  // Fuzzy matching helper function - calculates similarity between two words
  // Enhanced to handle speech recognition inaccuracies better
  const calculateWordSimilarity = (word1: string, word2: string): number => {
    const w1 = word1.toLowerCase().trim();
    const w2 = word2.toLowerCase().trim();
    
    // Exact match
    if (w1 === w2) return 1.0;
    
    // Remove common suffixes/endings that might differ in speech recognition
    const w1Stem = w1.replace(/(ing|ed|er|est|ly|s|es)$/, '');
    const w2Stem = w2.replace(/(ing|ed|er|est|ly|s|es)$/, '');
    if (w1Stem === w2Stem && w1Stem.length > 2) {
      return 0.85; // High similarity for stem matches
    }
    
    // One word contains the other (for compound words or partial matches)
    if (w1.includes(w2) || w2.includes(w1)) {
      const minLen = Math.min(w1.length, w2.length);
      const maxLen = Math.max(w1.length, w2.length);
      const overlapRatio = minLen / maxLen;
      // Boost similarity if overlap is significant
      return Math.min(0.9, overlapRatio + 0.2);
    }
    
    // Check prefix similarity (first 2-4 characters) - important for speech recognition
    const prefixLen = Math.min(4, Math.min(w1.length, w2.length));
    if (prefixLen >= 2) {
      const prefix1 = w1.substring(0, prefixLen);
      const prefix2 = w2.substring(0, prefixLen);
      if (prefix1 === prefix2) {
        // If prefix matches, give high similarity even if rest differs
        return Math.max(0.65, 0.5 + (prefixLen / Math.max(w1.length, w2.length)) * 0.3);
      }
    }
    
    // Calculate Levenshtein distance (edit distance)
    const maxLen = Math.max(w1.length, w2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = levenshteinDistance(w1, w2);
    let similarity = 1 - (distance / maxLen);
    
    // Boost similarity for shorter words (common words are often misrecognized)
    if (maxLen <= 4 && distance <= 1) {
      similarity = Math.max(similarity, 0.6);
    }
    
    // Check if words sound similar (simple phonetic check)
    // Common misrecognitions: 'a' vs 'the', 'is' vs 'it', etc.
    const soundAlike: Record<string, string[]> = {
      'a': ['the', 'an'],
      'is': ['it', 'its'],
      'the': ['a', 'an'],
      'and': ['an', 'in'],
      'in': ['an', 'and'],
      'to': ['two', 'too'],
      'for': ['four', 'from'],
    };
    
    if (soundAlike[w1]?.includes(w2) || soundAlike[w2]?.includes(w1)) {
      return 0.7; // High similarity for sound-alike words
    }
    
    return similarity;
  };

  // Levenshtein distance calculation for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  };

  // Helper function to calculate sentence similarity
  const calculateSentenceSimilarity = (sentence1: string, sentence2: string): number => {
    const words1 = sentence1.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    const words2 = sentence2.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Calculate how many words from sentence1 appear in sentence2 (with fuzzy matching)
    let matchedWords = 0;
    let totalSimilarity = 0;
    
    for (const word1 of words1) {
      let bestSimilarity = 0;
      for (const word2 of words2) {
        const similarity = calculateWordSimilarity(word1, word2);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
        }
      }
      if (bestSimilarity >= 0.3) { // Threshold for word match
        matchedWords++;
        totalSimilarity += bestSimilarity;
      }
    }
    
    // Return average similarity weighted by match count
    if (matchedWords === 0) return 0;
    return (totalSimilarity / words1.length) * (matchedWords / words1.length);
  };

  // Search for matching sentence across entire script (for jump reading)
  const findMatchingSentence = (transcript: string, currentSentenceIdx: number): number | null => {
    const transcriptLower = transcript.toLowerCase().trim();
    const transcriptWords = transcriptLower.replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    
    // Require at least 4 words for more accurate matching
    if (transcriptWords.length < 4) return null;
    
    const sentences = scriptSentencesRef.current;
    const sentenceWords = sentenceWordsRef.current;
    
    let bestMatchIndex: number | null = null;
    let bestSimilarity = 0;
    const MIN_SIMILARITY = 0.55; // Increased threshold for more accurate matching
    
    // Search all sentences, but prioritize sentences after current one
    for (let i = 0; i < sentences.length; i++) {
      // Skip current sentence and adjacent sentences (to avoid jumping too close)
      if (i === currentSentenceIdx || Math.abs(i - currentSentenceIdx) <= 1) continue;
      
      const sentence = sentences[i];
      const sentenceWordsList = sentenceWords[i] || [];
      
      if (sentenceWordsList.length === 0) continue;
      
      // Calculate similarity
      const similarity = calculateSentenceSimilarity(transcript, sentence);
      
      // Check if transcript words appear in sentence (sequential matching with strict order)
      let sequentialMatchCount = 0;
      let transcriptIdx = 0;
      let sentenceIdx = 0;
      let consecutiveMatches = 0;
      let maxConsecutiveMatches = 0;
      
      while (transcriptIdx < transcriptWords.length && sentenceIdx < sentenceWordsList.length) {
        const transcriptWord = transcriptWords[transcriptIdx];
        const sentenceWord = sentenceWordsList[sentenceIdx].toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, '');
        
        const wordSimilarity = calculateWordSimilarity(transcriptWord, sentenceWord);
        if (wordSimilarity >= 0.5) { // Stricter threshold for sequential matching
          sequentialMatchCount++;
          consecutiveMatches++;
          maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
          transcriptIdx++;
          sentenceIdx++;
    } else {
          consecutiveMatches = 0;
          sentenceIdx++;
        }
      }
      
      // Require at least 3 consecutive matches for confidence
      if (maxConsecutiveMatches < 3) continue;
      
      // Combine similarity scores with emphasis on sequential matching
      const sequentialScore = sequentialMatchCount / Math.max(transcriptWords.length, sentenceWordsList.length);
      const consecutiveBonus = maxConsecutiveMatches >= 4 ? 0.15 : 0; // Bonus for long consecutive matches
      const combinedScore = (similarity * 0.5) + (sequentialScore * 0.5) + consecutiveBonus;
      
      // Prefer sentences after current position (for forward reading)
      const positionBonus = i > currentSentenceIdx ? 0.05 : -0.15; // Reduced bonus to avoid bias
      const finalScore = combinedScore + positionBonus;
      
      if (finalScore > bestSimilarity && finalScore >= MIN_SIMILARITY) {
        bestSimilarity = finalScore;
        bestMatchIndex = i;
      }
    }
    
    if (bestMatchIndex !== null) {
      console.log(`[Voice] 🎯 Found matching sentence at index ${bestMatchIndex} (similarity: ${bestSimilarity.toFixed(2)}): "${sentences[bestMatchIndex]}"`);
    }
    
    return bestMatchIndex;
  };

  const handleTranscriptionResult = (transcript: string) => {
    if (!transcript || !transcript.trim()) {
      console.log('[Voice] Empty transcript received');
      return;
    }
    
    // Use ref to get latest mode value (to avoid stale closures)
    const currentMode = prompterModeRef.current;
    console.log(`[Voice] handleTranscriptionResult called with: "${transcript}"`);
    console.log(`[Voice] Mode from ref: ${currentMode}, from state: ${prompterMode}`);
    
    // In interactive mode, update transcript display and handle speech
    if (currentMode === 'interactive') {
      console.log(`[Interactive] ✅ handleTranscriptionResult called with: "${transcript}"`);
      setCurrentTranscript(transcript); // Update real-time transcript display
      // Only process final results for generating replies (to avoid duplicate processing)
      // But we'll process it anyway to generate the reply
      console.log(`[Interactive] 📞 Calling handleInteractiveSpeech...`);
      handleInteractiveSpeech(transcript);
      return;
    } else {
      console.log(`[Voice] Not in interactive mode (${prompterMode}), processing for teleprompter...`);
    }
    
    // Use refs to get latest values without causing re-renders
    const currentSentenceIndex = activeSentenceIndexRef.current;
    const currentWordIndex = activeWordIndexRef.current;
    const currentWords = sentenceWordsRef.current;
    const currentSentences = scriptSentencesRef.current;
    
    const words = currentWords[currentSentenceIndex] || [];
    if (words.length === 0) {
      console.log('[Voice] No words in current sentence');
      return;
    }

    console.log(`[Voice] Received transcript: "${transcript}"`);
    console.log(`[Voice] Current sentence: "${currentSentences[currentSentenceIndex]}"`);
    console.log(`[Voice] Current word index: ${currentWordIndex}/${words.length}`);

    const spokenLower = transcript.toLowerCase().trim();
    const cleanedWords = words.map(word =>
      word
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, '')
        .trim()
    );

    // Split transcript into words for better matching (used throughout the function)
    const transcriptWords = spokenLower
      .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    console.log(`[Voice] Script words: [${cleanedWords.join(', ')}]`);
    console.log(`[Voice] Transcript words: [${transcriptWords.join(', ')}]`);

    // Strategy 0: Cross-sentence matching for jump reading
    // Only search for other sentences if:
    // 1. We're not making good progress in current sentence (at beginning or stuck)
    // 2. Transcript is long enough (at least 4 words for accuracy)
    // 3. Haven't jumped recently (debounce)
    // 4. Current sentence matching is failing (no good matches found)
    const shouldSearchOtherSentences = 
      transcriptWords.length >= 4 && // Need at least 4 words for accuracy
      (currentWordIndex < 1 || (currentWordIndex >= words.length - 1 && Date.now() - lastMatchTimeRef.current > 1500)) && // At very beginning or stuck at end
      (Date.now() - lastSentenceJumpRef.current > 3000); // Haven't jumped in last 3 seconds (increased debounce)
    
    if (shouldSearchOtherSentences) {
      const matchingSentenceIndex = findMatchingSentence(transcript, currentSentenceIndex);
      if (matchingSentenceIndex !== null && matchingSentenceIndex !== currentSentenceIndex) {
        // Found a match in another sentence - jump to it
        // Only jump if it's different from last jump (to avoid oscillating)
        if (matchingSentenceIndex !== lastJumpSentenceIndexRef.current) {
          console.log(`[Voice] 🚀 Jumping to sentence ${matchingSentenceIndex} (jump reading detected)`);
          lastSentenceJumpRef.current = Date.now();
          lastJumpSentenceIndexRef.current = matchingSentenceIndex;
          goToSentence(matchingSentenceIndex, 0);
          return; // Exit early since we jumped to a different sentence
        }
      }
    }

    // Improved matching: try to find sequential words in the transcript
    // Start from current position and look for matches
    let bestMatchIndex = currentWordIndex;
    let bestSimilarity = 0;
    let matchedCount = 0;

    // Strategy 1: Intelligent fuzzy matching - find best match using similarity scoring
    // Very low thresholds for maximum responsiveness and to keep pace with reading speed
    const SIMILARITY_THRESHOLD = 0.15; // Very low threshold to catch almost all matches (0.0 to 1.0) - reduced for faster response
    const STRICT_THRESHOLD = 0.35; // Lower strict threshold for faster matching - reduced
    
    let transcriptWordIndex = 0;
    let scriptWordIndex = currentWordIndex;
    let foundMatch = false;
    let bestMatchSimilarity = 0;
    
    // Check more words to handle longer transcripts
    // Increase range to match more of the transcript and keep up with reading speed
    const maxScriptWordsToCheck = Math.min(20, cleanedWords.length - currentWordIndex); // Check up to 20 words ahead
    const maxTranscriptWordsToCheck = Math.min(transcriptWords.length, 15); // Check up to 15 transcript words
    
    // Strategy 1a: Try sequential matching - match transcript words in order with script words
    // This handles cases where user reads multiple words in sequence
    let sequentialMatchCount = 0;
    let sequentialMatchEndIndex = currentWordIndex;
    let transcriptIdx = 0;
    let scriptIdx = currentWordIndex;
    
    while (transcriptIdx < maxTranscriptWordsToCheck && scriptIdx < currentWordIndex + maxScriptWordsToCheck && scriptIdx < cleanedWords.length) {
      const transcriptWord = transcriptWords[transcriptIdx];
      const scriptWord = cleanedWords[scriptIdx];
      
      if (!transcriptWord || !scriptWord) {
        scriptIdx++;
        continue;
      }
      
      const similarity = calculateWordSimilarity(scriptWord, transcriptWord);
      
      // If we find a match (even very fuzzy), continue sequential matching
      // Use very low threshold to keep pace with reading
      if (similarity >= SIMILARITY_THRESHOLD) {
        sequentialMatchCount++;
        sequentialMatchEndIndex = scriptIdx + 1;
        transcriptIdx++;
        scriptIdx++;
        
        if (similarity > bestMatchSimilarity) {
          bestMatchSimilarity = similarity;
        }
        
        console.log(`[Voice] Sequential match ${sequentialMatchCount}: "${scriptWord}" ~ "${transcriptWord}" (similarity: ${similarity.toFixed(2)}) at index ${scriptIdx - 1}`);
      } else {
        // No match, try next script word (user might have skipped a word)
        scriptIdx++;
        
        // Allow skipping up to 2 words before breaking the sequence
        const skippedWords = scriptIdx - currentWordIndex - sequentialMatchCount;
        if (skippedWords > 2 && sequentialMatchCount > 0) {
          // We've skipped too many, use what we matched so far
          break;
        }
        
        // If we've matched some words and skipped a few, still use that
        if (sequentialMatchCount > 0 && skippedWords > 1) {
          break;
        }
      }
    }
    
    // If we found sequential matches, use that
    if (sequentialMatchCount > 0) {
      bestMatchIndex = sequentialMatchEndIndex;
      matchedCount = sequentialMatchCount;
      foundMatch = true;
      console.log(`[Voice] ✅ Sequential match found: ${sequentialMatchCount} words matched, advancing to index ${bestMatchIndex}`);
    } else {
      // Strategy 1b: Fallback to single word matching if sequential matching failed
      for (let tIdx = 0; tIdx < Math.min(maxTranscriptWordsToCheck, 5); tIdx++) {
        const transcriptWord = transcriptWords[tIdx];
        if (!transcriptWord || transcriptWord.length < 1) continue;
        
        // Check next few script words for best match
        for (let sIdx = currentWordIndex; sIdx < currentWordIndex + maxScriptWordsToCheck && sIdx < cleanedWords.length; sIdx++) {
          const scriptWord = cleanedWords[sIdx];
          if (!scriptWord || scriptWord.length < 1) continue;
          
          // Calculate similarity
          const similarity = calculateWordSimilarity(scriptWord, transcriptWord);
          
          // If we find a good match (exact or very similar)
          if (similarity >= STRICT_THRESHOLD) {
            // Prefer matches closer to current position
            const distance = sIdx - currentWordIndex;
            const adjustedSimilarity = similarity - (distance * 0.1); // Penalize distance
            
            if (adjustedSimilarity > bestMatchSimilarity) {
              bestMatchSimilarity = adjustedSimilarity;
              bestMatchIndex = sIdx + 1;
              matchedCount = 1;
              foundMatch = true;
              console.log(`[Voice] Strong match: "${scriptWord}" ~ "${transcriptWord}" (similarity: ${similarity.toFixed(2)}) at index ${sIdx}`);
            }
          }
          // Also consider fuzzy matches (lower threshold)
          else if (similarity >= SIMILARITY_THRESHOLD && !foundMatch) {
            const distance = sIdx - currentWordIndex;
            const adjustedSimilarity = similarity - (distance * 0.15);
            
            if (adjustedSimilarity > bestMatchSimilarity) {
              bestMatchSimilarity = adjustedSimilarity;
              bestMatchIndex = sIdx + 1;
              matchedCount = 1;
              console.log(`[Voice] Fuzzy match: "${scriptWord}" ~ "${transcriptWord}" (similarity: ${similarity.toFixed(2)}) at index ${sIdx}`);
            }
          }
        }
        
        // If we found a strong match, stop searching
        if (foundMatch && bestMatchSimilarity >= STRICT_THRESHOLD) {
          break;
        }
      }
    }
    
    // Strategy 1b: Prioritize immediate next word with very lenient matching
    // This ensures smooth progression even with imperfect recognition
    if (currentWordIndex < cleanedWords.length) {
      const nextScriptWord = cleanedWords[currentWordIndex];
      if (transcriptWords.length > 0) {
        // Check all transcript words against the immediate next script word
        for (const transcriptWord of transcriptWords) {
          const similarity = calculateWordSimilarity(nextScriptWord, transcriptWord);
          
          // Very lenient threshold for immediate next word (0.2) to prevent stalling and keep pace
          if (similarity >= 0.2 && similarity > bestMatchSimilarity) {
            bestMatchIndex = currentWordIndex + 1;
            matchedCount = 1;
            foundMatch = true;
            bestMatchSimilarity = similarity;
            console.log(`[Voice] Immediate next word match: "${nextScriptWord}" ~ "${transcriptWord}" (similarity: ${similarity.toFixed(2)})`);
            break; // Found a match, stop searching
          }
        }
      }
    }

    // Strategy 2: Only check next sentence if we're at the end of current sentence
    // This prevents premature sentence jumping
    if (matchedCount === 0 && currentWordIndex >= words.length - 1) {
      console.log(`[Voice] At end of sentence, checking next sentence...`);
      
      // Only check next sentence if we're at the last word
      if (currentSentenceIndex < currentSentences.length - 1) {
        const nextSentenceIdx = currentSentenceIndex + 1;
        const nextWords = currentWords[nextSentenceIdx] || [];
        const nextCleanedWords = nextWords.map(w => 
          w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]"]/g, '').trim()
        );
        
        // Check if first transcript word matches first word of next sentence
        if (transcriptWords.length > 0 && nextCleanedWords.length > 0) {
          const firstTranscriptWord = transcriptWords[0].replace(/['"]/g, '').toLowerCase();
          const firstNextWord = nextCleanedWords[0];
          
          if (firstNextWord === firstTranscriptWord || 
              (firstNextWord.length >= 4 && firstTranscriptWord.length >= 4 && 
               firstNextWord.substring(0, 4) === firstTranscriptWord.substring(0, 4))) {
            console.log(`[Voice] Found match in next sentence (${nextSentenceIdx}), advancing...`);
            goToSentence(nextSentenceIdx, 0);
            return; // Exit early since we moved to next sentence
          }
        }
      }
    }

    // Advance if we found a match (even if fuzzy), but limit to maximum 1 word advance
    // This ensures word-by-word progression while allowing fuzzy matching
    // Also advance if we have any transcript but no match (to keep pace with reading)
    let shouldAdvance = false;
    let newIndex = currentWordIndex;
    
    if (bestMatchSimilarity >= SIMILARITY_THRESHOLD && bestMatchIndex > currentWordIndex) {
      // Found a match above threshold
      // If we matched multiple words sequentially, advance to the end of the match
      // Otherwise, advance by 1 word at a time for smooth progression
      if (matchedCount > 1) {
        // Multiple words matched - advance to the end of the match
        // Increase limit to match more words at once for faster progression
        newIndex = Math.min(bestMatchIndex, currentWordIndex + Math.min(matchedCount, 8)); // Max 8 words at once (increased from 5)
        shouldAdvance = true;
        console.log(`[Voice] Moving to word index: ${newIndex} (${matchedCount} words matched sequentially, similarity: ${bestMatchSimilarity.toFixed(2)})`);
      } else {
        // Single word match - advance by 1
        newIndex = Math.min(bestMatchIndex, currentWordIndex + 1);
        shouldAdvance = true;
        const matchType = bestMatchSimilarity >= STRICT_THRESHOLD ? 'strong' : 'fuzzy';
        console.log(`[Voice] Moving to word index: ${newIndex} (${matchType} match, similarity: ${bestMatchSimilarity.toFixed(2)})`);
      }
    } else if (transcriptWords.length > 0 && currentWordIndex < words.length) {
      // Even if no good match, if we have transcript, try to advance
      // This keeps the teleprompter moving with the reader's pace
      const timeSinceLastMatch = Date.now() - lastMatchTimeRef.current;
      
      // If we have multiple transcript words, we should advance even without perfect match
      if (transcriptWords.length >= 2) {
        // Multiple words recognized - advance more aggressively to keep pace
        // Advance by the number of words recognized (up to a limit)
        const advanceCount = Math.min(transcriptWords.length, 3); // Advance up to 3 words if multiple recognized
        newIndex = currentWordIndex + advanceCount;
        shouldAdvance = true;
        console.log(`[Voice] Multiple words recognized (${transcriptWords.length}), advancing ${advanceCount} words to keep pace (index: ${newIndex})`);
      } else if (timeSinceLastMatch > 800) { // Reduced from 1000ms to 800ms 
        // If no match for 1 second, advance anyway
        newIndex = currentWordIndex + 1;
        shouldAdvance = true;
        console.log(`[Voice] No match found but transcript received, advancing to keep pace (index: ${newIndex})`);
      } else if (bestMatchSimilarity > 0.15 || transcriptWords.length > 0) {
        // Very low similarity but still something - advance with lower confidence
        // Or if we have any transcript words at all, advance to keep pace
        newIndex = currentWordIndex + 1;
        shouldAdvance = true;
        console.log(`[Voice] Low similarity match (${bestMatchSimilarity.toFixed(2)}) or transcript received, advancing anyway (index: ${newIndex})`);
      }
    }
    
    if (shouldAdvance && newIndex > currentWordIndex) {
      console.log(`[Voice] ✅ ADVANCING: Updating activeWordIndex from ${currentWordIndex} to ${newIndex}`);
      console.log(`[Voice] Current words: [${words.slice(currentWordIndex, currentWordIndex + 3).join(', ')}...]`);
      
      // Force immediate state update
      setActiveWordIndex(newIndex);
      
      // Also update ref immediately for next check
      activeWordIndexRef.current = newIndex;
      
      // Force a re-render by updating a dummy state if needed
      // The scroll useEffect will handle scrolling when activeWordIndex changes
      // But we also add a backup scroll after a short delay to ensure it happens
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const node = activeWordRef.current || activeSentenceRef.current;
          if (node && prompterRef.current) {
          const container = prompterRef.current;
          // Center the active sentence in the middle of the container
          const target = node.offsetTop - container.clientHeight * 0.5 + (node.offsetHeight || 0) * 0.5;
          console.log(`[Voice] Backup scroll check - target: ${target}, node offsetTop: ${node.offsetTop}`);
            // Only scroll if we're not already at the target
            const currentScroll = container.scrollTop;
            if (Math.abs(currentScroll - target) > 10) {
              console.log(`[Voice] Backup scroll triggered - current: ${currentScroll}, target: ${target}`);
              smoothScrollToTarget(Math.max(0, target));
            } else {
              console.log(`[Voice] Already at scroll target`);
            }
          } else {
            console.warn(`[Voice] Backup scroll failed - activeWordRef: ${!!activeWordRef.current}, activeSentenceRef: ${!!activeSentenceRef.current}, prompterRef: ${!!prompterRef.current}`);
          }
        });
      });
      
      // Update last match time and clear stall timeout
      lastMatchTimeRef.current = Date.now();
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
      
      // Set a new stall timeout (0.6 second) - shorter timeout for faster response
      stallTimeoutRef.current = window.setTimeout(() => {
        const currentIdx = activeWordIndexRef.current;
        const currentWords = sentenceWordsRef.current[activeSentenceIndexRef.current] || [];
        if (currentIdx < currentWords.length) {
          console.log(`[Voice] Stall timeout: Auto-advancing from ${currentIdx} to ${currentIdx + 1}`);
          setActiveWordIndex(currentIdx + 1);
          lastMatchTimeRef.current = Date.now();
        }
      }, 600); // Reduced to 0.6 second for faster response
    } else {
      console.log(`[Voice] No progress made, staying at index: ${currentWordIndex}`);
      console.log(`[Voice] Best similarity found: ${bestMatchSimilarity.toFixed(2)}, threshold: ${SIMILARITY_THRESHOLD}`);
      
      // Anti-stall mechanism: if no match for 0.6 second, advance by 1 word anyway
      // This prevents getting stuck on difficult words and keeps pace with reading
      const timeSinceLastMatch = Date.now() - lastMatchTimeRef.current;
      if (timeSinceLastMatch > 600 && currentWordIndex < words.length) {
        console.log(`[Voice] Anti-stall: No match for ${(timeSinceLastMatch / 1000).toFixed(1)}s, advancing by 1 word`);
        const newIndex = currentWordIndex + 1;
        setActiveWordIndex(newIndex);
        lastMatchTimeRef.current = Date.now();
      }
    }

    // Only move to next sentence if we've read ALL words in current sentence
    // This prevents premature sentence jumping
    if (bestMatchIndex >= words.length) {
      console.log(`[Voice] Sentence complete (${bestMatchIndex}/${words.length}), moving to next`);
      goToNextSentence();
    }
  };

  // Web Speech API for real-time voice recognition (both voice and interactive modes)
  // Skip if using faster-whisper in interactive mode
  useEffect(() => {
    if (!isPrompterActive || (prompterMode === 'voice' && prompterScrollMode === 'timer') || (prompterMode !== 'voice' && prompterMode !== 'interactive')) {
      // Cleanup if switching modes
      if (mediaRecorderRef.current) {
        const recognition = mediaRecorderRef.current as any;
        if (recognition && recognition.stop) {
          recognition.stop();
        }
        mediaRecorderRef.current = null;
      }
      setIsListening(false);
      return;
    }
    
    // Skip Web Speech API if using faster-whisper in interactive mode
    if (prompterMode === 'interactive' && useFasterWhisper && fasterWhisperAvailable) {
      console.log('[Voice] Skipping Web Speech API - using Faster-Whisper instead');
      return;
    }

    // Check if Web Speech API is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Web Speech API not available in this browser.");
      console.error("Supported browsers: Chrome, Edge, Safari (desktop)");
      console.error("Falling back to timer mode.");
      alert('您的浏览器不支持 Web Speech API。请使用 Chrome 或 Edge 浏览器。');
      setPrompterMode('timer');
      setVoiceErrorMessage('当前环境不支持 Web Speech API，请使用 Chrome/Edge 或切换到 Faster-Whisper。');
      return;
    }

    console.log('[Voice] Web Speech API is available');
    console.log('[Voice] Starting Web Speech API recognition');
    
    // Request microphone permission first
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        console.log('[Voice] Microphone permission granted');
      })
      .catch((error) => {
        console.error('[Voice] Microphone permission denied:', error);
        alert('无法访问麦克风。请允许浏览器访问麦克风权限。');
        setPrompterMode('timer');
        return;
      });

    const recognition = new SpeechRecognition();
    mediaRecorderRef.current = recognition as any; // Reuse ref for cleanup

    // Configure recognition
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true; // Get interim results for real-time feedback
    recognition.lang = 'en-US'; // Set language to English
    recognition.maxAlternatives = 3; // Get more alternatives for better accuracy
    
    console.log('[Voice] Recognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang
    });

    let lastProcessedIndex = -1;
    let lastInterimTranscript: { text: string; time: number } | null = null;

    recognition.onresult = (event: any) => {
      // Use ref to get the latest mode value (state might be stale in closure)
      const currentMode = prompterModeRef.current; // Use ref to get latest value
      const elfIsSpeaking = isElfSpeakingRef.current; // Use ref to get latest value
      const isActive = isPrompterActiveRef.current; // Use ref to get latest value
      
      // Ignore recognition results if paused
      if (currentMode === 'interactive' && !isActive) {
        console.log('[Voice] ⏸️ Ignoring recognition result - paused');
        return;
      }
      
      // Ignore recognition results while elf is speaking (to avoid feedback loop)
      if (elfIsSpeaking) {
        console.log('[Voice] ⏸️ Ignoring recognition result - elf is speaking');
        return;
      }
      
      console.log(`[Voice] onresult event, resultIndex: ${event.resultIndex}, results length: ${event.results.length}`);
      console.log(`[Voice] Current mode from ref: ${currentMode}`);
      console.log(`[Voice] Current mode from state: ${prompterMode}`);
      console.log(`[Voice] isPrompterActive: ${isPrompterActive}`);
      console.log(`[Voice] Is interactive mode? ${currentMode === 'interactive'}`);
      
      // Get the most recent transcript for display (especially in interactive mode)
      let fullTranscript = '';
      for (let i = 0; i <= event.resultIndex; i++) {
        if (event.results[i] && event.results[i][0]) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
      }
      const fullTranscriptTrimmed = fullTranscript.trim();
      
      console.log(`[Voice] Full transcript: "${fullTranscriptTrimmed}", Mode: ${currentMode}`);
      
      // Update real-time transcript display in interactive mode - ALWAYS update when there's text
      if (currentMode === 'interactive') {
        if (fullTranscriptTrimmed) {
          console.log(`[Interactive] ✅ Updating transcript display: "${fullTranscriptTrimmed}"`);
          setCurrentTranscript(fullTranscriptTrimmed);
        } else {
          console.log(`[Interactive] ⚠️ Full transcript is empty`);
        }
      } else {
        console.log(`[Voice] Not in interactive mode (current: ${currentMode}), skipping transcript display update`);
      }
      
      // Process all results from lastProcessedIndex + 1 to current resultIndex
      // This ensures we don't miss any transcriptions
      // But skip if paused in interactive mode
      if (currentMode === 'interactive' && !isActive) {
        console.log('[Voice] ⏸️ Skipping result processing - paused');
        return;
      }
      
      for (let i = lastProcessedIndex + 1; i <= event.resultIndex; i++) {
        if (i < event.results.length) {
          const result = event.results[i];
          if (result && result[0]) {
            const transcript = result[0].transcript;
            const isFinal = result.isFinal;
            const confidence = result[0].confidence || 0;

            if (transcript && transcript.trim()) {
              console.log(`[Voice] Result ${i}: "${transcript}" (final: ${isFinal}, confidence: ${confidence.toFixed(2)})`);
              
              // Process both interim and final results, but prioritize final results
              // In interactive mode, ONLY process final results to ensure complete sentences
              if (isFinal) {
                // Final results are more accurate - process immediately
                console.log(`[Voice] Processing final result in mode: ${currentMode}`);
                handleTranscriptionResult(transcript);
                // Don't clear transcript immediately - keep it visible for a moment
                if (currentMode === 'interactive') {
                  // Keep the final transcript visible, don't clear it
                  console.log(`[Interactive] ✅ Final transcript received: "${transcript}"`);
                }
              } else {
                // Interim results - in interactive mode, also process for faster response
                if (currentMode === 'interactive') {
                  // Process interim results for faster response (real-time feel)
                  const transcriptKey = transcript.trim().toLowerCase();
                  const now = Date.now();
                  // Update display and process more frequently (every 30ms for smoother display)
                  if (!lastInterimTranscript || lastInterimTranscript.text !== transcriptKey || now - lastInterimTranscript.time > 30) {
                    console.log(`[Interactive] ⚡ Processing interim result for faster response: "${transcript}"`);
                    setCurrentTranscript(transcript);
                    // Also process interim results for faster response (will wait for complete sentence in handleInteractiveSpeech)
                    handleTranscriptionResult(transcript);
                    lastInterimTranscript = { text: transcriptKey, time: now };
                  }
                } else {
                  // In voice mode, use debounce and process interim results
                  const transcriptKey = transcript.trim().toLowerCase();
                  const now = Date.now();
                  if (!lastInterimTranscript || lastInterimTranscript.text !== transcriptKey || now - lastInterimTranscript.time > 200) {
                    handleTranscriptionResult(transcript);
                    lastInterimTranscript = { text: transcriptKey, time: now };
                  }
                }
              }
            }
          }
        }
      }
      
      // Update last processed index
      lastProcessedIndex = event.resultIndex;
      
      // Also get the most recent complete transcript for better matching (only in voice mode)
      // Use the FULL accumulated transcript for matching, not just individual results
      if (fullTranscriptTrimmed && currentMode !== 'interactive') {
        console.log(`[Voice] Full transcript so far: "${fullTranscriptTrimmed}" (mode: ${currentMode})`);
        
        // Process the FULL transcript for better matching
        // This allows matching longer phrases that span multiple recognition results
        // Process more frequently - if transcript has grown by 3+ characters
        if (!lastInterimTranscript || fullTranscriptTrimmed.length > lastInterimTranscript.text.length + 3) {
          // Reduced threshold from 5 to 3 characters for more frequent processing
          handleTranscriptionResult(fullTranscriptTrimmed);
          lastInterimTranscript = { text: fullTranscriptTrimmed.toLowerCase(), time: Date.now() };
         }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Speech recognition error:', event.error, event);
      
      if (event.error === 'no-speech') {
        return;
      }
      
      if (event.error === 'audio-capture') {
        console.error('[Voice] No microphone found or microphone not accessible');
        alert('无法访问麦克风。请检查麦克风权限设置。');
        setPrompterMode('timer');
        setVoiceErrorMessage('无法访问麦克风，请检查权限设置。');
        return;
      }
      
      if (event.error === 'not-allowed') {
        console.error('[Voice] Microphone permission denied');
        alert('麦克风权限被拒绝。请在浏览器设置中允许麦克风访问。');
        setPrompterMode('timer');
        setVoiceErrorMessage('麦克风权限被拒绝，请在浏览器设置中允许访问。');
        return;
      }
      
      if (event.error === 'network') {
        console.warn('[Voice] Network error - speech recognition temporarily unavailable. Check connection or use HTTPS.');
        setVoiceErrorMessage('Web Speech API 网络错误，可能无法连接到 Google 语音服务。请检查网络或切换使用 Faster-Whisper（需先运行 npm run server:faster-whisper）。');
        return;
      }
      
      console.warn('[Voice] Error occurred:', event.error);
      setVoiceErrorMessage(`语音识别错误: ${event.error}`);
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended');
      
      // Check if we should restart (only if still active and not already restarting)
      if (!isPrompterActive || (prompterMode !== 'voice' && prompterMode !== 'interactive')) {
        console.log('[Voice] Not restarting - mode changed');
        return;
      }
      
      // Prevent infinite restart loops
      const now = Date.now();
      const timeSinceLastRestart = now - lastRestartTimeRef.current;
      
      // If restarted too recently (less than 2 seconds), don't restart again
      if (timeSinceLastRestart < 2000) {
        console.log(`[Voice] Skipping restart - too soon (${timeSinceLastRestart}ms ago)`);
        return;
      }
      
      // Limit restart attempts - if restarted too many times, stop
      restartCountRef.current++;
      if (restartCountRef.current > 10) {
        console.error('[Voice] Too many restart attempts, stopping to prevent infinite loop');
        setPrompterMode('timer');
        return;
      }
      
      // Clear any existing restart timeout
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      // Debounce restart - wait a bit before restarting
      isRestartingRef.current = true;
      lastRestartTimeRef.current = now;
      
      restartTimeoutRef.current = window.setTimeout(() => {
        if (!isPrompterActive || (prompterMode !== 'voice' && prompterMode !== 'interactive')) {
          isRestartingRef.current = false;
          return;
        }
        
        // Check if recognition is already running
        try {
          // Try to start recognition
      recognition.start();
          console.log(`[Voice] Recognition restarted (attempt ${restartCountRef.current})`);
          isRestartingRef.current = false;
        } catch (e: any) {
          console.error('[Voice] Failed to restart recognition:', e);
          isRestartingRef.current = false;
          
          // If error is that it's already running, that's okay
          if (e.message && e.message.includes('already')) {
            console.log('[Voice] Recognition already running, ignoring error');
         } else {
            // For other errors, wait longer before retrying
            restartCountRef.current++;
            if (restartCountRef.current > 5) {
              console.error('[Voice] Too many restart failures, switching to timer mode');
              setPrompterMode('timer');
            }
          }
        }
      }, 500); // Wait 500ms before restarting
    };

    recognition.onstart = () => {
      console.log('[Voice] Speech recognition started successfully');
      console.log('[Voice] Listening for speech...');
      setIsListening(true);
      lastMatchTimeRef.current = Date.now(); // Reset match timer when starting
      restartCountRef.current = 0; // Reset restart counter on successful start
      isRestartingRef.current = false; // Clear restarting flag
      setVoiceErrorMessage(null);
      if (prompterMode === 'interactive') {
        console.log('[Interactive] Ready to listen for conversation');
      }
    };
    
    recognition.onaudiostart = () => {
      console.log('[Voice] Audio capture started');
    };
    
    recognition.onsoundstart = () => {
      console.log('[Voice] Sound detected');
    };
    
    recognition.onsoundend = () => {
      console.log('[Voice] Sound ended');
    };
    
    recognition.onspeechstart = () => {
      console.log('[Voice] Speech detected');
    };
    
    recognition.onspeechend = () => {
      console.log('[Voice] Speech ended');
    };

    // Start recognition
    try {
      recognition.start();
    } catch (error) {
      console.error('[Voice] Failed to start recognition:', error);
      setPrompterMode('timer');
    }

    return () => {
      console.log('[Voice] Cleaning up Web Speech API');
      
      // Clear restart timeout
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      // Stop recognition
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      
      mediaRecorderRef.current = null;
      isRestartingRef.current = false;
      restartCountRef.current = 0;
      
      // Clear stall timeout on cleanup
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current);
        stallTimeoutRef.current = null;
      }
      lastMatchTimeRef.current = Date.now(); // Reset on cleanup
    };
  }, [isPrompterActive, prompterMode]); // Removed activeSentenceIndex to prevent restarting recording on sentence change


  // --- 5. Background Tasks (Comments & Elf) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const randomComment = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
      const newComment: ViewerComment = {
        id: Date.now().toString() + Math.random(),
        user: randomComment.user,
        text: randomComment.text,
        timestamp: Date.now(),
      };
      
      setComments(prev => [newComment, ...prev].slice(0, 50));

      if (Math.random() > 0.8) {
        handleElfAutoReply(newComment);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [elf]);

  const handleElfAutoReply = async (comment: ViewerComment) => {
    if (isElfThinking || isElfSpeaking) return;
    
    setIsElfThinking(true);
    await new Promise(r => setTimeout(r, 500));
    const reply = await generateElfReply(comment.text, elf, `Current product: ${products[currentProductIndex]?.name}`);
    setIsElfThinking(false);
    setElfMessage(reply);
    triggerSpeakingAnimation(reply);
  };

  const triggerSpeakingAnimation = (text: string) => {
    setIsElfSpeaking(true);
    const duration = Math.max(2000, text.split(' ').length * 300);
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = window.setTimeout(() => {
      setIsElfSpeaking(false);
    }, duration);
  };

  // Text-to-Speech function for elf voice (with LiveTalking support)
  const speakElfMessage = async (text: string): Promise<void> => {
    if (!text || !text.trim()) {
      console.warn('[TTS] ⚠️ Empty text, skipping speech');
      return;
    }
    
    // Don't speak if paused in interactive mode
    if (prompterMode === 'interactive' && !isPrompterActive) {
      console.warn('[TTS] ⚠️ Paused in interactive mode, skipping speech');
      return;
    }
    
    console.log('[TTS] 🎙️ speakElfMessage called with text:', text);
    
    // Use LiveTalking if enabled and connected
    if (useLiveTalking && liveTalkingConnected && liveTalkingServiceRef.current) {
      try {
        console.log('[LiveTalking] 🎬 Speaking via LiveTalking:', text);
        setIsElfSpeaking(true);
        
        // Pause speech recognition while elf is speaking
        if (mediaRecorderRef.current && prompterModeRef.current === 'interactive') {
          const recognition = mediaRecorderRef.current as any;
          if (recognition && recognition.stop) {
            try {
              console.log('[LiveTalking] 🔇 Pausing speech recognition');
              recognition.stop();
            } catch (e) {
              console.warn('[LiveTalking] Error stopping recognition:', e);
            }
          }
        }
        
        // Also pause faster-whisper recording if active
        if (mediaRecorderForWhisper.current && useFasterWhisper) {
          try {
            console.log('[LiveTalking] 🔇 Pausing faster-whisper recording to avoid feedback loop');
            if (mediaRecorderForWhisper.current.state === 'recording') {
              mediaRecorderForWhisper.current.stop();
            }
          } catch (e) {
            console.warn('[LiveTalking] Error stopping faster-whisper recording:', e);
          }
        }
        
        // Send text to LiveTalking
        await liveTalkingServiceRef.current.speakText(text);
        
        // Estimate speaking time (roughly 150 words per minute)
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = Math.max(1000, (wordCount / 150) * 60 * 1000); // milliseconds, minimum 1s
        
        setTimeout(() => {
          setIsElfSpeaking(false);
          isElfSpeakingRef.current = false;
          console.log('[LiveTalking] ✅ Finished speaking');
          
          // Resume speech recognition
          if (mediaRecorderRef.current && prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
            const recognition = mediaRecorderRef.current as any;
            if (recognition && recognition.start) {
              setTimeout(() => {
                if (prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
                  try {
                    console.log('[LiveTalking] 🎤 Resuming speech recognition');
                    recognition.start();
                  } catch (e) {
                    console.warn('[LiveTalking] Error restarting recognition:', e);
                  }
                }
              }, 200);
            }
          }
          
          // Also resume faster-whisper recording if active
          if (useFasterWhisper && isPrompterActiveRef.current && prompterModeRef.current === 'interactive') {
            setTimeout(() => {
              if (mediaRecorderForWhisper.current && !isElfSpeakingRef.current) {
                try {
                  console.log('[LiveTalking] 🎤 Resuming faster-whisper recording');
                  if (mediaRecorderForWhisper.current.state !== 'recording') {
                    audioChunksRef.current = [];
                    mediaRecorderForWhisper.current.start();
                  }
                } catch (e) {
                  console.warn('[LiveTalking] Error restarting faster-whisper recording:', e);
                }
              }
            }, 300); // Wait a bit longer for faster-whisper to ensure audio is clear
          }
        }, estimatedDuration);
        
        return;
      } catch (error) {
        console.error('[LiveTalking] ❌ Error speaking:', error);
        setIsElfSpeaking(false);
        isElfSpeakingRef.current = false;
        // Fallback to TTS - continue to TTS section below
        console.log('[LiveTalking] Falling back to TTS');
      }
    }
    
    // Fallback to Web Speech API TTS (or primary method if LiveTalking not used)
    if (!('speechSynthesis' in window)) {
      console.warn('[TTS] ❌ Speech synthesis not supported');
      triggerSpeakingAnimation(text); // Fallback to animation only
      setIsElfSpeaking(true);
      isElfSpeakingRef.current = true;
      setTimeout(() => {
        setIsElfSpeaking(false);
        isElfSpeakingRef.current = false;
      }, Math.max(2000, text.split(' ').length * 300));
      return;
    }

    console.log('[TTS] ✅ Speech synthesis available, canceling any ongoing speech...');
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings
    utterance.lang = 'en-US';
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 0.8; // 80% volume
    
    // Try to find a suitable voice
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer female voices for elf character
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Female') || voice.name.includes('Zira') || voice.name.includes('Samantha') || voice.name.includes('Karen'))
      ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('[TTS] Using voice:', preferredVoice.name);
      }
    };

    // Load voices (may need to wait for voices to load)
    // Force load voices by calling getVoices multiple times
    const loadVoicesAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('[TTS] Available voices:', voices.length);
      
      if (voices.length > 0) {
        loadVoices();
        // Speak after voice is loaded
        console.log('[TTS] Speaking with voice:', utterance.voice?.name || 'default');
        window.speechSynthesis.speak(utterance);
      } else {
        // If no voices, try speaking anyway immediately (browser will use default) - don't wait
        console.log('[TTS] No voices loaded yet, speaking with default voice immediately');
        window.speechSynthesis.speak(utterance);
        
        // Also set up listener for when voices load (for future calls)
        const checkVoices = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = null; // Remove listener
          }
        };
        window.speechSynthesis.onvoiceschanged = checkVoices;
      }
    };

    utterance.onstart = () => {
      setIsElfSpeaking(true);
      isElfSpeakingRef.current = true;
      console.log('[TTS] ✅ Started speaking:', text);
      
      // Pause speech recognition while elf is speaking to avoid feedback loop
      if (mediaRecorderRef.current && prompterModeRef.current === 'interactive') {
        const recognition = mediaRecorderRef.current as any;
        if (recognition && recognition.stop) {
          try {
            console.log('[TTS] 🔇 Pausing speech recognition to avoid feedback loop');
            recognition.stop();
          } catch (e) {
            console.warn('[TTS] Error stopping recognition:', e);
          }
        }
      }
      
      // Also pause faster-whisper recording if active
      if (mediaRecorderForWhisper.current && useFasterWhisper) {
        try {
          console.log('[TTS] 🔇 Pausing faster-whisper recording to avoid feedback loop');
          if (mediaRecorderForWhisper.current.state === 'recording') {
            mediaRecorderForWhisper.current.stop();
          }
        } catch (e) {
          console.warn('[TTS] Error stopping faster-whisper recording:', e);
        }
      }
    };

    utterance.onend = () => {
      setIsElfSpeaking(false);
      isElfSpeakingRef.current = false;
      console.log('[TTS] ✅ Finished speaking');
      
      // Resume speech recognition after elf finishes speaking
      if (mediaRecorderRef.current && prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
        const recognition = mediaRecorderRef.current as any;
        if (recognition && recognition.start) {
          // Wait a bit before restarting to ensure TTS is completely done
          setTimeout(() => {
            // Double-check mode and active status before restarting
            if (prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
              try {
                console.log('[TTS] 🎤 Resuming speech recognition');
                recognition.start();
              } catch (e) {
                console.warn('[TTS] Error restarting recognition:', e);
              }
            }
          }, 200); // Reduced to 200ms for faster response
        }
      }
      
      // Also resume faster-whisper recording if active
      if (useFasterWhisper && isPrompterActiveRef.current && prompterModeRef.current === 'interactive') {
        setTimeout(() => {
          if (mediaRecorderForWhisper.current && !isElfSpeakingRef.current) {
            try {
              console.log('[TTS] 🎤 Resuming faster-whisper recording');
              if (mediaRecorderForWhisper.current.state !== 'recording') {
                audioChunksRef.current = [];
                mediaRecorderForWhisper.current.start();
              }
            } catch (e) {
              console.warn('[TTS] Error restarting faster-whisper recording:', e);
            }
          }
        }, 300); // Wait a bit longer for faster-whisper to ensure audio is clear
      }
    };

    utterance.onerror = (event) => {
      console.error('[TTS] ❌ Error:', event);
      setIsElfSpeaking(false);
      isElfSpeakingRef.current = false;
      // Try to speak again with a simpler approach
      console.log('[TTS] 🔄 Retrying with simpler utterance...');
      const retryUtterance = new SpeechSynthesisUtterance(text);
      retryUtterance.lang = 'en-US';
      retryUtterance.rate = 1.0;
      retryUtterance.volume = 0.8;
      retryUtterance.onstart = () => {
        setIsElfSpeaking(true);
        isElfSpeakingRef.current = true;
        console.log('[TTS] ✅ Retry started speaking');
      };
      retryUtterance.onend = () => {
        setIsElfSpeaking(false);
        isElfSpeakingRef.current = false;
        console.log('[TTS] ✅ Retry finished speaking');
      };
      retryUtterance.onerror = () => {
        console.error('[TTS] ❌ Retry also failed, using animation fallback');
        setIsElfSpeaking(false);
        isElfSpeakingRef.current = false;
        triggerSpeakingAnimation(text); // Final fallback to animation
      };
      window.speechSynthesis.speak(retryUtterance);
      
      // Resume speech recognition on error
      if (mediaRecorderRef.current && prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
        const recognition = mediaRecorderRef.current as any;
        if (recognition && recognition.start) {
          setTimeout(() => {
            // Double-check mode and active status before restarting
            if (prompterModeRef.current === 'interactive' && isPrompterActiveRef.current) {
              try {
                console.log('[TTS] 🎤 Resuming speech recognition after error');
                recognition.start();
              } catch (e) {
                console.warn('[TTS] Error restarting recognition:', e);
              }
            }
          }, 200); // Reduced to 200ms for faster response
        }
      }
    };

    // Start loading voices and speaking
    loadVoicesAndSpeak();
  };

  // Handle interactive mode: listen to user speech and generate elf reply
  const handleInteractiveSpeech = async (transcript: string) => {
    if (!transcript || !transcript.trim()) {
      console.log('[Interactive] ⚠️ Empty transcript, skipping');
      return;
    }
    
    // Don't process if paused in interactive mode
    if (prompterMode === 'interactive' && !isPrompterActive) {
      console.warn('[Interactive] ⚠️ Paused, skipping handleInteractiveSpeech');
      return;
    }
    
    // Update last speech time
    lastSpeechTimeRef.current = Date.now();
    
    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    const trimmedTranscript = transcript.trim();
    const endsWithPunctuation = /[.!?]$/.test(trimmedTranscript);
    const wordCount = trimmedTranscript.split(/\s+/).length;
    
    // Double-check paused state before processing
    if (prompterMode === 'interactive' && !isPrompterActive) {
      console.warn('[Interactive] ⚠️ Paused, skipping handleInteractiveSpeech (after transcript check)');
      return;
    }
    
    // If transcript ends with punctuation, it's likely complete - process immediately
    if (endsWithPunctuation && wordCount >= 2) {
      console.log('[Interactive] ✅ Complete sentence detected (ends with punctuation):', trimmedTranscript);
      // Check paused state again before processing
      if (prompterMode === 'interactive' && !isPrompterActive) {
        console.warn('[Interactive] ⚠️ Paused, skipping processCompleteTranscript');
        return;
      }
      processCompleteTranscript(trimmedTranscript);
      return;
    }
    
    // If transcript is long enough (3+ words), consider it complete even without punctuation
    if (wordCount >= 3) {
      console.log('[Interactive] ✅ Long enough transcript, treating as complete:', trimmedTranscript);
      // Check paused state again before processing
      if (prompterMode === 'interactive' && !isPrompterActive) {
        console.warn('[Interactive] ⚠️ Paused, skipping processCompleteTranscript');
        return;
      }
      processCompleteTranscript(trimmedTranscript);
      return;
    }
    
    // For shorter transcripts, wait for short silence (0.5 seconds) - balanced for reliability
    console.log('[Interactive] ⏳ Waiting for user to finish speaking...', trimmedTranscript);
    speechTimeoutRef.current = window.setTimeout(() => {
      // Check if paused before processing
      if (prompterMode === 'interactive' && !isPrompterActive) {
        console.warn('[Interactive] ⚠️ Paused during timeout, canceling processing');
        speechTimeoutRef.current = null;
        return;
      }
      
      // Check if there's been new speech since we started waiting
      const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
      if (timeSinceLastSpeech >= 500) {
        // No new speech for 0.5 seconds - user has finished speaking
        const currentTranscriptNow = currentTranscript.trim();
        if (currentTranscriptNow.length >= trimmedTranscript.length) {
          console.log('[Interactive] ✅ User finished speaking (0.5s silence), processing:', currentTranscriptNow);
          // Check paused state again before processing
          if (prompterMode === 'interactive' && !isPrompterActive) {
            console.warn('[Interactive] ⚠️ Paused, skipping processCompleteTranscript');
            return;
          }
          processCompleteTranscript(currentTranscriptNow);
        } else {
          // Fallback to original transcript - process even if short to ensure response
          console.log('[Interactive] ⚠️ No new speech, processing original transcript:', trimmedTranscript);
          // Check paused state again before processing
          if (prompterMode === 'interactive' && !isPrompterActive) {
            console.warn('[Interactive] ⚠️ Paused, skipping processCompleteTranscript');
            return;
          }
          processCompleteTranscript(trimmedTranscript);
        }
      } else {
        // New speech came in, don't process yet - but set up another timeout
        console.log('[Interactive] ⏸️ New speech detected, continuing to wait...');
        // Re-trigger with remaining time
        const remainingTime = 500 - timeSinceLastSpeech;
        if (remainingTime > 0) {
          speechTimeoutRef.current = window.setTimeout(() => {
            // Check if paused before processing
            if (prompterMode === 'interactive' && !isPrompterActive) {
              console.warn('[Interactive] ⚠️ Paused during extended timeout, canceling processing');
              speechTimeoutRef.current = null;
              return;
            }
            const finalTranscript = currentTranscript.trim();
            if (finalTranscript) {
              console.log('[Interactive] ✅ Final processing after extended wait:', finalTranscript);
              // Check paused state again before processing
              if (prompterMode === 'interactive' && !isPrompterActive) {
                console.warn('[Interactive] ⚠️ Paused, skipping processCompleteTranscript');
                return;
              }
              processCompleteTranscript(finalTranscript);
            }
            speechTimeoutRef.current = null;
          }, remainingTime);
        }
      }
    }, 500); // 0.5 seconds for better reliability
  };
  
  // Process complete transcript for elf reply
  const processCompleteTranscript = async (transcript: string) => {
    if (!transcript || !transcript.trim()) {
      console.log('[Interactive] ⚠️ Empty transcript in processCompleteTranscript, skipping');
      return;
    }
    
    // Don't process if paused in interactive mode
    if (prompterMode === 'interactive' && !isPrompterActive) {
      console.warn('[Interactive] ⚠️ Paused in interactive mode, skipping processing');
      return;
    }
    
    // Use refs to check latest state
    const elfIsThinking = isElfThinking;
    const elfIsSpeaking = isElfSpeakingRef.current;
    
    console.log('[Interactive] 🎤 Processing complete transcript:', transcript);
    console.log('[Interactive] Current state - isElfThinking:', elfIsThinking, 'isElfSpeaking:', elfIsSpeaking);
    
    // Cancel any ongoing elf response to override with new content
    if (elfIsThinking || elfIsSpeaking) {
      console.log('[Interactive] ⚠️ Canceling ongoing response to process new content');
      
      // Stop thinking state
      setIsElfThinking(false);
      
      // Stop speaking - cancel TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        console.log('[Interactive] ✅ Canceled TTS');
      }
      
      // Stop LiveTalking if active
      if (liveTalkingServiceRef.current && useLiveTalking) {
        try {
          // LiveTalking doesn't have a direct cancel method, but we can stop the speaking state
          setIsElfSpeaking(false);
          isElfSpeakingRef.current = false;
          console.log('[Interactive] ✅ Stopped LiveTalking');
        } catch (e) {
          console.warn('[Interactive] Error stopping LiveTalking:', e);
        }
      }
      
      // Clear previous messages
      setElfMessage("");
      setElfMessageChinese("");
      isElfSpeakingRef.current = false;
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setLastUserSpeech(transcript);
    
    // Double-check if still active before generating (might have been paused)
    if (prompterMode === 'interactive' && !isPrompterActive) {
      console.warn('[Interactive] ⚠️ Paused before generating reply, canceling');
      setIsElfThinking(false);
      return;
    }
    
    console.log('[Interactive] 🤔 Generating reply...');
    setIsElfThinking(true);
    
    // Start generating reply immediately (don't wait)
    generateElfReply(
      transcript, 
      elf, 
      `Interactive conversation mode. Current product: ${products[currentProductIndex]?.name}`
    ).then(async (reply) => {
      // Check if paused while generating reply
      if (prompterMode === 'interactive' && !isPrompterActive) {
        console.warn('[Interactive] ⚠️ Paused while generating reply, canceling');
        setIsElfThinking(false);
        return;
      }
      
      console.log('[Interactive] 💬 Generated reply:', reply);
      setElfMessage(reply);
      
      // Translate to Chinese in parallel
      translateToChinese(reply).then((chinese) => {
        setElfMessageChinese(chinese);
        console.log('[Interactive] 🇨🇳 Chinese translation:', chinese);
      }).catch((err) => {
        console.warn('[Interactive] Translation failed:', err);
        setElfMessageChinese("");
      });
      
      setIsElfThinking(false);
      
      // Speak the reply immediately - ensure it always happens when message is set
      console.log('[Interactive] 🔊 Calling speakElfMessage...');
      let speechSucceeded = false;
      try {
        await speakElfMessage(reply);
        speechSucceeded = true;
        console.log('[Interactive] ✅ speakElfMessage completed');
      } catch (speakError) {
        console.error('[Interactive] ❌ Error in speakElfMessage:', speakError);
        // Try fallback TTS
        try {
          // Force TTS even if LiveTalking failed
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(reply);
            utterance.lang = 'en-US';
            utterance.rate = 1.0;
            utterance.volume = 0.8;
            await new Promise<void>((resolve, reject) => {
              utterance.onend = () => {
                setIsElfSpeaking(false);
                isElfSpeakingRef.current = false;
                resolve();
              };
              utterance.onerror = (e) => {
                setIsElfSpeaking(false);
                isElfSpeakingRef.current = false;
                reject(e);
              };
              window.speechSynthesis.speak(utterance);
              setIsElfSpeaking(true);
              isElfSpeakingRef.current = true;
            });
            speechSucceeded = true;
            console.log('[Interactive] ✅ Fallback TTS succeeded');
          }
        } catch (fallbackError) {
          console.error('[Interactive] ❌ Fallback TTS also failed:', fallbackError);
        }
      }
      
      // If speech completely failed, don't show the bubble (clear message)
      if (!speechSucceeded) {
        console.warn('[Interactive] ⚠️ All speech methods failed, clearing message to avoid bubble without speech');
        setElfMessage("");
        setElfMessageChinese("");
        setIsElfSpeaking(false);
        isElfSpeakingRef.current = false;
      }
    }).catch((error) => {
      console.error('[Interactive] ❌ Failed to generate reply:', error);
      setIsElfThinking(false);
    });

    // Send updates to floating elf window will be done via useEffect below
  };

  // Determine Avatar Animation
  let avatarAnimationClass = "animate-breathe";
  if (isElfThinking) avatarAnimationClass = "animate-sway";
  if (isElfSpeaking) avatarAnimationClass = "animate-talk";

  // Check electronAPI on mount and periodically
  useEffect(() => {
    console.log('========================================');
    console.log('[LiveDashboard] Component mounted');
    console.log('[LiveDashboard] User Agent:', navigator.userAgent);
    console.log('[LiveDashboard] window object:', typeof window);
    console.log('[LiveDashboard] window.location:', window.location.href);
    console.log('[LiveDashboard] electronAPI available:', !!(window as any).electronAPI);
    
    if ((window as any).electronAPI) {
      console.log('[LiveDashboard] ✅ electronAPI methods:', Object.keys((window as any).electronAPI));
    } else {
      console.warn('[LiveDashboard] ⚠️ electronAPI not available');
      console.warn('[LiveDashboard] window keys:', Object.keys(window));
      
      // Try to check again after a delay (in case preload is still loading)
      const checkInterval = setInterval(() => {
        if ((window as any).electronAPI) {
          console.log('[LiveDashboard] ✅ electronAPI found after delay!');
          clearInterval(checkInterval);
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).electronAPI) {
          console.error('[LiveDashboard] ❌ electronAPI still not available after 5 seconds');
        }
      }, 5000);
    }
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col md:flex-row font-sans" style={{ height: '100%' }}>
      
      {/* BACKGROUND / CAMERA FEED SIMULATION */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
          <div className="text-slate-700 flex flex-col items-center opacity-50">
            <div className="w-24 h-24 border-4 border-dashed border-slate-700 rounded-full flex items-center justify-center mb-4">
              <Eye size={40} />
            </div>
            <p className="font-mono uppercase tracking-widest">Camera Feed Signal</p>
          </div>
        </div>
      </div>

      {/* --- OVERLAY UI --- */}

      {/* Mode Switcher - Always visible at top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-2 flex items-center gap-2 select-none">
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            <button 
              onClick={() => {
                setPrompterMode('voice');
                setIsPrompterActive(false);
              }}
              className={`px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-colors ${prompterMode === 'voice' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="念稿模式 - 跟随朗读滚动字幕"
            >
              <Mic size={14} /> 念稿
            </button>
            <button 
              onClick={() => {
                setPrompterMode('interactive');
                setIsPrompterActive(false);
                // Clear elf message when switching to interactive mode (no default message)
                setElfMessage("");
                setElfMessageChinese("");
              }}
              className={`px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-colors ${prompterMode === 'interactive' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="互动模式 - 与小精灵对话，小精灵会发出声音"
            >
              <MessageCircle size={14} /> 互动
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Mode Controls - Below mode switcher, similar to voice mode */}
      {prompterMode === 'interactive' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-1 flex items-center gap-1 select-none">
            {/* Faster-Whisper Toggle */}
            <button
              onClick={() => setUseFasterWhisper(!useFasterWhisper)}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                useFasterWhisper && fasterWhisperAvailable
                  ? 'bg-blue-500 text-white'
                  : useFasterWhisper
                  ? 'bg-yellow-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={useFasterWhisper ? '使用 Faster-Whisper 识别（更准确）' : '使用 Web Speech API 识别（更快）'}
            >
              <Mic size={11} />
              {useFasterWhisper ? (fasterWhisperAvailable ? 'Faster-Whisper' : '检查中...') : 'Web Speech'}
            </button>
            
            {/* LiveTalking Toggle */}
            <button
              onClick={() => setUseLiveTalking(!useLiveTalking)}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                useLiveTalking && liveTalkingConnected
                  ? 'bg-green-500 text-white'
                  : useLiveTalking
                  ? 'bg-yellow-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={useLiveTalking ? '使用 LiveTalking 数字人' : '使用 TTS 语音'}
            >
              <Eye size={11} />
              {useLiveTalking ? (liveTalkingConnected ? '数字人' : '连接中...') : 'TTS'}
            </button>
            
            {/* Play/Pause Button for Interactive Mode */}
            <button 
              onClick={() => {
                const newState = !isPrompterActive;
                setIsPrompterActive(newState);
                
                // If pausing, stop all speech, recognition, and processing
                if (!newState) {
                  console.log('[Interactive] ⏸️ Pausing - stopping all speech, recognition, and processing');
                  
                  // Clear all pending timeouts
                  if (speechTimeoutRef.current) {
                    clearTimeout(speechTimeoutRef.current);
                    speechTimeoutRef.current = null;
                    console.log('[Interactive] ✅ Cleared speech timeout');
                  }
                  
                  // Stop thinking/processing
                  setIsElfThinking(false);
                  
                  // Stop speech synthesis
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  setIsElfSpeaking(false);
                  isElfSpeakingRef.current = false;
                  
                  // Stop LiveTalking if active
                  if (liveTalkingServiceRef.current && useLiveTalking) {
                    try {
                      setIsElfSpeaking(false);
                      isElfSpeakingRef.current = false;
                    } catch (e) {
                      console.warn('[Interactive] Error stopping LiveTalking:', e);
                    }
                  }
                  
                  // Stop Web Speech API recognition
                  if (mediaRecorderRef.current) {
                    const recognition = mediaRecorderRef.current as any;
                    if (recognition && recognition.stop) {
                      try {
                        recognition.stop();
                        console.log('[Interactive] ✅ Stopped Web Speech API recognition');
                      } catch (e) {
                        console.warn('[Interactive] Error stopping recognition:', e);
                      }
                    }
                  }
                  
                  // Stop Faster-Whisper recording
                  if (mediaRecorderForWhisper.current) {
                    try {
                      if (mediaRecorderForWhisper.current.state === 'recording') {
                        mediaRecorderForWhisper.current.stop();
                        console.log('[Interactive] ✅ Stopped Faster-Whisper recording');
                      }
                    } catch (e) {
                      console.warn('[Interactive] Error stopping faster-whisper:', e);
                    }
                  }
                  
                  // Clear recording interval
                  if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                    recordingIntervalRef.current = null;
                    console.log('[Interactive] ✅ Cleared recording interval');
                  }
                  
                  setIsListening(false);
                  console.log('[Interactive] ✅ All paused - no more listening or processing');
                }
              }}
              className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ml-1 ${
                isPrompterActive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white hover:bg-green-400'
              }`}
              title={isPrompterActive ? "暂停监听（停止所有语音和识别）" : "开始监听"}
            >
              {isPrompterActive ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Interactive Mode Transcript Display */}
      {prompterMode === 'interactive' && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] z-20 flex flex-col gap-3">
          {/* Transcript Display */}
          <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isListening && isPrompterActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                <span className="text-sm text-slate-400">
                  {isPrompterActive ? (isListening ? '正在监听...' : '等待语音输入') : '已暂停'}
                </span>
              </div>
              {/* Manual Send Button */}
              {currentTranscript && currentTranscript.trim() && isPrompterActive && (
                <button
                  onClick={() => {
                    console.log('[Interactive] 📤 Manual send triggered:', currentTranscript);
                    processCompleteTranscript(currentTranscript.trim());
                    setCurrentTranscript(''); // Clear transcript after sending
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                  title="发送消息，让小精灵回复"
                >
                  <Send size={14} />
                  发送
                </button>
              )}
            </div>
            {currentTranscript ? (
              <div className="text-white text-lg font-medium min-h-[30px] break-words">
                {currentTranscript}
              </div>
            ) : lastUserSpeech ? (
              <div className="text-slate-400 text-sm italic">
                你说: "{lastUserSpeech}"
              </div>
            ) : (
              <div className="text-slate-500 text-sm min-h-[30px]">
                {isPrompterActive ? '说话时，你的语音会实时显示在这里...' : '已暂停，点击播放按钮开始监听'}
              </div>
            )}
          </div>
          
          {/* Topic Sentences for Interactive Mode */}
          {prompterMode === 'interactive' && activeProduct && topicSentences.length > 0 && (
            <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-3 flex items-center gap-2">
                <MessageCircle size={12} />
                话题句子 - 可以照着念或点击发送
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {topicSentences.map((sentence, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex-1 text-white text-sm leading-relaxed">
                      {sentence}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (isPrompterActive) {
                            console.log('[Interactive] 📤 Topic sentence clicked:', sentence);
                            processCompleteTranscript(sentence);
                            // Remove and generate new after sending
                            removeTopicSentence(index);
                          } else {
                            console.log('[Interactive] ⚠️ Paused, cannot send topic sentence');
                          }
                        }}
                        disabled={!isPrompterActive}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
                        title={isPrompterActive ? "发送这个话题给小精灵" : "请先点击播放按钮开始监听"}
                      >
                        <Send size={12} />
                        发送
                      </button>
                      <button
                        onClick={() => {
                          console.log('[Interactive] 🗑️ Removing topic sentence:', sentence);
                          removeTopicSentence(index);
                        }}
                        className="px-2 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                        title="删除这个话题句子"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. SMART TELEPROMPTER - Hidden in interactive mode */}
      {/* Container is resizable using CSS resize-y */}
      {prompterMode !== 'interactive' && (
      <div 
        ref={prompterElementRef}
        className="fixed w-[95%] md:w-[600px] z-50 flex flex-col shadow-2xl transition-all duration-300 group cursor-move"
        style={{
          left: prompterPosition.x || '50%',
          top: prompterPosition.y || '80px',
          transform: prompterPosition.x ? 'none' : 'translateX(-50%)',
          userSelect: isDraggingPrompter ? 'none' : 'auto'
        }}
        onMouseDown={handlePrompterMouseDown}
      >
        
        {/* Controls Header */}
        <div className="bg-black/80 backdrop-blur-md border border-white/10 border-b-0 rounded-t-xl p-3 flex flex-col md:flex-row justify-between items-center gap-2 select-none cursor-move">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
             {scriptSentences.length > 0 && (
               <span className="text-xs text-slate-400">
                 {activeSentenceIndex + 1} / {scriptSentences.length}
               </span>
             )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Scroll mode selector (only in voice mode) - Left of Navigation Controls */}
            {prompterMode === 'voice' && (
              <div className="flex items-center gap-1 bg-slate-800 rounded px-1 py-1">
                <button 
                  onClick={() => {
                    setPrompterScrollMode('voice');
                    setIsPrompterActive(false);
                  }}
                  className={`p-1 rounded transition-colors ${prompterScrollMode === 'voice' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="语音同步：跟随朗读滚动"
                >
                  <Mic size={14} />
                </button>
                <button 
                  onClick={() => {
                    setPrompterScrollMode('timer');
                    setIsPrompterActive(false);
                  }}
                  className={`p-1 rounded transition-colors ${prompterScrollMode === 'timer' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="自动滚动：定时器自动滚动"
                >
                  <Activity size={14} />
                </button>
              </div>
            )}
            
            {/* Speed Control for Auto-scroll Mode */}
            {prompterMode === 'voice' && prompterScrollMode === 'timer' && (
              <div className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1">
                <span className="text-xs text-slate-400 whitespace-nowrap">速度:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={prompterSpeed}
                  onChange={(e) => setPrompterSpeed(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title={`滚动速度: ${prompterSpeed.toFixed(1)}x`}
                />
                <span className="text-xs text-white font-medium min-w-[35px] text-right">
                  {prompterSpeed.toFixed(1)}x
                </span>
              </div>
            )}
            
            {/* Navigation Controls */}
            <div className="flex items-center gap-1 bg-slate-800 rounded px-1 py-1">
               <button 
                onClick={() => {
                  goToPreviousSentence();
                }}
                disabled={activeSentenceIndex === 0}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Sentence"
              >
                <SkipBack size={14} />
               </button>
               <button 
                onClick={() => {
                  goToNextSentence();
                }}
                disabled={activeSentenceIndex >= scriptSentences.length - 1}
                className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Sentence"
              >
                <SkipForward size={14} />
              </button>
              <button 
                onClick={() => {
                  goToSentence(0, 0);
                }}
                className="p-1 text-slate-400 hover:text-white"
                title="Reset to Start"
              >
                <RotateCcw size={14} />
               </button>
          </div>
          
            {/* Font Size Controls */}
            <div className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1">
               <button onClick={() => setFontSize(s => Math.max(14, s - 2))} className="text-slate-400 hover:text-white p-1" title="Decrease Font Size"><Type size={12} className="scale-75" /></button>
               <span className="text-xs w-6 text-center text-slate-300">{fontSize}</span>
               <button onClick={() => setFontSize(s => Math.min(48, s + 2))} className="text-slate-400 hover:text-white p-1" title="Increase Font Size"><Type size={14} /></button>
            </div>

            {/* Play/Pause */}
            <button 
              onClick={() => setIsPrompterActive(!isPrompterActive)}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isPrompterActive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white hover:bg-green-400'}`}
              title={isPrompterActive ? "Pause Auto-scroll" : "Start Auto-scroll"}
            >
              {isPrompterActive ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>
        
        {/* Resizable Text Area */}
        <div 
          ref={prompterRef}
          className="bg-black/55 backdrop-blur-sm border border-white/10 rounded-b-xl overflow-y-auto overflow-x-hidden resize-y min-h-[320px] max-h-[90vh] scroll-smooth"
          style={{ height: '520px' }} // show more content by default
        >
          <div className="relative px-4 py-6 flex flex-col gap-0 text-left">
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
                    className={`transition-all duration-500 ease-out leading-relaxed cursor-pointer ${containerClasses}`}
                    style={{ fontSize: `${fontSize}px` }}
                    title={`Click to jump to this sentence (${index + 1}/${scriptSentences.length})`}
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
                          onClick={() => {
                            goToSentence(index, wordIndex);
                          }}
                          className={wordClasses}
                          style={wordStyle}
                        >
                          {/* Base text layer - transparent white background */}
                          <span 
                            className="inline-block relative"
                            style={{
                              color: 'rgba(255, 255, 255, 0.4)',
                            }}
                          >
                            {word}
                            {/* Fill overlay - green text that fills from left to right (K歌 style) */}
                            {isCurrent && !isRead && (
                              <span
                                className="absolute left-0 top-0 text-green-300 inline-block"
                                style={{
                                  clipPath: 'polygon(0 0, 0% 0, 0% 100%, 0 100%)',
                                  textShadow: '0 0 8px rgba(74, 222, 128, 0.8)',
                                  animation: 'fillWord 0.15s linear forwards',
                                  width: '100%',
                                  height: '100%',
                                }}
                              >
                                {word}
                 </span>
                            )}
                            {/* Fully read words - show solid green immediately */}
                            {isRead && (
                              <span
                                className="absolute left-0 top-0 text-green-300 inline-block"
                                style={{
                                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                                  textShadow: '0 0 6px rgba(74, 222, 128, 0.6)',
                                  transition: 'all 0.2s ease-out',
                                  width: '100%',
                                  height: '100%',
                                }}
                              >
                                {word}
                              </span>
                            )}
                          </span>
                          &nbsp;
                        </span>
                      );
                   })}
                 </div>
               )
             })}
          </div>
          
          {/* Resize Handle Icon Hint (Visual only, CSS resize provides the actual handle) */}
          <div className="absolute bottom-1 right-1 pointer-events-none text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">
            <MoveVertical size={12} className="rotate-45" />
          </div>
        </div>
      </div>
      )}

      {/* 2. FULL BODY DIGITAL AVATAR */}
      <div 
        ref={elfElementRef}
        className="fixed w-64 h-80 z-40 flex flex-col items-center cursor-move"
        style={{
          left: elfPosition.x || 'calc(100% - 280px)',
          top: elfPosition.y || 'calc(100% - 320px)',
          userSelect: isDraggingElf ? 'none' : 'auto',
          pointerEvents: 'auto'
        }}
        onMouseDown={handleElfMouseDown}
      >
        
        {/* Chat Bubble - Only show if there's actual content or user has spoken */}
        {((isElfSpeaking && elfMessage) || isElfThinking || (prompterMode === 'interactive' && (isListening || lastUserSpeech))) && (
          <div className="absolute bottom-full mb-4 w-64 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="bg-white/95 backdrop-blur text-slate-900 p-4 rounded-2xl rounded-br-none shadow-2xl text-sm font-bold border-2 border-white relative">
                {isElfThinking ? (
                  <div className="flex gap-1 justify-center py-2">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                  </div>
                ) : isElfSpeaking && elfMessage ? (
                  <div className="space-y-2">
                    <div className="leading-snug block text-slate-900">{elfMessage}</div>
                    {elfMessageChinese && (
                      <div className="text-xs text-slate-600 border-t border-slate-200 pt-2 mt-2 italic">
                        {elfMessageChinese}
                      </div>
                    )}
                  </div>
                ) : prompterMode === 'interactive' && (isListening || lastUserSpeech) ? (
                  <div>
                    <div className="text-xs text-green-600 flex items-center gap-1 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      正在监听...
                    </div>
                    {lastUserSpeech && (
                      <div className="text-xs text-slate-500 italic border-t border-slate-200 pt-2 mt-2">
                        你说: "{lastUserSpeech}"
                      </div>
                    )}
                  </div>
                ) : null}
             </div>
          </div>
        )}

        {/* The Avatar Character - LiveTalking or Static */}
        <div className={`relative w-full h-full flex items-end justify-center transition-all duration-500`}>
           <div className={`absolute bottom-0 w-40 h-40 rounded-full blur-3xl opacity-30 ${elf.themeColor}`}></div>
           {useLiveTalking && liveTalkingConnected ? (
             // LiveTalking video stream
             <video
               ref={liveTalkingVideoRef}
               autoPlay
               playsInline
               muted={false}
               className="w-full h-full object-contain drop-shadow-2xl rounded-lg"
               style={{ transformOrigin: 'bottom center' }}
             />
           ) : (
             // Static avatar image (fallback)
             <img 
               src={elf.avatar} 
               alt="Digital Assistant" 
               className={`w-full h-full object-contain drop-shadow-2xl filter brightness-110 contrast-110 ${avatarAnimationClass}`} 
               style={{ transformOrigin: 'bottom center' }}
             />
           )}
           {isElfThinking && <div className="absolute top-10 right-10 text-4xl animate-bounce">🤔</div>}
           {isElfSpeaking && (
             <div className="absolute top-20 -right-2 bg-black/50 p-2 rounded-full backdrop-blur border border-white/20">
                <Activity size={16} className="text-green-400 animate-pulse" />
             </div>
           )}
           {useLiveTalking && !liveTalkingConnected && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
                LiveTalking 未连接
             </div>
           )}
        </div>
      </div>

      {/* 3. CONTROLS & PRODUCT NAV (Bottom Left) */}
      <div className="absolute bottom-20 md:bottom-4 left-4 z-30 w-[90%] md:w-auto pointer-events-auto">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-4 md:w-64 shadow-xl">
          {/* Floating Window Controls */}
          <div className="mb-4 pb-4 border-b border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold mb-2">悬浮窗口</div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  try {
                    console.log('[UI] Clicked create prompter window button');
                    console.log('[UI] electronAPI available:', !!(window as any).electronAPI);
                    if ((window as any).electronAPI && (window as any).electronAPI.createPrompterWindow) {
                      console.log('[UI] Calling createPrompterWindow...');
                      (window as any).electronAPI.createPrompterWindow();
                      console.log('[UI] createPrompterWindow called');
                    } else {
                      console.warn('[UI] electronAPI not available');
                      alert('请使用 Electron 版本以使用悬浮窗口功能\n\n运行命令: npm run electron:dev');
                    }
                  } catch (error) {
                    console.error('[UI] Error creating prompter window:', error);
                    alert('创建悬浮窗口失败: ' + (error as Error).message);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors"
                title="在桌面创建悬浮的提示词窗口"
              >
                <Maximize size={12} />
                提示词
              </button>
              <button
                onClick={() => {
                  try {
                    console.log('[UI] Clicked create elf window button');
                    console.log('[UI] electronAPI available:', !!(window as any).electronAPI);
                    if ((window as any).electronAPI && (window as any).electronAPI.createElfWindow) {
                      console.log('[UI] Calling createElfWindow...');
                      (window as any).electronAPI.createElfWindow();
                      console.log('[UI] createElfWindow called');
                    } else {
                      console.warn('[UI] electronAPI not available');
                      alert('请使用 Electron 版本以使用悬浮窗口功能\n\n运行命令: npm run electron:dev');
                    }
                  } catch (error) {
                    console.error('[UI] Error creating elf window:', error);
                    alert('创建悬浮窗口失败: ' + (error as Error).message);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
                title="在桌面创建悬浮的小精灵窗口"
              >
                <Maximize size={12} />
                小精灵
              </button>
            </div>
            {!(window as any).electronAPI && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                需要 Electron 版本
              </p>
            )}
          </div>
           <div className="flex items-center justify-between mb-2">
             <span className="text-xs text-slate-400 uppercase font-bold">Current Product</span>
             <div className="flex gap-1">
               <button 
                 onClick={() => setCurrentProductIndex(Math.max(0, currentProductIndex - 1))}
                 className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <ChevronUp size={16} />
                </button>
               <button 
                onClick={() => setCurrentProductIndex(Math.min(products.length - 1, currentProductIndex + 1))}
                className="p-1 hover:bg-white/10 rounded transition-colors"
               >
                 <ChevronDown size={16} />
               </button>
             </div>
           </div>
           
           {activeProduct ? (
             <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                 <ShoppingBag size={20} />
               </div>
               <div className="overflow-hidden">
                 <p className="font-bold truncate text-white">{activeProduct.name}</p>
                 <p className="text-xs text-slate-400 truncate">${(Math.random() * 100).toFixed(2)}</p>
               </div>
             </div>
           ) : (
             <p className="text-sm text-slate-500">No active product</p>
           )}
        </div>
      </div>

      {/* 4. COMMENT OVERLAY (Left Side) */}
      <div className="absolute top-20 left-4 w-72 h-[500px] overflow-hidden z-10 hidden md:flex flex-col-reverse mask-gradient pointer-events-none">
        <div className="space-y-3 pb-4 px-2">
          {comments.map((comment) => (
             <div key={comment.id} className="animate-in slide-in-from-left fade-in duration-300">
               <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/5 inline-block max-w-full shadow-sm">
                 <div className="flex items-baseline gap-2">
                   <span className="font-bold text-xs text-pink-300 drop-shadow-md">{comment.user}</span>
                   <span className="text-white text-sm drop-shadow-md leading-tight">{comment.text}</span>
                 </div>
               </div>
             </div>
          ))}
        </div>
      </div>

      <style>{`
        .mask-gradient {
          mask-image: linear-gradient(to bottom, transparent, black 10%, black 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 100%);
        }
      `}</style>

      {voiceErrorMessage && (
        <div className="absolute bottom-4 left-4 z-40 max-w-sm bg-red-600/85 text-white px-4 py-3 rounded-xl shadow-2xl space-y-2">
          <div className="text-sm font-semibold">语音识别提示</div>
          <div className="text-sm leading-relaxed">{voiceErrorMessage}</div>
          {!useFasterWhisper && (
            <button
              onClick={() => setUseFasterWhisper(true)}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
            >
              切换为 Faster-Whisper
            </button>
          )}
          {useFasterWhisper && !fasterWhisperAvailable && (
            <div className="text-xs text-white/90">
              请在新的终端运行 <code className="px-1 bg-white/20 rounded">npm run server:faster-whisper</code>，并保持该终端运行。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveDashboard;