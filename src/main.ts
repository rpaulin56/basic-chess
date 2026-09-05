import './styles.css';
import { mountApp } from './ui/app.js';

const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app mancante in index.html');
mountApp(root);
