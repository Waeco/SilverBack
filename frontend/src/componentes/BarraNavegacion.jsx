import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import {
  urlFotoPerfil, obtenerMensajesNoLeidos, obtenerSolicitudesPendientesCount,
  obtenerNotificaciones, obtenerNotificacionesNoLeidas, marcarNotificacionLeida, marcarNotificacionesLeidas,
} from '../servicios/ApiServicio'
import {
  LayoutDashboard, Utensils, CalendarDays, User, Stethoscope,
  Users, Shield, Menu, X, LogOut, Dumbbell, ClipboardEdit, MessageCircle, Bell, CheckCheck,
} from 'lucide-react'

function obtenerEnlaces(rol) {
  const comunes = [
    { a: '/dashboard', etiqueta: 'Dashboard', icono: LayoutDashboard },
  ]
  if (rol === 'atleta') {
    return [
      ...comunes,
      { a: '/dieta', etiqueta: 'Dieta', icono: Utensils },
      { a: '/rutina', etiqueta: 'Rutina', icono: Dumbbell },
      { a: '/citas', etiqueta: 'Citas', icono: CalendarDays },
      { a: '/mensajes', etiqueta: 'Mensajes', icono: MessageCircle },
      { a: '/nutriologos', etiqueta: 'Nutriólogos', icono: Stethoscope },
      { a: '/historial', etiqueta: 'Historial Médico', icono: ClipboardEdit },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  if (rol === 'nutriologo') {
    return [
      ...comunes,
      { a: '/citas', etiqueta: 'Citas', icono: CalendarDays },
      { a: '/pacientes', etiqueta: 'Pacientes', icono: Users },
      { a: '/mensajes', etiqueta: 'Mensajes', icono: MessageCircle },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  if (rol === 'admin') {
    return [
      ...comunes,
      { a: '/admin/usuarios', etiqueta: 'Usuarios', icono: Shield },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  return comunes
}

export default function BarraNavegacion({ children }) {
  const { usuario, cerrarSesion } = useAutenticacion()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [noLeidos, setNoLeidos] = useState(0)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  const [notificaciones, setNotificaciones] = useState([])
  const [noLeidasNotif, setNoLeidasNotif] = useState(0)
  const [panelNotifAbierto, setPanelNotifAbierto] = useState(false)

  const ENLACES = obtenerEnlaces(usuario?.rol)

  useEffect(() => {
    if (!usuario || (usuario.rol !== 'atleta' && usuario.rol !== 'nutriologo')) return
    let activo = true
    const cargar = async () => {
      try {
        const r = await obtenerMensajesNoLeidos(usuario.id_usuario)
        if (activo) setNoLeidos(r.data.total || 0)
      } catch {
        // silencioso: no debe interrumpir la navegación
      }
    }
    cargar()
    const intervalo = setInterval(cargar, 15000)
    return () => { activo = false; clearInterval(intervalo) }
  }, [usuario])

  useEffect(() => {
    if (!usuario || usuario.rol !== 'nutriologo') return
    let activo = true
    const cargar = async () => {
      try {
        const r = await obtenerSolicitudesPendientesCount(usuario.id_usuario)
        if (activo) setSolicitudesPendientes(r.data.total || 0)
      } catch {
        // silencioso: no debe interrumpir la navegación
      }
    }
    cargar()
    const intervalo = setInterval(cargar, 15000)
    return () => { activo = false; clearInterval(intervalo) }
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    let activo = true
    const cargar = async () => {
      try {
        const r = await obtenerNotificacionesNoLeidas(usuario.id_usuario)
        if (activo) setNoLeidasNotif(r.data.total || 0)
      } catch {
        // silencioso: no debe interrumpir la navegación
      }
    }
    cargar()
    const intervalo = setInterval(cargar, 15000)
    return () => { activo = false; clearInterval(intervalo) }
  }, [usuario])

  const abrirNotificaciones = async () => {
    const abrir = !panelNotifAbierto
    setPanelNotifAbierto(abrir)
    if (abrir && usuario) {
      try {
        const r = await obtenerNotificaciones(usuario.id_usuario)
        setNotificaciones(r.data.notificaciones || [])
      } catch {
        setNotificaciones([])
      }
    }
  }

  const clickNotificacion = async (notif) => {
    setPanelNotifAbierto(false)
    if (!notif.leido) {
      try {
        await marcarNotificacionLeida(notif.id_notificacion)
        setNoLeidasNotif((n) => Math.max(0, n - 1))
      } catch {
        // silencioso
      }
    }
    if (notif.enlace) navigate(notif.enlace)
  }

  const marcarTodasLeidas = async () => {
    if (!usuario) return
    try {
      await marcarNotificacionesLeidas(usuario.id_usuario)
      setNotificaciones((lista) => lista.map((n) => ({ ...n, leido: 1 })))
      setNoLeidasNotif(0)
    } catch {
      // silencioso
    }
  }

  return (
    <div className="min-h-screen bg-base">
      <header className="border-b border-gray-800/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuAbierto(!menuAbierto)}
                className="lg:hidden p-2 rounded-lg hover:bg-base-claro transition-colors"
              >
                {menuAbierto ? <X className="w-5 h-5 text-texto-primary" /> : <Menu className="w-5 h-5 text-texto-primary" />}
              </button>
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SB</span>
                </div>
                <h1 className="text-xl font-bold text-texto-primary hidden sm:block">SilverBack</h1>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase font-semibold">
                {usuario?.rol}
              </span>
              <span className="text-sm text-texto-secondary hidden md:block">{usuario?.nombre_completo}</span>

              <div className="relative">
                <button
                  onClick={abrirNotificaciones}
                  className="relative p-2 rounded-lg hover:bg-base-claro transition-colors"
                >
                  <Bell className="w-5 h-5 text-texto-muted" />
                  {noLeidasNotif > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 text-[10px] font-bold bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center">
                      {noLeidasNotif > 9 ? '9+' : noLeidasNotif}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {panelNotifAbierto && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setPanelNotifAbierto(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-card border border-gray-800/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
                          <h4 className="text-sm font-semibold text-texto-primary">Notificaciones</h4>
                          {noLeidasNotif > 0 && (
                            <button
                              onClick={marcarTodasLeidas}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notificaciones.length === 0 ? (
                            <p className="text-xs text-texto-muted/60 italic text-center py-8">
                              No tienes notificaciones.
                            </p>
                          ) : (
                            notificaciones.map((n) => (
                              <button
                                key={n.id_notificacion}
                                onClick={() => clickNotificacion(n)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-800/30 last:border-0 hover:bg-base-claro/50 transition-colors ${
                                  !n.leido ? 'bg-primary/5' : ''
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.leido && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-texto-primary">{n.titulo}</p>
                                    <p className="text-xs text-texto-muted mt-0.5">{n.mensaje}</p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {usuario?.foto_perfil ? (
                  <img src={urlFotoPerfil(usuario.foto_perfil)} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-semibold text-sm">
                    {usuario?.nombre_completo?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 py-6">
        <AnimatePresence>
          {(menuAbierto || true) && (
            <motion.nav
              initial={false}
              animate={{ width: menuAbierto ? 240 : 240 }}
              className={`${menuAbierto ? 'fixed inset-0 z-20 bg-black/50 lg:static lg:bg-transparent' : ''} lg:block ${menuAbierto ? 'block' : 'hidden lg:block'}`}
            >
              <div className={`w-60 flex-shrink-0 space-y-1 ${menuAbierto ? 'relative z-30 bg-card h-full p-4' : ''}`}>
                {menuAbierto && (
                  <div className="flex justify-end mb-4 lg:hidden">
                    <button onClick={() => setMenuAbierto(false)} className="p-2 rounded-lg hover:bg-base-claro">
                      <X className="w-5 h-5 text-texto-primary" />
                    </button>
                  </div>
                )}
                {ENLACES.map((enlace) => {
                  const Icono = enlace.icono
                  const activo = location.pathname === enlace.a
                  return (
                    <Link
                      key={enlace.a}
                      to={enlace.a}
                      onClick={() => setMenuAbierto(false)}
                      className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                        activo
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-texto-secondary hover:text-texto-primary hover:bg-base-claro border border-transparent'
                      }`}
                    >
                      {activo && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
                      )}
                      <Icono className={`w-4 h-4 transition-transform duration-200 ${activo ? '' : 'group-hover:scale-110'}`} />
                      {enlace.etiqueta}
                      {enlace.a === '/mensajes' && noLeidos > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {noLeidos > 9 ? '9+' : noLeidos}
                        </span>
                      )}
                      {enlace.a === '/pacientes' && solicitudesPendientes > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-secondary text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {solicitudesPendientes > 9 ? '9+' : solicitudesPendientes}
                        </span>
                      )}
                    </Link>
                  )
                })}
                <button
                  onClick={cerrarSesion}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-texto-muted hover:text-error hover:bg-error/10 border border-transparent w-full transition-all duration-200 mt-4"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
