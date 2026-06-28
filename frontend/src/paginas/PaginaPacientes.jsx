import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerPacientes, obtenerUsuario, obtenerSolicitudesPendientes, aceptarSolicitud, rechazarSolicitud } from '../servicios/ApiServicio'
import { Users, Loader2, Activity, Target, Ruler, CalendarDays, ClipboardList, Dumbbell, ClipboardEdit, UserPlus, Check, X, Clock } from 'lucide-react'
import EditorDietaPaciente from '../componentes/EditorDietaPaciente'
import EditorRutinaPaciente from '../componentes/EditorRutinaPaciente'

export default function PaginaPacientes() {
  const { usuario } = useAutenticacion()
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pacienteDieta, setPacienteDieta] = useState(null)
  const [pacienteRutina, setPacienteRutina] = useState(null)
  const [idNutriologo, setIdNutriologo] = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [procesando, setProcesando] = useState(null)

  useEffect(() => {
    if (!usuario) return
    const cargarPerfil = async () => {
      try {
        const r = await obtenerUsuario(usuario.id_usuario)
        if (r.data.usuario.perfil) {
          setIdNutriologo(r.data.usuario.perfil.id_nutriologo)
        }
      } catch {
        setIdNutriologo(null)
      }
    }
    cargarPerfil()
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    const cargar = async () => {
      try {
        const respuesta = await obtenerPacientes(usuario.id_usuario)
        setPacientes(respuesta.data.pacientes || [])
      } catch {
        setPacientes([])
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    const cargarSolicitudes = async () => {
      try {
        const r = await obtenerUsuario(usuario.id_usuario)
        const perfil = r.data.usuario.perfil
        if (perfil && perfil.id_nutriologo) {
          const resp = await obtenerSolicitudesPendientes(perfil.id_nutriologo)
          setSolicitudes(resp.data || [])
        }
      } catch {
        setSolicitudes([])
      } finally {
        setCargandoSolicitudes(false)
      }
    }
    cargarSolicitudes()
  }, [usuario])

  const manejarAceptar = async (idSolicitud) => {
    setProcesando(idSolicitud)
    try {
      await aceptarSolicitud(idSolicitud)
      setSolicitudes((prev) => prev.filter((s) => s.id !== idSolicitud))
    } catch {
    } finally {
      setProcesando(null)
    }
  }

  const manejarRechazar = async (idSolicitud) => {
    setProcesando(idSolicitud)
    try {
      await rechazarSolicitud(idSolicitud)
      setSolicitudes((prev) => prev.filter((s) => s.id !== idSolicitud))
    } catch {
    } finally {
      setProcesando(null)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Mis Pacientes</h2>
        <span className="text-sm text-texto-muted">{pacientes.length} pacientes</span>
      </div>

      {solicitudes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-texto-primary mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-yellow-400" />
            Solicitudes Pendientes
          </h3>
          <div className="space-y-2">
            {solicitudes.map((s) => (
              <div key={s.id} className="tarjeta flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-yellow-400 font-bold">
                      {s.nombre_completo?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-texto-primary truncate">{s.nombre_completo}</p>
                    <p className="text-xs text-texto-muted truncate">{s.correo}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {s.peso_actual && (
                        <span className="text-xs text-texto-secondary">{s.peso_actual} kg</span>
                      )}
                      {s.altura && (
                        <span className="text-xs text-texto-secondary">{s.altura} cm</span>
                      )}
                      {s.deporte && (
                        <span className="text-xs text-texto-secondary">{s.deporte}</span>
                      )}
                    </div>
                    {s.objetivo && (
                      <p className="text-xs text-texto-muted mt-1">{s.objetivo}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => manejarAceptar(s.id)}
                    disabled={procesando === s.id}
                    className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
                  >
                    {procesando === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Aceptar
                  </button>
                  <button
                    onClick={() => manejarRechazar(s.id)}
                    disabled={procesando === s.id}
                    className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pacientes.length === 0 && solicitudes.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">Sin pacientes asignados</p>
          <p className="text-texto-muted text-xs mt-1 mb-5">Aún no tienes pacientes asignados. Cuando un atleta te solicite como nutriólogo, aparecerá aquí.</p>
          <Link to="/citas" className="btn-primary text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Ver mis citas
          </Link>
        </div>
      ) : pacientes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {pacientes.map((p, i) => (
            <motion.div
              key={p.id_paciente}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="tarjeta-hover"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
                  <span className="text-primary font-bold text-lg">
                    {p.nombre_completo?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-texto-primary truncate">{p.nombre_completo}</p>
                  <p className="text-xs text-texto-muted mt-0.5">{p.correo}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {p.peso_actual && (
                      <span className="text-xs text-texto-secondary flex items-center gap-1">
                        <Activity className="w-3 h-3 text-texto-muted" />
                        {p.peso_actual} kg
                      </span>
                    )}
                    {p.altura && (
                      <span className="text-xs text-texto-secondary flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-texto-muted" />
                        {p.altura} cm
                      </span>
                    )}
                    {p.deporte && (
                      <span className="text-xs text-texto-secondary flex items-center gap-1">
                        <Activity className="w-3 h-3 text-texto-muted" />
                        {p.deporte}
                      </span>
                    )}
                  </div>
                  {p.objetivo && (
                    <p className="text-xs text-texto-muted mt-2 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {p.objetivo}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setPacienteDieta(p)}
                      className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Plan de Dieta
                    </button>
                    <button
                      onClick={() => setPacienteRutina(p)}
                      className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <Dumbbell className="w-3.5 h-3.5" />
                      Rutina de Ejercicios
                    </button>
                    <Link
                      to={`/historial/${p.id_paciente}`}
                      className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <ClipboardEdit className="w-3.5 h-3.5" />
                      Historial
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}

      {usuario && idNutriologo && (
        <EditorDietaPaciente
          abierto={!!pacienteDieta}
          onCerrar={() => setPacienteDieta(null)}
          paciente={pacienteDieta}
          idNutriologo={idNutriologo}
        />
      )}
      {usuario && idNutriologo && (
        <EditorRutinaPaciente
          abierto={!!pacienteRutina}
          onCerrar={() => setPacienteRutina(null)}
          paciente={pacienteRutina}
          idNutriologo={idNutriologo}
        />
      )}
    </motion.div>
  )
}
