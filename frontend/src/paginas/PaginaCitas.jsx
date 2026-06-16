import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerCitas, eliminarCita } from '../servicios/ApiServicio'
import { CalendarDays, Clock, XCircle, Loader2, User } from 'lucide-react'

const COLORES_ESTADO = {
  pendiente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmada: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completada: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelada: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function PaginaCitas() {
  const { usuario } = useAutenticacion()
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) return
    const cargar = async () => {
      try {
        const params = { id_usuario: usuario.id_usuario, rol: usuario.rol }
        const respuesta = await obtenerCitas(usuario.id_usuario, usuario.rol)
        setCitas(respuesta.data.citas || [])
      } catch {
        setCitas([])
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario])

  const manejarCancelar = async (idCita) => {
    try {
      await eliminarCita(idCita)
      setCitas(citas.filter(c => c.id_cita !== idCita))
    } catch {
      console.error('Error al cancelar cita')
    }
  }

  const formatearFecha = (fecha) => {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Mis Citas</h2>
      </div>

      {citas.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <CalendarDays className="w-12 h-12 text-texto-muted/50 mb-3" />
          <p className="text-texto-secondary text-sm">Sin citas registradas</p>
          <p className="text-texto-muted text-xs mt-1">Las citas aparecerán aquí cuando sean agendadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {citas.map((cita, i) => (
            <motion.div
              key={cita.id_cita}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="tarjeta-hover flex items-center justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-texto-primary capitalize">{formatearFecha(cita.fecha)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-texto-muted" />
                    <span className="text-sm text-texto-secondary">{cita.hora?.slice(0, 5)} hrs</span>
                    <span className={`etiqueta text-xs ${COLORES_ESTADO[cita.estado] || COLORES_ESTADO.pendiente}`}>
                      {cita.estado}
                    </span>
                  </div>
                  {cita.nombre_paciente && (
                    <p className="text-xs text-texto-muted mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {cita.nombre_paciente}
                    </p>
                  )}
                  {cita.nombre_nutriologo && (
                    <p className="text-xs text-texto-muted mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {cita.nombre_nutriologo}
                    </p>
                  )}
                </div>
              </div>
              {cita.estado === 'pendiente' && (
                <button onClick={() => manejarCancelar(cita.id_cita)} className="btn-danger text-xs px-3 py-1.5">
                  Cancelar
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
