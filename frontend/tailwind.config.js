// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: [
	  "./index.html",
	  "./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
	  extend: {
		borderRadius: {
		  lg: 'var(--radius)',
		  md: 'calc(var(--radius) - 2px)',
		  sm: 'calc(var(--radius) - 4px)'
		},
		keyframes: {
		  "accordion-down": {
			from: { height: "0" },
			to: { height: "var(--radix-accordion-content-height)" },
		  },
		  "accordion-up": {
			from: { height: "var(--radix-accordion-content-height)" },
			to: { height: "0" },
		  },
		  "collapsible-down": {
			from: { height: "0" },
			to: { height: "var(--radix-collapsible-content-height)" },
		  },
		  "collapsible-up": {
			from: { height: "var(--radix-collapsible-content-height)" },
			to: { height: "0" },
		  },
		},
		animation: {
		  "accordion-down": "accordion-down 0.2s ease-out",
		  "accordion-up": "accordion-up 0.2s ease-out",
		  "collapsible-down": "collapsible-down 0.2s ease-out",
		  "collapsible-up": "collapsible-up 0.2s ease-out",
		},
	  },
	},
	plugins: [require("tailwindcss-animate")]
  }