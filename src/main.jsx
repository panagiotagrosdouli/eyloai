import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initPreferences } from '@/lib/preferences'

// Apply saved display, language, and accessibility preferences before React renders.
initPreferences();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
