/* Primetime nav: active-link highlighting + accessible light/dark toggle. */
document.addEventListener('DOMContentLoaded', function () {
  var path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.pt-links a, .pt-dropdown-menu a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && href.split('/').pop() === path) a.classList.add('active');
  });

  var toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function render() {
    var t = currentTheme();
    toggle.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
    var label = toggle.querySelector('.theme-toggle-label');
    if (label) label.textContent = t === 'light' ? 'Light' : 'Dark';
    var icon = toggle.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = t === 'light' ? '☀️' : '🌙';
  }
  render();

  toggle.addEventListener('click', function () {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('pt-theme', next); } catch (e) {}
    render();
  });
});
