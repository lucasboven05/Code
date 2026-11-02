import type { Config } from 'tailwindcss';
import base from './tailwind.theme';
export default { ...base, content: ['./src/**/*.{ts,tsx}'] } satisfies Config;
