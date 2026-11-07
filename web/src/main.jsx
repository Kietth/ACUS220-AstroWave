import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/app.css';
import './styles/intro.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
