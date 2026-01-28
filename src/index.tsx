import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';
import './index.css';
import './utils/i18n';
import logger from "./utils/logger";

const container = document.getElementById('root')!;
const root = createRoot(container);
logger.info('App', 'VITE_APP_VERSION', import.meta.env.VITE_APP_VERSION);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
