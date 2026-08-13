import React from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { App } from './components/App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Renderer root is missing');

createRoot(container).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={350}>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
