// Mock localStorage for test environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

// Mock BroadcastChannel
class BroadcastChannelMock {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(_data: unknown) {}
  close() {}
}

// Mock Web Audio API
class MockAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
  createBuffer(_channels: number, _length: number, _sampleRate: number) {
    return {};
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  async resume() {
    this.state = 'running';
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: new LocalStorageMock(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).BroadcastChannel = BroadcastChannelMock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).AudioContext = MockAudioContext;
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).localStorage = new LocalStorageMock();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).BroadcastChannel = BroadcastChannelMock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).AudioContext = MockAudioContext;
}
