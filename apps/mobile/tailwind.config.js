/**
 * NativeWind config — Tempo Flow design tokens for mobile.
 * @source docs/design/v3/tokens.css (v3 palette); the older named colours stay for screens not yet ported.
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#131312',
        cream: '#F3EBE2',
        'cream-raised': '#FAF6F0',
        'cream-deep': '#EBE0D2',
        'tempo-orange': '#D97757',
        'soft-orange': '#E8A87C',
        'dust-grey': '#6B6864',
        'dust-grey-soft': '#9A968F',
        line: '#D7CEC2',
        'line-soft': '#E6DDD1',
        moss: '#4A7C59',
        brick: '#C8553D',
        amber: '#D4A44C',
        'slate-blue': '#6E88A7',

        // v3 palette (docs/design/v3/tokens.css; mirrored in packages/ui/src/theme/tokens.ts).
        ground: '#F3EEE4',
        paper: '#FBF9F4',
        sunken: '#EAE3D6',
        hover: '#EDE6DA',
        'ink-muted': '#57514A',
        'ink-subtle': '#6B645C',
        'line-strong': '#B9AE9C',
        'line-control': '#877C6B',
        done: '#3B6948',
        info: '#36628C',
        caution: '#7E5A0C',
        danger: '#9E3B27',

        // Semantic aliases: the same mapping as the web's globals.css (v3 tokens).
        background: '#F3EEE4',
        foreground: '#1B1916',
        card: '#FBF9F4',
        'card-foreground': '#1B1916',
        border: '#D9D0C1',
        'border-soft': '#D9D0C1',
        primary: '#A3461F',
        'primary-foreground': '#FBF9F4',
        muted: '#EAE3D6',
        'muted-foreground': '#57514A',
        accent: '#EDE6DA',
        destructive: '#9E3B27',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        dyslexia: ['OpenDyslexic', 'Newsreader', 'serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
};
