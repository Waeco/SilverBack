import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { registrarUsuario } from '../servicios/ApiServicio'
import { Loader2, User, Stethoscope, ArrowLeft } from 'lucide-react'
import ReCAPTCHA from 'react-google-recaptcha' // <--- IMPORTACIÓN DE RECAPTCHA

export default function PaginaRegistro() {
  const { estaAutenticado } = useAutenticacion()
  const navigate = useNavigate()

  useEffect(() => {
    if (estaAutenticado) navigate('/dashboard', { replace: true })  }, [estaAutenticado, navigate])

  const [rol, setRol] = useState('atleta')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cedula, setCedula] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  
  // 🤖 ESTADOS Y REF PARA EL CAPTCHA
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)

  const manejarCambioCaptcha = (token) => {
    setCaptchaToken(token) // Se guarda el token cuando marcan "No soy un robot"
  }

  const manejarEnvio = async (e) => {
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
    if (contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    
    // 🤖 VALIDACIÓN VISUAL ANTES DE MANDAR AL BACKEND
    if (!captchaToken) {
      setError('Por favor, completa el Captcha para demostrar que no eres un robot.')
      return
    }

    setCargando(true)

    try {
      // Mandamos todos los campos incluyendo el token del captcha
      await registrarUsuario({
        rol,
        nombre_completo: nombre,
        correo,
        contrasena,
        cedula_profesional: rol === 'nutriologo' ? cedula : null,
        captcha_token: captchaToken // <--- NUEVO CAMPO ENVIADO AL BACKEND
      })
      
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al registrar usuario')
      
      // 🤖 SI EL REGISTRO FALLA, REINICIAMOS EL CAPTCHA POR SEGURIDAD
      if (captchaRef.current) {
        captchaRef.current.reset()
      }
      setCaptchaToken(null)
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
              <h1 className="text-xl font-bold text-texto-primary">Crear Cuenta</h1>
              <p className="text-sm text-texto-muted">Únete a SilverBack</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex p-1 bg-base-claro rounded-lg mb-6">
            <button
              type="button"
              onClick={() => { setRol('atleta'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all
                ${rol === 'atleta' ? 'bg-card text-primary shadow-sm' : 'text-texto-muted hover:text-texto-secondary'}`}
            >
              <User className="w-4 h-4" />
              Atleta
            </button>
            <button
              type="button"
              onClick={() => { setRol('nutriologo'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all
                ${rol === 'nutriologo' ? 'bg-card text-primary shadow-sm' : 'text-texto-muted hover:text-texto-secondary'}`}
            >
              <Stethoscope className="w-4 h-4" />
              Nutriólogo
            </button>
          </div>

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">Nombre completo</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="input" placeholder="juan@ejemplo.com" />
            </div>
            {rol === 'nutriologo' && (
              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">Cédula profesional</label>
                <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="input" placeholder="12345678" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">Contraseña</label>
              <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} className="input" placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto-secondary mb-1.5">Confirmar contraseña</label>
              <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="input" placeholder="Repite la contraseña" />
            </div>

            {/* 🤖 CASILLA DE RECAPTCHA EN TEMA OSCURO */}
            <div className="flex justify-center py-2">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey="6Lf35TEtAAAAAEQ1JX_Ez4hgdPrw58_OszpXPV_5" // <--- CAMBIA ESTO por tu clave pública de Google Admin
                onChange={manejarCambioCaptcha}
                theme="dark"
              />
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
        </div>
      </motion.div>
    </div>
  )
}