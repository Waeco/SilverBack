import { useState, useEffect } from 'react'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { Link } from 'react-router-dom'
import VistaCalendario from '../componentes/VistaCalendario'
import { obtenerUsuario, obtenerCitas, obtenerStatsAdmin, obtenerPacientes } from '../servicios/ApiServicio'
import { Activity, Apple, Flame, TrendingUp, CalendarDays, Users, Stethoscope, Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

function DashboardAtleta({ usuario }) {
  const [idPaciente, setIdPaciente] = useState(null)
  const [stats, setStats] = useState({ calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 })
  const [cargandoPerfil, setCargandoPerfil] = useState(true)

  useEffect(() => {
    if (!usuario) return
    const cargarPerfil = async () => {
      try {
        const respuesta = await obtenerUsuario(usuario.id_usuario)
        const perfil = respuesta.data.usuario
        if (perfil.rol === 'atleta' && perfil.perfil) {
          setIdPaciente(perfil.perfil.id_paciente)
        }
      } catch (err) {
        console.error('Error al cargar perfil:', err)
      } finally {
        setCargandoPerfil(false)
      }
    }
    cargarPerfil()
  }, [usuario])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Apple, valor: stats.calorias, etiqueta: 'Calorías Hoy', color: 'text-emerald-400', bg: 'bg-emerald-500/10', formato: (v) => `${v.toLocaleString()} kcal` },
          { icon: Flame, valor: stats.proteinas, etiqueta: 'Proteína', color: 'text-blue-400', bg: 'bg-blue-500/10', formato: (v) => `${Math.round(v)}g` },
          { icon: Activity, valor: stats.carbohidratos, etiqueta: 'Carbohidratos', color: 'text-amber-400', bg: 'bg-amber-500/10', formato: (v) => `${Math.round(v)}g` },
          { icon: TrendingUp, valor: stats.grasas, etiqueta: 'Grasas', color: 'text-red-400', bg: 'bg-red-500/10', formato: (v) => `${Math.round(v)}g` },
        ].map((item, i) => (
          <motion.div
            key={item.etiqueta}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            className="tarjeta-hover"
          >
            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <p className="text-2xl font-bold text-texto-primary">{item.formato(item.valor)}</p>
            <p className="text-sm text-texto-muted mt-0.5">{item.etiqueta}</p>
          </motion.div>
        ))}
      </div>

      {cargandoPerfil ? (
        <div className="tarjeta">
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-base-claro rounded-lg" />
          </div>
        </div>
      ) : (
        <VistaCalendario idPaciente={idPaciente} onActualizarStats={setStats} />
      )}
    </>
  )
}

