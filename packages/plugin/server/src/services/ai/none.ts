/**
 * NoneProvider: the default when no provider is configured. Every method
 * throws a clear error — the admin UI surfaces this as "AI is not
 * configured; visit settings to enable it" rather than crashing.
 */
import type { AiProvider } from './types';

const ERR_NOT_CONFIGURED = 'AI builder is not configured. Set a provider in plugin settings.';

export class NoneProvider implements AiProvider {
  readonly id = 'none';
  async generateForm(): Promise<never> {
    throw new Error(ERR_NOT_CONFIGURED);
  }
  async refineForm(): Promise<never> {
    throw new Error(ERR_NOT_CONFIGURED);
  }
  async streamForm(): Promise<never> {
    throw new Error(ERR_NOT_CONFIGURED);
  }
  async streamStyle(): Promise<never> {
    throw new Error(ERR_NOT_CONFIGURED);
  }
  async healthCheck() {
    return { ok: false as const, error: ERR_NOT_CONFIGURED };
  }
}
