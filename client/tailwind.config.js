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
                'miro-blue': '#2D9CDB',
                'miro-yellow': '#FFD02F',
            },
        },
    },
    plugins: [],
}
