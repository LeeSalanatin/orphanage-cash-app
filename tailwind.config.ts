import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Inter', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--text-main)',
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-main)',
        },
        popover: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-main)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--surface-hover)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--active-highlight)',
          foreground: 'var(--active-highlight-text)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: '#ffffff',
        },
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--primary)',
        chart: {
          '1': 'var(--primary)',
          '2': 'secondary',
          '3': 'accent',
          '4': 'muted',
          '5': 'success',
        },
        sidebar: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-main)',
          primary: 'var(--primary)',
          'primary-foreground': '#ffffff',
          accent: 'var(--surface-hover)',
          'accent-foreground': 'var(--text-main)',
          border: 'var(--border)',
          ring: 'var(--primary)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;