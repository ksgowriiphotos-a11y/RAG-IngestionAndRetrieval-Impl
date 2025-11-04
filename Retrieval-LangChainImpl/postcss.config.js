module.exports = {
  plugins: {
    'postcss-import': {},
    // Use tailwind's PostCSS wrapper package to avoid the "use tailwindcss directly" error
    '@tailwindcss/postcss': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
}