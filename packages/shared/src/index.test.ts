import { describe, expect, it } from 'vitest';

// Smoke test proving the test runner works in CI; real tests arrive with the code.
describe('package entry point', () => {
  it('loads as a module', async () => {
    await expect(import('./index')).resolves.toBeDefined();
  });
});
