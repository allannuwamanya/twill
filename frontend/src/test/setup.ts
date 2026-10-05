import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The Wails runtime is only present inside the webview. Stores under test call
// through wailsBridge, which reaches for `window.go` and `window.runtime`.
vi.stubGlobal('runtime', {
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
});

vi.stubGlobal('go', {});