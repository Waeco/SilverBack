import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { cambiarPassword } from '../servicios/ApiServicio'
import ValidadorPassword, { passwordEsValida } from '../componentes/ValidadorPassword'

export default function PaginaRestablecerPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const correo = searchParams.get('correo')

  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)
  const [mostrarPass, setMostrarPass] = useState(false)
  const [mostrarValidador, setMostrarValidador] = useState(false)
  const validadorRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (validadorRef.current && !validadorRef.current.contains(e.target)) {
        setMostrarValidador(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!token || !correo) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="tarjeta max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <h1 className="text-xl font-bold text-texto-primary mb-2">Enlace inválido</h1>
          <p className="text-sm text-texto-secundario mb-6">El enlace de restablecimiento no es válido o falta información.</p>
          <Link to="/recuperar-password" className="btn-primary inline-flex items-center gap-2">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    )
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setError(null)
    if (!passwordEsValida(nuevaContrasena, confirmar)) {
      setError('La contraseña no cumple con todos los requisitos')
      return
    }
    setCargando(true)
    try {
      await cambiarPassword(correo, token, nuevaContrasena)
      setExito(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al restablecer la contraseña')
    } finally {
      setCargando(false)
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="tarjeta text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-exito/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-exito" />
            </div>
            <h1 className="text-xl font-bold text-texto-primary mb-2">Contraseña actualizada</h1>
            <p className="text-sm text-texto-secundario mb-6">Tu contraseña se ha restablecido correctamente. Ya puedes iniciar sesión.</p>
            <Link to="/login" className="btn-primary w-full inline-flex items-center justify-center gap-2">
              Iniciar sesión
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
          <div className="mb-6">
            <h1 className="text-xl font-bold text-texto-primary">Restablecer Contraseña</h1>
            <p className="text-sm text-texto-muted mt-1">Ingresa tu nueva contraseña para <strong className="text-texto-secondary">{correo}</strong></p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div ref={validadorRef} className="relative">
              <label htmlFor="res-pass" className="block text-sm font-medium text-texto-secondary mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  id="res-pass"
                  name="nueva_contrasena"
                  type={mostrarPass ? 'text' : 'password'}
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  onFocus={() => setMostrarValidador(true)}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMostrarPass(!mostrarPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-muted hover:text-texto-secondary"
                >
                  {mostrarPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <ValidadorPassword
                valor={nuevaContrasena}
                confirmar={confirmar}
                visible={mostrarValidador}
                onCerrar={() => setMostrarValidador(false)}
              />
            </div>

            <div>
              <label htmlFor="res-confirm" className="block text-sm font-medium text-texto-secondary mb-1.5">Confirmar contraseña</label>
              <input
                id="res-confirm"
                name="confirmar_contrasena"
                type={mostrarPass ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="input"
                placeholder="Repite la contraseña"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
              {cargando ? 'Restableciendo...' : 'Restablecer Contraseña'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
