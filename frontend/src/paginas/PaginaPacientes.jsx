import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerPacientes } from '../servicios/ApiServicio'
import { Users, Loader2, Activity, Target, Ruler, CalendarDays, ClipboardList, Dumbbell } from 'lucide-react'
import EditorDietaPaciente from '../componentes/EditorDietaPaciente'
import EditorRutinaPaciente from '../componentes/EditorRutinaPaciente'

export default function PaginaPacientes() {
  const { usuario } = useAutenticacion()
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pacienteDieta, setPacienteDieta] = useState(null)
  const [pacienteRutina, setPacienteRutina] = useState(null)

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

      {pacientes.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">Sin pacientes asignados</p>
          <p className="text-texto-muted text-xs mt-1 mb-5">Aún no tienes pacientes asignados. Cuando un atleta te seleccione como su nutriólogo, aparecerá aquí.</p>
          <Link to="/citas" className="btn-primary text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Ver mis citas
          </Link>
        </div>
      ) : (
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
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {usuario && (
        <EditorDietaPaciente
          abierto={!!pacienteDieta}
          onCerrar={() => setPacienteDieta(null)}
          paciente={pacienteDieta}
          idNutriologo={usuario.id_usuario}
        />
      )}
      {usuario && (
        <EditorRutinaPaciente
          abierto={!!pacienteRutina}
          onCerrar={() => setPacienteRutina(null)}
          paciente={pacienteRutina}
          idNutriologo={usuario.id_usuario}
        />
      )}
    </motion.div>
  )
}
