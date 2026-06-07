import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#0D1117',
          color: '#E8EDF5',
          border: '1px solid rgba(99,179,237,0.2)',
          borderRadius: '10px',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#00FF94', secondary: '#0D1117' } },
        error: { iconTheme: { primary: '#FF3B6B', secondary: '#0D1117' } },
      }}
    />
  </BrowserRouter>
)
