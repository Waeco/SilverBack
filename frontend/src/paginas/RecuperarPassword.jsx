import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react'

export default function RecuperarPassword() {
  const navigate = useNavigate()
  
  // Estados de control
  const [paso, setPaso] = useState(1) // Paso 1: Solicitar, Paso 2: Cambiar contraseña
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [mensajeExito, setMensajeExito] = useState(null)

  // Campos del formulario
  const [correo, setCorreo] = useState('')
  const [token, setToken] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')

  // Paso 1: Enviar correo al Backend
  const manejarSolicitud = async (e) => {
    e.preventDefault()
    if (!correo.trim()) {
      setError('Por favor introduce tu correo electrónico')
      return
    }
    setCargando(true)
    setError(null)

    try {
      const respuesta = await fetch('http://localhost:8000/api/recuperar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo })
      })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al solicitar la recuperación')
      }

      setMensajeExito('¡Código generado! Revisa tu bandeja de Gmail')
      setPaso(2) 
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // Paso 2: Enviar nueva contraseña y token al Backend
  const manejarCambio = async (e) => {
    e.preventDefault()
    if (!token.trim() || !nuevaContrasena.trim()) {
      setError('Todos los campos son obligatorios')
      return
    }
    setCargando(true)
    setError(null)

    try {
      const respuesta = await fetch('http://localhost:8000/api/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo,
          token,
          nueva_contrasena: nuevaContrasena
        })
      })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo actualizar la contraseña')
      }

      setMensajeExito('Contraseña cambiada con éxito. Redirigiendo al login...')
      setError(null)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.message)
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
          <div className="flex items-center gap-3 mb-6">
            <Link to="/login" className="p-1.5 rounded-lg hover:bg-base-claro text-texto-muted hover:text-texto-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-texto-primary">Recuperar Contraseña</h1>
              <p className="text-xs text-texto-muted">SilverBack - Soporte</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-emerald-400 text-sm mb-4 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {paso === 1 ? (
            <form onSubmit={manejarSolicitud} className="space-y-4">
              <p className="text-sm text-texto-secondary">
                Introduce tu correo electrónico registrado y te enviaremos las instrucciones para restablecer tu contraseña.
              </p>
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
                  required
                />
              </div>
              <button
                type="submit"
                disabled={cargando}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                {cargando ? 'Buscando usuario...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          ) : (
            <form onSubmit={manejarCambio} className="space-y-4">
              <div className="p-3 bg-base-claro/50 rounded-lg border border-gray-700/30 text-xs text-texto-secondary mb-2">
                <span className="font-semibold text-texto-primary">Instrucciones de prueba:</span> Revisar correos de spam<span className="text-primary font-mono font-bold">Token temporal</span> y pégalo aquí abajo.
              </div>

              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">
                  Token o Código de Verificación
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Pega el token de la consola"
                  className="input font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="input"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={cargando || mensajeExito?.includes('éxito')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                <KeyRound className="w-4 h-4" />
                Restablecer Contraseña
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}