export interface ElfPersonality {
  id: string;
  name: string;
  avatar: string; // URL or emoji
  tagline: string;
  description: string;
  promptModifier: string; // Added to system instructions
  themeColor: string;
}

export interface Product {
  id: string;
  name: string;
  url?: string;
  description: string;
  generatedScript?: ProductScript;
}

export interface ProductScript {
  intro: string;
  features: string;
  objections: string;
  cta: string;
  fullText: string;
}

export interface ViewerComment {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

export type TabView = 'elf-select' | 'products' | 'connect' | 'live-room';

export interface AppState {
  currentTab: TabView;
  selectedElfId: string | null;
  products: Product[];
  streamSettings: {
    roomLink: string;
    streamKey: string;
    isConnected: boolean;
  };
}