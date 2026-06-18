import { useState, useEffect, useCallback } from 'react'
import Calendar from 'react-calendar'
import { motion, AnimatePresence } from 'framer-motion'
import { Utensils, Plus, Trash2, ChevronLeft, ChevronRight, Stethoscope, Ban } from 'lucide-react'
import { obtenerComidas, eliminarComida, obtenerDiasConComidas, obtenerDietaPaciente } from '../servicios/ApiServicio'
import ModalAgregarComida from './ModalAgregarComida'

const COLORES_TIPO = {
  desayuno: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  colacion_1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  comida: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  colacion_2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cena: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const ETIQUETAS_TIPO = {
  desayuno: 'Desayuno',
  colacion_1: 'Colación 1',
  comida: 'Comida',
  colacion_2: 'Colación 2',
  cena: 'Cena',
}

function formatearFecha(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function formatearMes(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}`
}

function formatearFechaLegible(fecha) {
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

export default function VistaCalendario({ idPaciente, onActualizarStats, onActualizarComidas }) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date())
  const [comidas, setComidas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [fechaStr, setFechaStr] = useState(formatearFecha(new Date()))
  const [diasConComidas, setDiasConComidas] = useState([])
  const [mesActual, setMesActual] = useState(formatearMes(new Date()))
  const [dieta, setDieta] = useState(null)
  const [detallesDieta, setDetallesDieta] = useState([])
  const [cargandoDieta, setCargandoDieta] = useState(true)

  const cargarDiasDelMes = useCallback(async (mes) => {
    if (!idPaciente) return
    try {
      const respuesta = await obtenerDiasConComidas(mes, idPaciente)
      setDiasConComidas(respuesta.data.fechas || [])
    } catch {
      setDiasConComidas([])
    }
  }, [idPaciente])

  const cargarComidas = useCallback(async (fecha) => {
    if (!idPaciente) return
    setCargando(true)
    try {
      const respuesta = await obtenerComidas(fecha, idPaciente)
      setComidas(respuesta.data.comidas || [])
    } catch (err) {
      console.error('Error al cargar comidas:', err)
      setComidas([])
    } finally {
      setCargando(false)
    }
  }, [idPaciente])

  const cargarDieta = useCallback(async () => {
    if (!idPaciente) return
    setCargandoDieta(true)
    try {
      const respuesta = await obtenerDietaPaciente(idPaciente)
      if (respuesta.data.dieta) {
        setDieta(respuesta.data.dieta)
        setDetallesDieta(respuesta.data.detalles || [])
      } else {
        setDieta(null)
        setDetallesDieta([])
      }
    } catch {
      setDieta(null)
      setDetallesDieta([])
    } finally {
      setCargandoDieta(false)
    }
  }, [idPaciente])

  useEffect(() => {
    if (idPaciente) {
      cargarDieta()
    }
  }, [idPaciente, cargarDieta])

  useEffect(() => {
    const fecha = formatearFecha(fechaSeleccionada)
    const mes = formatearMes(fechaSeleccionada)
    setFechaStr(fecha)
    if (mes !== mesActual) {
      setMesActual(mes)
    }
    cargarComidas(fecha)
  }, [fechaSeleccionada, cargarComidas, mesActual])

  useEffect(() => {
    if (idPaciente) {
      cargarDiasDelMes(mesActual)
    }
  }, [idPaciente, mesActual, cargarDiasDelMes])

  useEffect(() => {
    if (!modalAbierto) {
      cargarComidas(fechaStr)
    }
  }, [modalAbierto, fechaStr, cargarComidas])

  const totalProteinas = (dieta ? detallesDieta : comidas).reduce((s, c) => s + Number(c.proteinas_totales || 0), 0)
  const totalCarbohidratos = (dieta ? detallesDieta : comidas).reduce((s, c) => s + Number(c.carbohidratos_totales || 0), 0)
  const totalGrasas = (dieta ? detallesDieta : comidas).reduce((s, c) => s + Number(c.grasas_totales || 0), 0)
  const totalCalorias = (dieta ? detallesDieta : comidas).reduce((s, c) => s + Number(c.calorias_totales || 0), 0)

  useEffect(() => {
    if (onActualizarStats) {
      onActualizarStats({ calorias: totalCalorias, proteinas: totalProteinas, carbohidratos: totalCarbohidratos, grasas: totalGrasas })
    }
    if (onActualizarComidas) {
      onActualizarComidas(dieta ? detallesDieta : comidas)
    }
  }, [totalCalorias, totalProteinas, totalCarbohidratos, totalGrasas, onActualizarStats, onActualizarComidas, comidas, dieta, detallesDieta])

  const manejarCambioFecha = (fecha) => {
    setFechaSeleccionada(fecha)
  }

  const manejarClickNavegacion = (accion) => {
    const nuevaFecha = new Date(fechaSeleccionada)
    if (accion === 'prev') {
      nuevaFecha.setMonth(nuevaFecha.getMonth() - 1)
    } else {
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 1)
    }
    setMesActual(formatearMes(nuevaFecha))
    setFechaSeleccionada(nuevaFecha)
  }

  const manejarEliminarComida = async (idComida) => {
    try {
      await eliminarComida(idComida)
      const nuevasComidas = comidas.filter(c => c.id_comida !== idComida)
      setComidas(nuevasComidas)
    } catch (err) {
      console.error('Error al eliminar comida:', err)
    }
  }

  const marcarDiaConComidas = ({ date, view }) => {
    if (view === 'month') {
      const fecha = formatearFecha(date)
      if (diasConComidas.includes(fecha)) {
        return 'react-calendar__tile--hasActive'
      }
    }
  }

  const comidasAgrupadas = {}
  const items = dieta ? detallesDieta : comidas
  items.forEach(c => {
    const tipo = c.tipo_comida
    if (!comidasAgrupadas[tipo]) comidasAgrupadas[tipo] = []
    comidasAgrupadas[tipo].push(c)
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="tarjeta-hover">
          <h2 className="text-lg font-semibold text-texto-primary mb-4">
            Calendario de Comidas
          </h2>
          <Calendar
            onChange={manejarCambioFecha}
            value={fechaSeleccionada}
            locale="es-MX"
            tileClassName={marcarDiaConComidas}
            onActiveStartDateChange={({ activeStartDate }) => {
              setMesActual(formatearMes(activeStartDate))
            }}
            prevLabel={<ChevronLeft className="w-4 h-4" />}
            nextLabel={<ChevronRight className="w-4 h-4" />}
            prev2Label={null}
            next2Label={null}
          />
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-texto-secondary">Calorías</span>
              <span className="font-semibold text-texto-primary">{Math.round(totalCalorias)} kcal</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-400">Proteína</span>
                <span className="text-texto-muted">{Math.round(totalProteinas)}g</span>
              </div>
              <div className="barra-macro">
                <div
                  className="barra-macro-llenado bg-blue-500"
                  style={{ width: `${Math.min((totalProteinas / 200) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-400">Carbohidratos</span>
                <span className="text-texto-muted">{Math.round(totalCarbohidratos)}g</span>
              </div>
              <div className="barra-macro">
                <div
                  className="barra-macro-llenado bg-amber-500"
                  style={{ width: `${Math.min((totalCarbohidratos / 300) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400">Grasas</span>
                <span className="text-texto-muted">{Math.round(totalGrasas)}g</span>
              </div>
              <div className="barra-macro">
                <div
                  className="barra-macro-llenado bg-red-500"
                  style={{ width: `${Math.min((totalGrasas / 80) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-texto-primary capitalize">
            {formatearFechaLegible(fechaSeleccionada)}
          </h2>
          {dieta ? null : (
            <button onClick={() => setModalAbierto(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Agregar Comida
            </button>
          )}
        </div>

        {dieta && !cargandoDieta && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
            <Stethoscope className="w-4 h-4 flex-shrink-0" />
            <span>Dieta asignada por tu nutriólogo — los alimentos están predefinidos.</span>
          </div>
        )}

        {cargandoDieta ? (
          <div className="tarjeta">
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-base-claro rounded-lg" />
            </div>
          </div>
        ) : cargando ? (
          <div className="tarjeta">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-base-claro rounded-lg" />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="tarjeta flex flex-col items-center justify-center py-12">
            <Utensils className="w-12 h-12 text-texto-muted/50 mb-3" />
            <p className="text-texto-secondary text-sm">Sin comidas registradas</p>
            <p className="text-texto-muted text-xs mt-1">
              {dieta
                ? 'Tu nutriólogo aún no ha definido los alimentos para esta fecha.'
                : 'Selecciona un día o agrega una comida'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={fechaStr}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {Object.entries(ETIQUETAS_TIPO).map(([tipo, etiqueta]) => {
                const itemsGrupo = comidasAgrupadas[tipo]
                if (!itemsGrupo) return null
                return (
                  <div key={tipo} className="tarjeta-hover">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`etiqueta ${COLORES_TIPO[tipo]}`}>
                        {etiqueta}
                      </span>
                      <span className="text-xs text-texto-muted">
                        {itemsGrupo.length} alimento{itemsGrupo.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {itemsGrupo.map((item) => (
                        <div key={item.id_detalle || item.id_comida} className="flex items-center justify-between p-3 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors group">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-texto-primary">{item.nombre_alimento}</p>
                            <p className="text-xs text-texto-muted mt-0.5">
                              {item.cantidad} {item.unidad} · {Math.round(item.calorias_totales)} kcal
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-xs text-texto-muted">
                              <span className="text-blue-400">{Math.round(item.proteinas_totales)}g P</span>
                              <span className="text-amber-400">{Math.round(item.carbohidratos_totales)}g C</span>
                              <span className="text-red-400">{Math.round(item.grasas_totales)}g G</span>
                            </div>
                            {!dieta && (
                              <button
                                onClick={() => manejarEliminarComida(item.id_comida)}
                                className="p-1.5 rounded-lg text-texto-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <ModalAgregarComida
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        idPaciente={idPaciente}
        fechaSeleccionada={fechaStr}
        onComidaAgregada={() => cargarComidas(fechaStr)}
      />
    </div>
  )
}
