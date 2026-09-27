/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          void: '#030508',
          black: '#05070a',
          dark: '#0b0e15',
          card: '#10131a',
          'card-hover': '#161b26',
          border: '#1a2234',
          'border-bright': '#24324d',
          cyan: '#06b6d4',
          'cyan-bright': '#4cd7f6',
          'cyan-deep': '#083344',
          purple: '#a855f7',
          'purple-light': '#ddb7ff',
          'purple-deep': '#3b0764',
          green: '#10b981',
          'green-bright': '#34d399',
          amber: '#f59e0b',
          'amber-bright': '#fbbf24',
          red: '#ef4444',
          'red-bright': '#f87171',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        headline: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 16px -2px rgba(6, 182, 212, 0.4), inset 0 0 8px rgba(6, 182, 212, 0.15)',
        'glow-cyan-sm': '0 0 10px -2px rgba(6, 182, 212, 0.35)',
        'glow-cyan-lg': '0 0 30px -4px rgba(6, 182, 212, 0.5), 0 0 10px rgba(76, 215, 246, 0.3)',
        'glow-purple': '0 0 16px -2px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.15)',
        'glow-green': '0 0 16px -2px rgba(16, 185, 129, 0.4), inset 0 0 8px rgba(16, 185, 129, 0.15)',
        'glow-amber': '0 0 16px -2px rgba(245, 158, 11, 0.4), inset 0 0 8px rgba(245, 158, 11, 0.15)',
        'glow-red': '0 0 20px -2px rgba(239, 68, 68, 0.45), inset 0 0 8px rgba(239, 68, 68, 0.15)',
        'quantum': '0 12px 32px 0 rgba(0, 0, 0, 0.8), 0 0 24px -4px rgba(6, 182, 212, 0.2)',
      },
      transitionTimingFunction: {
        'out-quick': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-smooth': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(180deg, #0b0e15 0%, #05070a 100%)',
        'cyber-gradient-card': 'linear-gradient(135deg, rgba(16, 19, 26, 0.95) 0%, rgba(11, 14, 21, 0.9) 100%)',
        'cyber-radial': 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.04) 0%, rgba(5, 7, 10, 0.98) 100%)',
      },
    },
  },
  plugins: [],
}

