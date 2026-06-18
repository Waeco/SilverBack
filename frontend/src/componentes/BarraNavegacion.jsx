import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import {
  LayoutDashboard, Utensils, CalendarDays, User, Stethoscope,
  Users, Shield, Menu, X, LogOut, Dumbbell
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
      { a: '/nutriologos', etiqueta: 'Nutriólogos', icono: Stethoscope },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  if (rol === 'nutriologo') {
    return [
      ...comunes,
      { a: '/citas', etiqueta: 'Citas', icono: CalendarDays },
      { a: '/pacientes', etiqueta: 'Pacientes', icono: Users },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  if (rol === 'admin') {
    return [
      ...comunes,
      { a: '/citas', etiqueta: 'Citas', icono: CalendarDays },
      { a: '/admin/usuarios', etiqueta: 'Usuarios', icono: Shield },
      { a: '/perfil', etiqueta: 'Perfil', icono: User },
    ]
  }
  return comunes
}

export default function BarraNavegacion({ children }) {
  const { usuario, cerrarSesion } = useAutenticacion()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const ENLACES = obtenerEnlaces(usuario?.rol)

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
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">
                  {usuario?.nombre_completo?.charAt(0)?.toUpperCase() || '?'}
                </span>
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
