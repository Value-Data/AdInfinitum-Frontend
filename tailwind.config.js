/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        'primary-lighter': 'var(--color-primary-lighter)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        'warning-text': 'var(--color-warning-text)',
        surface: 'var(--color-surface)',
        'app-bg': 'var(--color-bg)',
        'text-main': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        'na-bg': 'var(--color-na-bg)',
        'na-text': 'var(--color-na-text)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      boxShadow: {
        card: 'var(--shadow)',
        'card-lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
