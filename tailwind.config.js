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
  			'background': '#FFF8E7',
  			'foreground': '#000000',
  			'muted-foreground': '#555555',
  			'primary': {
  				DEFAULT: '#E3735E',
  				foreground: '#FFFFFF',
  				hover: '#D1604A',
  			},
  			'secondary': {
  				DEFAULT: '#F3F4F6',
  				foreground: '#1F2937',
  				hover: '#E5E7EB',
  			},
  			'accent': {
  				DEFAULT: '#E3735E',
  				foreground: '#FFFFFF',
  			},
  			'destructive': {
  				DEFAULT: '#EF4444',
  				foreground: '#FFFFFF',
  			},
  			'border': '#D1D5DB',
  			'input': '#FFF8E7',
  			'input-border': '#CBD5E1',
  			'ring': '#E3735E',
  			'card': {
  				DEFAULT: 'rgba(255, 248, 231, 0.65)',
  				foreground: '#000000',
  				border: 'rgba(0, 0, 0, 0.05)',
  			},
  			'popover': {
  				DEFAULT: 'rgba(255, 248, 231, 0.75)',
  				foreground: '#000000',
  				border: 'rgba(0, 0, 0, 0.07)',
  			},
  			'dark-background': '#18181B',
  			'dark-foreground': '#E4E4E7',
  			'dark-muted-foreground': '#A1A1AA',
  			'dark-primary': {
  				DEFAULT: '#E3735E',
  				foreground: '#FFFFFF',
  				hover: '#D1604A',
  			},
  			'dark-secondary': {
  				DEFAULT: '#27272A',
  				foreground: '#E4E4E7',
  				hover: '#3F3F46',
  			},
  			'dark-border': '#3A3A3C',
  			'dark-input': '#27272A',
  			'dark-input-border': '#52525B',
  			'dark-ring': '#E3735E',
  			'dark-card': {
  				DEFAULT: 'rgba(24, 24, 27, 0.65)',
  				foreground: '#E4E4E7',
  				border: 'rgba(255, 255, 255, 0.05)',
  			},
  			'dark-popover': {
  				DEFAULT: 'rgba(24, 24, 27, 0.75)',
  				foreground: '#E4E4E7',
  				border: 'rgba(255, 255, 255, 0.07)',
  			},
  			'text-primary': '#000000',
  			'dark-text-primary': '#F9FAFB',
  			'text-secondary': '#333333',
  			'dark-text-secondary': '#D1D5DB',
  			'text-tertiary': '#555555',
  			'dark-text-tertiary': '#9CA3AF',
  			'text-placeholder': '#6B7280',
  			'dark-text-placeholder': '#9CA3AF',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			'primary-hover': '#D1604A',
  			'secondary-hover': '#E5E7EB',
  			'dark-primary-hover': '#D1604A',
  			'dark-secondary-hover': '#3F3F46',
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		borderRadius: {
  			DEFAULT: '0.5rem',
  			sm: '0.25rem',
  			md: '0.375rem',
  			lg: '0.75rem',
  			xl: '1rem',
  			'2xl': '1.5rem',
  			full: '9999px',
  		},
  		boxShadow: {
  			'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  			DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  			'md': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  			'lg': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  			'xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  			'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  			'none': 'none',
  			'dark-sm': '0 1px 2px 0 rgb(255 255 255 / 0.03)',
  			'dark': '0 4px 6px -1px rgb(255 255 255 / 0.05), 0 2px 4px -2px rgb(255 255 255 / 0.05)',
  			'dark-md': '0 10px 15px -3px rgb(255 255 255 / 0.05), 0 4px 6px -4px rgb(255 255 255 / 0.05)',
  			'dark-lg': '0 20px 25px -5px rgb(255 255 255 / 0.05), 0 8px 10px -6px rgb(255 255 255 / 0.05)',
  			'dark-xl': '0 25px 50px -12px rgb(255 255 255 / 0.15)',
  			'dark-inner': 'inset 0 2px 4px 0 rgb(255 255 255 / 0.03)',
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
  		},
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.foreground'),
            '--tw-prose-headings': theme('colors.foreground'),
            '--tw-prose-lead': theme('colors.muted-foreground'),
            '--tw-prose-links': theme('colors.primary.DEFAULT'),
            '--tw-prose-bold': theme('colors.foreground'),
            '--tw-prose-counters': theme('colors.muted-foreground'),
            '--tw-prose-bullets': theme('colors.muted-foreground'),
            '--tw-prose-hr': theme('colors.border'),
            '--tw-prose-quotes': theme('colors.foreground'),
            '--tw-prose-quote-borders': theme('colors.primary.DEFAULT'),
            '--tw-prose-captions': theme('colors.muted-foreground'),
            '--tw-prose-code': theme('colors.foreground'),
            '--tw-prose-pre-code': theme('colors.foreground'), // Text color inside code blocks
            '--tw-prose-pre-bg': theme('colors.secondary.DEFAULT'), // Background of code blocks
            '--tw-prose-th-borders': theme('colors.border'),
            '--tw-prose-td-borders': theme('colors.border'),
            '--tw-prose-invert-body': theme('colors.dark-foreground'),
            '--tw-prose-invert-headings': theme('colors.dark-foreground'),
            '--tw-prose-invert-lead': theme('colors.dark-muted-foreground'),
            '--tw-prose-invert-links': theme('colors.dark-primary.DEFAULT'),
            '--tw-prose-invert-bold': theme('colors.dark-foreground'),
            '--tw-prose-invert-counters': theme('colors.dark-muted-foreground'),
            '--tw-prose-invert-bullets': theme('colors.dark-muted-foreground'),
            '--tw-prose-invert-hr': theme('colors.dark-border'),
            '--tw-prose-invert-quotes': theme('colors.dark-foreground'),
            '--tw-prose-invert-quote-borders': theme('colors.dark-primary.DEFAULT'),
            '--tw-prose-invert-captions': theme('colors.dark-muted-foreground'),
            '--tw-prose-invert-code': theme('colors.dark-foreground'), 
            '--tw-prose-invert-pre-code': theme('colors.dark-foreground'), // Text color inside dark code blocks
            '--tw-prose-invert-pre-bg': theme('colors.dark-secondary.DEFAULT'), // Background of dark code blocks
            '--tw-prose-invert-th-borders': theme('colors.dark-border'),
            '--tw-prose-invert-td-borders': theme('colors.dark-border'),
            // Customize link hover color if needed
            a: {
              '&:hover': {
                color: theme('colors.primary.hover'),
              },
            },
            // Customize inverted link hover color
            '.dark a': { // This targets links inside .dark specifically, if prose-invert doesn't cover it
              '&:hover': {
                color: theme('colors.dark-primary.hover'),
              },
            },
            // Ensure code blocks have some padding and a subtle border
            pre: {
              borderColor: theme('colors.border'),
              borderWidth: '1px',
            },
            '.dark pre': {
              borderColor: theme('colors.dark-border'),
            },
          },
        },
      }),
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography'),
  ],
}
