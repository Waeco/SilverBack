import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, MailCheck } from 'lucide-react'
import { verificarCorreo, reenviarCodigoVerificacion } from '../servicios/ApiServicio'

const SEGUNDOS_ESPERA_REENVIO = 30

export default function PaginaVerificarCorreo() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const correo = searchParams.get('correo') || ''

  const [codigo, setCodigo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)
  const [mensajeReenvio, setMensajeReenvio] = useState(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const intervaloRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [])

  const iniciarConteoReenvio = () => {
    setSegundosRestantes(SEGUNDOS_ESPERA_REENVIO)
    intervaloRef.current = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1) {
          clearInterval(intervaloRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  if (!correo) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="tarjeta max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-texto-primary mb-2">Falta el correo</h1>
          <p className="text-sm text-texto-secundario mb-6">No se especificó qué correo verificar.</p>
          <Link to="/registro" className="btn-primary inline-flex items-center gap-2">
            Volver a registro
          </Link>
        </div>
      </div>
    )
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setError(null)
    if (codigo.trim().length !== 6) {
      setError('El código debe tener 6 dígitos')
      return
    }
    setCargando(true)
    try {
      await verificarCorreo(correo, codigo.trim())
      setExito(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al verificar el código')
    } finally {
      setCargando(false)
    }
  }

  const manejarReenvio = async () => {
    setError(null)
    setMensajeReenvio(null)
    try {
      const respuesta = await reenviarCodigoVerificacion(correo)
      setMensajeReenvio(respuesta.data.mensaje || 'Se envió un nuevo código.')
      iniciarConteoReenvio()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reenviar el código')
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
            <h1 className="text-xl font-bold text-texto-primary mb-2">Correo verificado</h1>
            <p className="text-sm text-texto-secundario mb-6">Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesión.</p>
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
          <div className="mb-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MailCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-texto-primary">Verifica tu correo</h1>
            <p className="text-sm text-texto-muted mt-1">
              Enviamos un código de 6 dígitos a <strong className="text-texto-secondary">{correo}</strong>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error}
            </div>
          )}
          {mensajeReenvio && !error && (
            <div className="p-3 rounded-lg bg-exito/10 border border-exito/20 text-exito text-sm mb-4">
              {mensajeReenvio}
            </div>
          )}

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className="input text-center tracking-[0.5em] text-lg font-semibold"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
              {cargando ? 'Verificando...' : 'Verificar correo'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              onClick={manejarReenvio}
              disabled={segundosRestantes > 0}
              className="text-sm text-texto-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {segundosRestantes > 0
                ? `Reenviar código (${segundosRestantes}s)`
                : 'Reenviar código'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
