/**
 * Hand-curated "vibes" — internally consistent ThemeConfig presets used by:
 *   1. The "I'm feeling lucky" button in the Style panel (random pick).
 *   2. (Future) The style AI's constrained output vocabulary (intent-driven pick).
 *
 * Each vibe = a base preset + opinionated overrides. Kept short so adding a
 * new one is easy: tune until it looks good standalone, give it a memorable
 * name, ship it.
 */
import type { ThemeConfig } from './themes';

export type Vibe = {
  id: string;
  name: string;
  description: string;
  theme: ThemeConfig;
};

export const VIBES: Vibe[] = [
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'Warm cream backdrop, brown accents, calm and inviting.',
    theme: {
      preset: 'editorial',
      primaryColor: '#5b3a29',
      backgroundColor: '#f8f2ea',
      textColor: '#2b1d14',
      borderRadius: 'md',
      fontFamily: 'serif',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'outline',
      buttonStyle: 'filled',
      fieldSpacing: 'relaxed',
      formWidth: 'normal',
      formPadding: 'spacious',
      shadow: false,
    },
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Sharp corners, heavy borders, no nonsense.',
    theme: {
      preset: 'bold',
      primaryColor: '#000000',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderRadius: 'none',
      fontFamily: 'mono',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'outline',
      buttonStyle: 'filled',
      buttonBorderColor: '#000000',
      buttonBorderWidth: 'thick',
      buttonBold: true,
      fieldSpacing: 'normal',
      formWidth: 'normal',
      formPadding: 'normal',
      shadow: false,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Coral and rose, soft and rounded.',
    theme: {
      preset: 'friendly',
      primaryColor: '#f06292',
      backgroundColor: '#fff5f0',
      textColor: '#2e1f29',
      borderRadius: 'lg',
      fontFamily: 'sans',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'filled',
      buttonStyle: 'filled',
      buttonBold: true,
      fieldSpacing: 'relaxed',
      formWidth: 'normal',
      formPadding: 'spacious',
      shadow: true,
    },
  },
  {
    id: 'lab-coat',
    name: 'Lab coat',
    description: 'Clinical white, blue accents, tight grid.',
    theme: {
      preset: 'clean',
      primaryColor: '#0066cc',
      backgroundColor: '#ffffff',
      textColor: '#1a1a2e',
      borderRadius: 'sm',
      fontFamily: 'sans',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'outline',
      buttonStyle: 'filled',
      fieldSpacing: 'compact',
      formWidth: 'narrow',
      formPadding: 'normal',
      shadow: false,
    },
  },
  {
    id: 'zine',
    name: '90s zine',
    description: 'High contrast, mono, punchy yellow.',
    theme: {
      preset: 'bold',
      primaryColor: '#ffd400',
      backgroundColor: '#111111',
      textColor: '#ffffff',
      borderRadius: 'none',
      fontFamily: 'mono',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'underline',
      buttonStyle: 'filled',
      buttonBold: true,
      fieldSpacing: 'normal',
      formWidth: 'normal',
      formPadding: 'normal',
      shadow: false,
    },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft mauve, airy spacing, generous rounding.',
    theme: {
      preset: 'friendly',
      primaryColor: '#9a85c4',
      backgroundColor: '#f5f0fa',
      textColor: '#3a2e4d',
      borderRadius: 'lg',
      fontFamily: 'sans',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'filled',
      buttonStyle: 'filled',
      fieldSpacing: 'relaxed',
      formWidth: 'normal',
      formPadding: 'spacious',
      shadow: false,
    },
  },
  {
    id: 'neon',
    name: 'Neon arcade',
    description: 'Dark mode, lime accents, glow on focus.',
    theme: {
      preset: 'bold',
      primaryColor: '#39ff14',
      backgroundColor: '#0a0a14',
      textColor: '#e8ffe5',
      borderRadius: 'sm',
      fontFamily: 'mono',
      fontScale: 'md',
      labelPosition: 'above',
      inputStyle: 'outline',
      buttonStyle: 'filled',
      buttonBold: true,
      fieldSpacing: 'normal',
      formWidth: 'normal',
      formPadding: 'normal',
      shadow: true,
    },
  },
  {
    id: 'editorial',
    name: 'Editorial luxe',
    description: 'Refined serif, hairline borders, generous whitespace.',
    theme: {
      preset: 'editorial',
      primaryColor: '#1a1a2e',
      backgroundColor: '#fdfcf8',
      textColor: '#1a1a2e',
      borderRadius: 'none',
      fontFamily: 'serif',
      fontScale: 'lg',
      labelPosition: 'above',
      inputStyle: 'underline',
      buttonStyle: 'outline',
      fieldSpacing: 'relaxed',
      formWidth: 'narrow',
      formPadding: 'spacious',
      shadow: false,
    },
  },
];

const VIBE_BY_ID: Record<string, Vibe> = Object.fromEntries(VIBES.map((v) => [v.id, v]));

export const getVibe = (id: string): Vibe | undefined => VIBE_BY_ID[id];

/** Picks a random vibe that's not the one currently applied (avoids "lucky" returning the same vibe twice in a row). */
export const pickRandomVibe = (excludeId?: string): Vibe => {
  const pool = excludeId ? VIBES.filter((v) => v.id !== excludeId) : VIBES;
  return pool[Math.floor(Math.random() * pool.length)];
};
