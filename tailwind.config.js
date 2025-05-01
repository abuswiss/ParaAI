/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			surface: {
  				DEFAULT: '#1E1E1E',
  				lighter: '#2A2A2A',
  				darker: '#181818'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				hover: '#E8917F',
  				light: 'rgba(242, 164, 148, 0.15)',
  				border: 'rgba(242, 164, 148, 0.3)',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			text: {
  				primary: '#FFFFFF',
  				secondary: '#CCCCCC',
  				tertiary: '#999999',
  				disabled: '#666666'
  			},
  			gray: {
  				'700': '#2A2A2A',
  				'800': '#1E1E1E',
  				'900': '#181818'
  			},
  			success: '#4CAF50',
  			error: '#F44336',
  			warning: '#FF9800',
  			info: '#2196F3',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		borderRadius: {
  			DEFAULT: '8px',
  			lg: 'var(--radius)',
  			xl: '16px',
  			full: '9999px',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			card: '0 4px 6px rgba(0, 0, 0, 0.1)',
  			popup: '0 8px 16px rgba(0, 0, 0, 0.2)',
  			'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)'
  		},
  		animation: {
  			pulse: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			fadeIn: 'fadeIn 0.3s ease-in-out',
  			fadeOut: 'fadeOut 0.3s ease-in-out',
  			slideUp: 'slideUp 0.3s ease-in-out',
  			slideDown: 'slideDown 0.3s ease-in-out',
  			typing: 'typing 1.2s steps(3) infinite'
  		},
  		keyframes: {
  			pulse: {
  				'0%, 100%': {
  					opacity: 1
  				},
  				'50%': {
  					opacity: 0.3
  				}
  			},
  			fadeIn: {
  				'0%': {
  					opacity: 0
  				},
  				'100%': {
  					opacity: 1
  				}
  			},
  			fadeOut: {
  				'0%': {
  					opacity: 1
  				},
  				'100%': {
  					opacity: 0
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(20px)',
  					opacity: 0
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: 1
  				}
  			},
  			slideDown: {
  				'0%': {
  					transform: 'translateY(-20px)',
  					opacity: 0
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: 1
  				}
  			},
  			typing: {
  				'0%': {
  					content: '"'
  				},
  				'33%': {
  					content: '."'
  				},
  				'66%': {
  					content: '.."'
  				},
  				'100%': {
  					content: '..."'
  				}
  			}
  		},
  		transitionDelay: {
  			'0': '0ms',
  			'100': '100ms',
  			'200': '200ms',
  			'300': '300ms'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
