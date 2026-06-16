import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const saved = localStorage.getItem("theme") ?? "dark"
document.documentElement.classList.toggle("dark", saved === "dark")

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
