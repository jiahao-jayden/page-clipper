import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/assets/tailwind.css'

const container = document.getElementById('root')
if (!container) throw new Error('popup root element not found')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
