import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function PaginaLogin() {
  const { iniciarSesion, estaAutenticado, error: errorContexto } = useAutenticacion()
  const navigate = useNavigate()

  useEffect(() => {
    if (estaAutenticado) navigate('/dashboard', { replace: true })
  }, [estaAutenticado, navigate])
  const [correo, setCorreo] = useState('juan@ejemplo.com')
  const [contrasena, setContrasena] = useState('test1234')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarContrasena, setMostrarContrasena] = useState(false)

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!correo.trim() || !contrasena.trim()) {
      setError('Correo y contraseña son requeridos')
      return
    }
    setCargando(true)
    setError(null)
    try {
      await iniciarSesion(correo, contrasena)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
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
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-lg">SB</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-texto-primary">SilverBack</h1>
              <p className="text-sm text-texto-muted">Nutrición Deportiva</p>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-texto-primary mb-6">Iniciar Sesión</h2>

          {(error || errorContexto) && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error || errorContexto}
            </div>
          )}

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarContrasena ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasena(!mostrarContrasena)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-muted hover:text-texto-secondary"
                >
                  {mostrarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {cargando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="text-center text-sm text-texto-muted mt-4">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-primary hover:text-primary-claro">Regístrate</Link>
          </p>

          <div className="mt-6 p-3 rounded-lg bg-base-claro/50 border border-gray-700/30">
            <p className="text-xs text-texto-muted text-center">
              Usuarios de prueba:
            </p>
            <div className="mt-2 space-y-1 text-xs text-texto-secondary">
              <p><span className="font-medium text-texto-primary">Atleta:</span> juan@ejemplo.com / test1234</p>
              <p><span className="font-medium text-texto-primary">Nutriólogo:</span> maria@ejemplo.com / test1234</p>
              <p><span className="font-medium text-texto-primary">Admin:</span> admin@silverback.com / admin1234</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
