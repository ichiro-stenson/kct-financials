// KCT Financials — always light mode (business app, dark mode disabled)
document.documentElement.classList.remove('bp4-dark');
document.body.classList.remove('bp4-dark');
localStorage.setItem('theme', 'light');
