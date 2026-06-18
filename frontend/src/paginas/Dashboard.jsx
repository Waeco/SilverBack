import { useState, useEffect, useMemo } from 'react'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { Link } from 'react-router-dom'
import VistaCalendario from '../componentes/VistaCalendario'
import { obtenerUsuario, obtenerCitas, obtenerStatsAdmin, obtenerPacientes } from '../servicios/ApiServicio'
import { Apple, Flame, TrendingUp, CalendarDays, Users, Stethoscope, Loader2, ArrowRight, Zap, Trophy, Sun, Coffee, Moon, Utensils } from 'lucide-react'
import { motion } from 'framer-motion'

const COLORES_TIPO = {
  desayuno: { bg: 'bg-blue-500', luz: 'bg-blue-500/20', texto: 'text-blue-400', icono: Coffee },
  colacion_1: { bg: 'bg-yellow-500', luz: 'bg-yellow-500/20', texto: 'text-yellow-400', icono: Zap },
  comida: { bg: 'bg-emerald-500', luz: 'bg-emerald-500/20', texto: 'text-emerald-400', icono: Sun },
  colacion_2: { bg: 'bg-orange-500', luz: 'bg-orange-500/20', texto: 'text-orange-400', icono: Zap },
  cena: { bg: 'bg-purple-500', luz: 'bg-purple-500/20', texto: 'text-purple-400', icono: Moon },
}

const ETIQUETAS_TIPO = {
  desayuno: 'Desayuno',
  colacion_1: 'Colación 1',
  comida: 'Comida',
  colacion_2: 'Colación 2',
  cena: 'Cena',
}

function META_CALORIAS(rol) {
  return rol === 'atleta' ? 2200 : 2000
}

function AnilloProgreso({ calorias, objetivo, size = 160 }) {
  const radio = 60
  const circunferencia = 2 * Math.PI * radio
  const fraccion = Math.min(calorias / objetivo, 1)
  const offset = circunferencia * (1 - fraccion)
  const centro = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="currentColor" strokeWidth={8} className="text-gray-800" />
        <circle
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="texto-display text-4xl text-texto-primary leading-none">{Math.round(calorias)}</span>
        <span className="text-xs text-texto-muted mt-1 tracking-wide">de {objetivo} kcal</span>
      </div>
    </div>
  )
}

