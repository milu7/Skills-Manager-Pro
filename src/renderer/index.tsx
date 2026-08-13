import React from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { App } from './components/App';
import { initializeRendererI18n } from './i18n';
import { useWorkbenchStore } from './store';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Renderer root is missing');

void start();

async function start(): Promise<void> {
  try {
    const bootstrap = await window.workbench.app.bootstrap();
    await initializeRendererI18n(bootstrap.locale.resolvedLocale);
    useWorkbenchStore.getState().primeBootstrap(bootstrap);
  } catch {
    await initializeRendererI18n('zh-CN');
  }

  createRoot(container!).render(
    <React.StrictMode>
      <TooltipProvider delayDuration={350}>
        <App />
      </TooltipProvider>
    </React.StrictMode>
  );
}
