import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Griselda POS (del spec, Sección A.2)
        surface: '#FFFFFF',
        bg: '#F5F5F7',
        s2: '#F2F2F7',
        s3: '#E8E8ED',
        border: '#D1D1D6',
        text: {
          DEFAULT: '#1C1C1E',
          2: '#3A3A3C',
          3: '#636366',
          4: '#AEAEB2',
        },
        // Semánticos — mapean a las clases de Tailwind por defecto
        // blue-600 = #2563EB (acento principal)
        // green-600 = #16A34A (positivo / confirmación)
        // amber-600 = #D97706 (alerta / precios)
        // red-600   = #DC2626 (error / cancelación)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)',
      },
      // Safe area para iPhones con notch
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}

export default config