function MiniTimeline({ comidas }) {
  const agrupadas = {}
  comidas.forEach(c => {
    const t = c.tipo_comida
    if (!agrupadas[t]) agrupadas[t] = []
    agrupadas[t].push(c)
  })

  const orden = ['desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena']

  return (
    <div className="space-y-0">
      {orden.map((tipo, idx) => {
        const items = agrupadas[tipo]
        const config = COLORES_TIPO[tipo]
        const Icono = config.icono
        const ultimo = idx === orden.length - 1
        return (
          <div key={tipo} className="relative flex gap-3 pb-3">
            {!ultimo && <div className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-gray-800" />}
            <div className={`relative z-10 w-6 h-6 rounded-full ${items ? config.luz : 'bg-base-claro'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <Icono className={`w-3 h-3 ${items ? config.texto : 'text-texto-muted'}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className={`text-xs font-semibold ${items ? 'text-texto-primary' : 'text-texto-muted'}`}>
                {ETIQUETAS_TIPO[tipo]}
              </p>
              {items ? (
                <p className="text-xs text-texto-muted truncate">
                  {items.map(i => i.nombre_alimento).join(', ')} · {items.reduce((s, i) => s + Number(i.calorias_totales), 0).toFixed(0)} kcal
                </p>
              ) : (
                <p className="text-xs text-texto-muted/50 italic">Pendiente</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DASHBOARD ATLETA ──────────────────────────────────────────

function DashboardAtleta({ usuario }) {
  const [idPaciente, setIdPaciente] = useState(null)
  const [stats, setStats] = useState({ calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 })
  const [comidas, setComidas] = useState([])
  const [cargandoPerfil, setCargandoPerfil] = useState(true)
  const meta = META_CALORIAS('atleta')

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

  const itemsStats = useMemo(() => [
    { icon: Apple, valor: stats.proteinas, etiqueta: 'Proteína', unidad: 'g', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Flame, valor: stats.carbohidratos, etiqueta: 'Carbohidratos', unidad: 'g', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: TrendingUp, valor: stats.grasas, etiqueta: 'Grasas', unidad: 'g', color: 'text-red-400', bg: 'bg-red-500/10' },
  ], [stats])

  return (
    <>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="tarjeta-hover mb-6"
      >
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <AnilloProgreso calorias={stats.calorias} objetivo={meta} />
          <div className="flex-1 w-full">
            <p className="text-xs texto-mono text-texto-muted uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary mb-4">Resumen del Día</h2>
            {comidas.length > 0 ? (
              <MiniTimeline comidas={comidas} />
            ) : (
              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm text-texto-secondary">
                  Aún no has registrado comidas hoy.{' '}
                  <span className="text-primary font-medium">Selecciona un día en el calendario para empezar.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats secundarios */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {itemsStats.map((item, i) => (
          <motion.div
            key={item.etiqueta}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="tarjeta-hover flex items-center gap-3 p-4"
          >
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div>
              <p className="texto-display text-xl text-texto-primary leading-none">{Math.round(item.valor)}<span className="texto-mono text-xs text-texto-muted ml-0.5">{item.unidad}</span></p>
              <p className="text-xs text-texto-muted mt-0.5">{item.etiqueta}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Calendario */}
      {cargandoPerfil ? (
        <div className="tarjeta"><div className="animate-pulse space-y-4"><div className="h-64 bg-base-claro rounded-lg" /></div></div>
      ) : (
        <VistaCalendario idPaciente={idPaciente} onActualizarStats={setStats} onActualizarComidas={setComidas} />
      )}
    </>
  )
}

// ─── DASHBOARD NUTRIÓLOGO ───────────────────────────────────────

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

  if (cargando) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  const hoy = new Date().toISOString().split('T')[0]
  const citasHoy = citas.filter(c => c.fecha === hoy)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: CalendarDays, valor: citasHoy.length, etiqueta: 'Citas hoy', color: 'text-blue-400', bg: 'bg-blue-500/10', formato: (v) => `${v}` },
          { icon: Users, valor: pacientes.length, etiqueta: 'Pacientes asignados', color: 'text-emerald-400', bg: 'bg-emerald-500/10', formato: (v) => `${v}` },
          { icon: CalendarDays, valor: citas.length, etiqueta: 'Próximas citas', color: 'text-amber-400', bg: 'bg-amber-500/10', formato: (v) => `${v}` },
        ].map((item, i) => (
          <motion.div key={item.etiqueta} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="tarjeta-hover flex items-center gap-4 p-5">
            <div className={`w-11 h-11 rounded-lg ${item.bg} flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="texto-display text-3xl text-texto-primary leading-none">{item.formato(item.valor)}</p>
              <p className="text-xs text-texto-muted mt-0.5">{item.etiqueta}</p>
            </div>
          </motion.div>
        ))}
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
            <div className="flex flex-col items-center py-8">
              <CalendarDays className="w-8 h-8 text-texto-muted/40 mb-2" />
              <p className="text-sm text-texto-muted">Sin citas próximas</p>
              <p className="text-xs text-texto-muted/50 mt-1">Las citas aparecerán aquí cuando los pacientes agenden</p>
            </div>
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
            <div className="flex flex-col items-center py-8">
              <Users className="w-8 h-8 text-texto-muted/40 mb-2" />
              <p className="text-sm text-texto-muted">Sin pacientes asignados</p>
              <p className="text-xs text-texto-muted/50 mt-1">Pacientes aparecerán aquí cuando te sean asignados</p>
            </div>
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

// ─── DASHBOARD ADMIN ────────────────────────────────────────────

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

  if (cargando) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  const items = [
    { icon: Users, valor: stats?.total_usuarios || 0, etiqueta: 'Usuarios Totales', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Trophy, valor: stats?.total_atletas || 0, etiqueta: 'Atletas', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Stethoscope, valor: stats?.total_nutriologos || 0, etiqueta: 'Nutriólogos', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: CalendarDays, valor: stats?.citas_pendientes || 0, etiqueta: 'Citas Pendientes', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {items.map((item, i) => (
          <motion.div key={item.etiqueta} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="tarjeta-hover">
            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <p className="texto-display text-3xl text-texto-primary leading-none">{item.valor}</p>
            <p className="text-xs text-texto-muted mt-1">{item.etiqueta}</p>
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

// ─── EXPORT PRINCIPAL ───────────────────────────────────────────

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
        <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary mb-6">Dashboard</h2>
      </motion.div>

      {usuario.rol === 'nutriologo' && <DashboardNutriologo usuario={usuario} />}
      {usuario.rol === 'admin' && <DashboardAdmin />}
      {usuario.rol === 'atleta' && <DashboardAtleta usuario={usuario} />}
    </>
  )
}
