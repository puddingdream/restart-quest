import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../styles/tokens.css';
import '../styles/app.css';

afterEach(() => {
  cleanup();
});

// axe-core uses a canvas to distinguish icon ligatures while evaluating text.
// jsdom does not implement that API without a native canvas dependency, so the
// test environment supplies only the deterministic operations axe-core needs.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(this: HTMLCanvasElement, contextId: string) {
    if (contextId !== '2d') {
      return null;
    }

    const pixels = new Uint8ClampedArray(30 * 30 * 4).fill(255);

    return {
      canvas: this,
      clearRect: () => undefined,
      fillText: () => undefined,
      getImageData: () => ({ data: pixels }),
      measureText: (text: string) => ({ width: Math.max(text.length, 1) * 30 }),
    } as unknown as CanvasRenderingContext2D;
  },
});
