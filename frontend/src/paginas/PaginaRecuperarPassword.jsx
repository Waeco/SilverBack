import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { solicitarRecuperacion } from '../servicios/ApiServicio'

export default function PaginaRecuperarPassword() {
  const [correo, setCorreo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(false)

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setError(null)
    if (!correo.trim()) {
      setError('Ingresa tu correo electrónico')
      return
    }
    setCargando(true)
    try {
      await solicitarRecuperacion(correo)
      setEnviado(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al solicitar recuperación')
    } finally {
      setCargando(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="tarjeta text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-exito/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-exito" />
            </div>
            <h1 className="text-xl font-bold text-texto-primary mb-2">Correo enviado</h1>
            <p className="text-sm text-texto-secundario mb-6">
              Revisa tu bandeja de entrada <strong className="text-texto-primary">{correo}</strong>.
              Si el correo existe, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Link to="/login" className="btn-primary w-full inline-flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="tarjeta">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/login" className="p-1.5 rounded-lg hover:bg-base-claro text-texto-muted hover:text-texto-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-texto-primary">Recuperar Contraseña</h1>
              <p className="text-sm text-texto-muted">Te enviaremos un enlace a tu correo</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label htmlFor="recup-correo" className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-texto-muted" />
                <input
                  id="recup-correo"
                  name="correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@correo.com"
                  className="input pl-10"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {cargando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {cargando ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
