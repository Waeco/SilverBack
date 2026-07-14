import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, ArrowLeft } from 'lucide-react'

export default function PaginaNoEncontrada() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="text-8xl font-black text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold text-texto-primary mb-2">Página no encontrada</h1>
        <p className="text-texto-muted mb-8">La página que buscas no existe o ha sido movida.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => window.history.back()} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Inicio
          </Link>
        </div>
      </motion.div>
    </div>
  )
}