/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#FF4500', // OrangeRed - Fast Food Vibe
                secondary: '#FFA500', // Orange
                dark: '#1a1a1a',
            }
        },
    },
    plugins: [],
}
