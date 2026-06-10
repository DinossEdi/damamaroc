// main.js - Entry point for Moroccan Dama Web Application
import './style.css';
import { ui } from './ui.js';

// Safe initialization of the UI after DOM content has parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ui.init());
} else {
  ui.init();
}
