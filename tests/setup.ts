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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: new LocalStorageMock(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).BroadcastChannel = BroadcastChannelMock;
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).localStorage = new LocalStorageMock();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).BroadcastChannel = BroadcastChannelMock;
}
