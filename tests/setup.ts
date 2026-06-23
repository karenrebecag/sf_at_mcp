import { afterEach, beforeEach } from 'vitest';
import { clearDescribeCache } from '../src/services/describe.js';

beforeEach(() => {
  process.env.SF_FIXTURE_MODE = 'mock';
  clearDescribeCache();
});

afterEach(() => {
  clearDescribeCache();
});
