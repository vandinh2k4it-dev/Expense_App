import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Chặn zoom bằng hai ngón trên iOS Safari (nhấn đúp đã chặn bằng CSS touch-action)
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault())
);

createRoot(document.getElementById('root')).render(<App />);
