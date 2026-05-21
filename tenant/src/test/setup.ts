import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-cleanup between tests so DOM doesn't leak across cases.
afterEach(() => {
  cleanup();
});
