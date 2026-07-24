import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { registrarUsuario } from '../servicios/ApiServicio'
import CaptchaVerificacion from '../componentes/CaptchaVerificacion'
import ValidadorPassword from '../componentes/ValidadorPassword'
import { Loader2, User, Stethoscope, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function PaginaRegistro() {
  const { estaAutenticado } = useAutenticacion()
  const navigate = useNavigate()

  useEffect(() => {
    if (estaAutenticado) navigate('/dashboard', { replace: true })
  }, [estaAutenticado, navigate])
  const [rol, setRol] = useState('atleta')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cedula, setCedula] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarValidador, setMostrarValidador] = useState(false)
  const [verContrasena, setVerContrasena] = useState(false)
  const [verConfirmar, setVerConfirmar] = useState(false)
  const validadorRef = useRef(null)

  // Paso 1: formulario de registro. Paso 2: verificación con captcha.
  const [paso, setPaso] = useState(1)

  useEffect(() => {
    function handleClick(e) {
      if (validadorRef.current && !validadorRef.current.contains(e.target)) {
        setMostrarValidador(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const contrasenaCumpleRequisitos = (v) =>
    v.length >= 6 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v)

  const construirDatosRegistro = () => {
    const datos = { nombre_completo: nombre, correo, contrasena, rol }
    if (rol === 'nutriologo') {
      datos.cedula = cedula
    }
    return datos
  }

  const manejarEnvioFormulario = async (e) => {
    e.preventDefault()
    setError(null)

    if (!nombre.trim() || !correo.trim() || !contrasena.trim()) {
      setError('Todos los campos son requeridos')
      return
    }
    if (contrasena !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!contrasenaCumpleRequisitos(contrasena)) {
      setError('La contraseña no cumple todos los requisitos')
      return
    }

    setCargando(true)
    try {
      const respuesta = await registrarUsuario(construirDatosRegistro())
      if (respuesta.data.requiere_captcha) {
        setPaso(2)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar')
    } finally {
      setCargando(false)
    }
  }

  const manejarCaptchaVerificado = async (captchaToken) => {
    setCargando(true)
    setError(null)
    try {
      await registrarUsuario(construirDatosRegistro(), captchaToken)
      navigate(`/verificar-correo?correo=${encodeURIComponent(correo)}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar')
    } finally {
      setCargando(false)
    }
  }

  const volverAlPaso1 = () => {
    setPaso(1)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="tarjeta">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-texto-muted hover:text-texto-secondary mb-6">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-lg">SB</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-texto-primary">SilverBack</h1>
              <p className="text-sm text-texto-muted">{paso === 1 ? 'Crear cuenta' : 'Verificación en dos pasos'}</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">{error}</div>
          )}

          {paso === 1 && (
            <>
              <div className="flex gap-2 mb-6 p-1 rounded-lg bg-base-claro">
                <button
                  onClick={() => setRol('atleta')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                    rol === 'atleta' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-texto-muted hover:text-texto-primary'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Atleta
                </button>
                <button
                  onClick={() => setRol('nutriologo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                    rol === 'nutriologo' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-texto-muted hover:text-texto-primary'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Nutriólogo
                </button>
              </div>

              <form onSubmit={manejarEnvioFormulario} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Nombre completo</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="input" placeholder="correo@ejemplo.com" />
                </div>
                {rol === 'nutriologo' && (
                  <div>
                    <label className="block text-sm font-medium text-texto-secondary mb-1.5">Cédula profesional</label>
                    <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="input" placeholder="12345678" />
                  </div>
                )}
                <div ref={validadorRef} className="relative">
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={verContrasena ? 'text' : 'password'}
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      onFocus={() => setMostrarValidador(true)}
                      className="input pr-10"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setVerContrasena((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-muted hover:text-texto-primary"
                      tabIndex={-1}
                      aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <ValidadorPassword
                    valor={contrasena}
                    confirmar={confirmar}
                    visible={mostrarValidador}
                    onCerrar={() => setMostrarValidador(false)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={verConfirmar ? 'text' : 'password'}
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      className="input pr-10"
                      placeholder="Repite la contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setVerConfirmar((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-texto-muted hover:text-texto-primary"
                      tabIndex={-1}
                      aria-label={verConfirmar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={cargando} className="btn-primary w-full flex items-center justify-center gap-2">
                  {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {cargando ? 'Registrando...' : 'Crear Cuenta'}
                </button>
              </form>

              <p className="text-center text-sm text-texto-muted mt-4">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary hover:text-primary-claro">Inicia sesión</Link>
              </p>
            </>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-exito/10 border border-exito/20 text-sm text-texto-secondary">
                <ShieldCheck className="w-4 h-4 text-exito shrink-0" />
                Confirma que no eres un robot para completar tu registro.
              </div>

              <CaptchaVerificacion
                onVerificado={manejarCaptchaVerificado}
                onExpirado={() => setError('El captcha expiró, resuélvelo de nuevo.')}
              />

              {cargando && (
                <div className="flex items-center justify-center gap-2 text-sm text-texto-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando cuenta...
                </div>
              )}

              <button
                type="button"
                onClick={volverAlPaso1}
                disabled={cargando}
                className="text-sm text-texto-muted hover:text-primary transition-colors w-full text-center"
              >
                ← Volver
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
