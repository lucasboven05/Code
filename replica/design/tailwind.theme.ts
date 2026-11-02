// GENERATED from tokens.json by gen_tokens.py. Components use `bg-surface text-muted`, never raw hex.
import type { Config } from 'tailwindcss';
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
      'bg': 'var(--c-bg)',
      'surface': 'var(--c-surface)',
      'surface-2': 'var(--c-surface-2)',
      'border': 'var(--c-border)',
      'border-input': 'var(--c-border-input)',
      'text': 'var(--c-text)',
      'text-muted': 'var(--c-text-muted)',
      'accent': 'var(--c-accent)',
      'on-accent': 'var(--c-on-accent)',
      'accent-soft': 'var(--c-accent-soft)',
      'on-accent-soft': 'var(--c-on-accent-soft)',
      'danger': 'var(--c-danger)',
      'danger-soft': 'var(--c-danger-soft)',
      'success': 'var(--c-success)',
      'success-soft': 'var(--c-success-soft)',
      'warning': 'var(--c-warning)',
      'warning-soft': 'var(--c-warning-soft)',
      'chart-1': 'var(--c-chart-1)',
      'chart-2': 'var(--c-chart-2)',
      'chart-3': 'var(--c-chart-3)',
      'chart-4': 'var(--c-chart-4)',
      'chart-5': 'var(--c-chart-5)',
      'chart-6': 'var(--c-chart-6)',
        muted: 'var(--c-text-muted)'
      },
      fontFamily: { display: ['var(--font-display)'], body: ['var(--font-body)'] },
      fontSize: { 'xs': ['var(--fs-xs)', { lineHeight: 'var(--lh-xs)', fontWeight: 'var(--fw-xs)' }], 'sm': ['var(--fs-sm)', { lineHeight: 'var(--lh-sm)', fontWeight: 'var(--fw-sm)' }], 'md': ['var(--fs-md)', { lineHeight: 'var(--lh-md)', fontWeight: 'var(--fw-md)' }], 'lg': ['var(--fs-lg)', { lineHeight: 'var(--lh-lg)', fontWeight: 'var(--fw-lg)' }], 'xl': ['var(--fs-xl)', { lineHeight: 'var(--lh-xl)', fontWeight: 'var(--fw-xl)' }], '2xl': ['var(--fs-2xl)', { lineHeight: 'var(--lh-2xl)', fontWeight: 'var(--fw-2xl)' }] },
      borderRadius: { 'sm': 'var(--r-sm)', 'md': 'var(--r-md)', 'lg': 'var(--r-lg)', 'full': 'var(--r-full)' },
      boxShadow: { card: 'var(--shadow-card)', sheet: 'var(--shadow-sheet)' },
      maxWidth: { content: 'var(--content-max)' },
      transitionDuration: { fast: 'var(--dur-fast)', base: 'var(--dur-base)' },
      transitionTimingFunction: { DEFAULT: 'var(--ease)' },
    },
  },
} satisfies Partial<Config>;
