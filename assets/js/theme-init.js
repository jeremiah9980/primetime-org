/* Pre-paint theme init — prevents flash of wrong theme. Include inline in <head> ideally,
   but kept as an early-loaded script for simplicity in this static template. */
(function () {
  try {
    var stored = localStorage.getItem('pt-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