function DashboardNutriologo({ usuario }) {
  const [citas, setCitas] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const [respCitas, respPacientes] = await Promise.all([
          obtenerCitas(usuario.id_usuario, 'nutriologo'),
          obtenerPacientes(usuario.id_usuario),
        ])
        setCitas((respCitas.data.citas || []).filter(c => c.estado !== 'cancelada').slice(0, 5))
        setPacientes(respPacientes.data.pacientes || [])
      } catch {
        console.error('Error al cargar dashboard')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  const hoy = new Date().toISOString().split('T')[0]
  const citasHoy = citas.filter(c => c.fecha === hoy)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="tarjeta-hover">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-texto-primary">{citasHoy.length}</p>
          <p className="text-sm text-texto-muted mt-0.5">Citas hoy</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="tarjeta-hover">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-texto-primary">{pacientes.length}</p>
          <p className="text-sm text-texto-muted mt-0.5">Pacientes asignados</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="tarjeta-hover">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-texto-primary">{citas.length}</p>
          <p className="text-sm text-texto-muted mt-0.5">Próximas citas</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="tarjeta-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-texto-primary">Próximas Citas</h3>
            <Link to="/citas" className="text-xs text-primary hover:text-primary-claro flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {citas.length === 0 ? (
            <p className="text-sm text-texto-muted">Sin citas próximas</p>
          ) : (
            <div className="space-y-2">
              {citas.map(c => (
                <div key={c.id_cita} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                  <div>
                    <p className="text-sm text-texto-primary font-medium">{c.nombre_paciente}</p>
                    <p className="text-xs text-texto-muted">{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — {c.hora?.slice(0, 5)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                    c.estado === 'confirmada' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>{c.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tarjeta-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-texto-primary">Pacientes Recientes</h3>
            <Link to="/pacientes" className="text-xs text-primary hover:text-primary-claro flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pacientes.length === 0 ? (
            <p className="text-sm text-texto-muted">Sin pacientes asignados</p>
          ) : (
            <div className="space-y-2">
              {pacientes.map(p => (
                <div key={p.id_paciente} className="flex items-center gap-3 py-2 border-b border-gray-800/30 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-semibold text-xs">{p.nombre_completo?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm text-texto-primary">{p.nombre_completo}</p>
                    {p.deporte && <p className="text-xs text-texto-muted">{p.deporte} — {p.objetivo || 'Sin objetivo'}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function DashboardAdmin() {
  const [stats, setStats] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const respuesta = await obtenerStatsAdmin()
        setStats(respuesta.data)
      } catch {
        console.error('Error al cargar stats')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  const items = [
    { icon: Users, valor: stats?.total_usuarios || 0, etiqueta: 'Usuarios Totales', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Activity, valor: stats?.total_atletas || 0, etiqueta: 'Atletas', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Stethoscope, valor: stats?.total_nutriologos || 0, etiqueta: 'Nutriólogos', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: CalendarDays, valor: stats?.citas_pendientes || 0, etiqueta: 'Citas Pendientes', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {items.map((item, i) => (
          <motion.div
            key={item.etiqueta}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            className="tarjeta-hover"
          >
            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <p className="text-2xl font-bold text-texto-primary">{item.valor}</p>
            <p className="text-sm text-texto-muted mt-0.5">{item.etiqueta}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="tarjeta-hover">
          <h3 className="font-semibold text-texto-primary mb-4">Usuarios por Rol</h3>
          <div className="space-y-3">
            {[
              { label: 'Atletas', count: stats?.total_atletas || 0, color: 'bg-emerald-500', pct: stats?.total_usuarios ? Math.round(stats.total_atletas / stats.total_usuarios * 100) : 0 },
              { label: 'Nutriólogos', count: stats?.total_nutriologos || 0, color: 'bg-purple-500', pct: stats?.total_usuarios ? Math.round(stats.total_nutriologos / stats.total_usuarios * 100) : 0 },
              { label: 'Admin', count: (stats?.total_usuarios || 0) - (stats?.total_atletas || 0) - (stats?.total_nutriologos || 0), color: 'bg-blue-500', pct: stats?.total_usuarios ? Math.round(((stats?.total_usuarios || 0) - (stats?.total_atletas || 0) - (stats?.total_nutriologos || 0)) / stats.total_usuarios * 100) : 0 },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-texto-secondary">{r.label}</span>
                  <span className="text-texto-primary font-medium">{r.count}</span>
                </div>
                <div className="h-2 rounded-full bg-base-claro overflow-hidden">
                  <div className={`h-full rounded-full ${r.color} transition-all duration-500`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tarjeta-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-texto-primary">Citas</h3>
            <Link to="/citas" className="text-xs text-primary hover:text-primary-claro flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total', count: stats?.total_citas || 0, color: 'text-blue-400' },
              { label: 'Pendientes', count: stats?.citas_pendientes || 0, color: 'text-amber-400' },
              { label: 'Completadas', count: (stats?.total_citas || 0) - (stats?.citas_pendientes || 0), color: 'text-emerald-400' },
            ].map(c => (
              <div key={c.label} className="flex justify-between items-center py-2 border-b border-gray-800/30 last:border-0">
                <span className="text-sm text-texto-secondary">{c.label}</span>
                <span className={`text-sm font-semibold ${c.color}`}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function Dashboard() {
  const { usuario } = useAutenticacion()

  if (!usuario) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-2xl font-bold text-texto-primary mb-6">Dashboard</h2>
      </motion.div>

      {usuario.rol === 'nutriologo' && <DashboardNutriologo usuario={usuario} />}
      {usuario.rol === 'admin' && <DashboardAdmin />}
      {usuario.rol === 'atleta' && <DashboardAtleta usuario={usuario} />}
    </>
  )
}
