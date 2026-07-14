import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { registrarUsuario } from '../servicios/ApiServicio'
import { Loader2, User, Stethoscope, ArrowLeft } from 'lucide-react'
import ValidadorPassword, { passwordEsValida } from '../componentes/ValidadorPassword'

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

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setError(null)

    if (!nombre.trim() || !correo.trim() || !contrasena.trim()) {
      setError('Todos los campos son requeridos')
      return
    }
    if (!passwordEsValida(contrasena, confirmar)) {
      setError('La contraseña no cumple con todos los requisitos')
      return
    }

    setCargando(true)
    try {
      const datos = { nombre_completo: nombre, correo, contrasena, rol }
      if (rol === 'nutriologo') {
        datos.cedula = cedula
      }
      await registrarUsuario(datos)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar')
    } finally {
      setCargando(false)
    }
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
              <p className="text-sm text-texto-muted">Crear cuenta</p>
            </div>
          </div>

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

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">{error}</div>
          )}

          <form onSubmit={manejarEnvio} className="space-y-4">
            <div>
              <label htmlFor="reg-nombre" className="block text-sm font-medium text-texto-secondary mb-1.5">Nombre completo</label>
              <input id="reg-nombre" name="nombre_completo" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" placeholder="Tu nombre" />
            </div>
            <div>
              <label htmlFor="reg-correo" className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
              <input id="reg-correo" name="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="input" placeholder="correo@ejemplo.com" />
            </div>
            {rol === 'nutriologo' && (
              <div>
                <label htmlFor="reg-cedula" className="block text-sm font-medium text-texto-secondary mb-1.5">Cédula profesional</label>
                <input id="reg-cedula" name="cedula_profesional" type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="input" placeholder="12345678" />
              </div>
            )}
            <div ref={validadorRef}>
              <label htmlFor="reg-pass" className="block text-sm font-medium text-texto-secondary mb-1.5">Contraseña</label>
              <input id="reg-pass" name="contrasena" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} onFocus={() => setMostrarValidador(true)} className="input" placeholder="Mínimo 6 caracteres" />
              <ValidadorPassword
                valor={contrasena}
                confirmar={confirmar}
                visible={mostrarValidador}
                onCerrar={() => setMostrarValidador(false)}
              />
            </div>
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-texto-secondary mb-1.5">Confirmar contraseña</label>
              <input id="reg-confirm" name="confirmar_contrasena" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="input" placeholder="Repite la contraseña" />
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
