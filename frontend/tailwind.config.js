/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#0f172a',
          claro: '#1e293b',
        },
        card: {
          DEFAULT: '#1e293b',
          hover: '#334155',
        },
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          claro: '#60a5fa',
        },
        secondary: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
        },
        exito: '#10b981',
        error: '#ef4444',
        texto: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
