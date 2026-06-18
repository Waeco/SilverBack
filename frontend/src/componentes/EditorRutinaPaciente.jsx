import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Loader2, Plus, Trash2, Save, Dumbbell, ExternalLink } from 'lucide-react'
import { buscarEjercicios, obtenerRutinaPaciente, asignarRutina, desactivarRutina } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

export default function EditorRutinaPaciente({ abierto, onCerrar, paciente, idNutriologo }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [ejercicioExpandido, setEjercicioExpandido] = useState(null)

  const cargarRutina = useCallback(async () => {
    if (!paciente) return
    setCargando(true)
    try {
      const respuesta = await obtenerRutinaPaciente(paciente.id_paciente)
      const existentes = (respuesta.data.detalles || []).map(d => ({
        ...d,
        id_temp: Date.now() + Math.random(),
      }))
      setItems(existentes)
    } catch {
      setItems([])
    } finally {
      setCargando(false)
    }
  }, [paciente])

  useEffect(() => {
    if (abierto) cargarRutina()
  }, [abierto, cargarRutina])

  const manejarBusqueda = useCallback(async () => {
    if (!terminoBusqueda.trim()) return
    setBuscando(true)
    try {
      const respuesta = await buscarEjercicios(terminoBusqueda)
      setResultadosBusqueda(respuesta.data?.results || [])
    } catch {
      setResultadosBusqueda([])
    } finally {
      setBuscando(false)
    }
  }, [terminoBusqueda])

  const agregarEjercicio = (ejercicio) => {
    const nuevo = {
      id_temp: Date.now(),
      id_ejercicio: String(ejercicio.id),
      nombre_ejercicio: ejercicio.nombre,
      descripcion: ejercicio.descripcion || '',
      series: 3,
      repeticiones: '10',
      descanso: '60 seg',
      imagen_url: ejercicio.imagen || '',
      video_url: ejercicio.video || '',
    }
    setItems([...items, nuevo])
    setResultadosBusqueda([])
    setTerminoBusqueda('')
  }

  const eliminarItem = (idTemp) => {
    setItems(items.filter(i => i.id_temp !== idTemp))
  }

  const actualizarCampo = (idTemp, campo, valor) => {
    setItems(items.map(i => i.id_temp === idTemp ? { ...i, [campo]: valor } : i))
  }

  const guardarRutina = async () => {
    if (items.length === 0) {
      alertaError('Error', 'Agrega al menos un ejercicio a la rutina.')
      return
    }
    setGuardando(true)
    try {
      const detalles = items.map(i => ({
        id_ejercicio: i.id_ejercicio,
        nombre_ejercicio: i.nombre_ejercicio,
        descripcion: i.descripcion,
        series: i.series,
        repeticiones: String(i.repeticiones),
        descanso: i.descanso,
        imagen_url: i.imagen_url,
        video_url: i.video_url,
      }))
      await asignarRutina({
        id_paciente: paciente.id_paciente,
        id_nutriologo: idNutriologo,
        detalles,
      })
      alertaExito('Rutina asignada', 'La rutina se ha asignado correctamente al paciente.')
      onCerrar()
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al guardar la rutina.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarRutina = async () => {
    const result = await alertaConfirmar('Eliminar rutina',
      '¿Estás seguro? El paciente podrá crear su propia rutina nuevamente.')
    if (!result.isConfirmed) return
    try {
      const respuesta = await obtenerRutinaPaciente(paciente.id_paciente)
      if (respuesta.data.rutina) {
        await desactivarRutina(respuesta.data.rutina.id_plan)
        alertaExito('Rutina eliminada', 'La rutina se ha desactivado.')
        onCerrar()
      }
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al eliminar la rutina.')
    }
  }

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onCerrar}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card border border-gray-800/50 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-700/50 sticky top-0 bg-card z-10">
                <div>
                  <h2 className="text-lg font-semibold text-texto-primary">Rutina de Ejercicios</h2>
                  <p className="text-sm text-texto-muted mt-0.5">{paciente?.nombre_completo}</p>
                </div>
                <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                  <X className="w-5 h-5 text-texto-muted" />
                </button>
              </div>

              {cargando ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="p-5 space-y-6">
                  {/* Buscar ejercicios */}
                  <div>
                    <p className="text-sm font-medium text-texto-secondary mb-2">Buscar ejercicios</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                        placeholder="Ej: press, sentadilla, curl..."
                        className="input flex-1 text-sm"
                      />
                      <button onClick={manejarBusqueda} className="btn-primary px-3" disabled={buscando || !terminoBusqueda.trim()}>
                        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                    {resultadosBusqueda.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {resultadosBusqueda.map((ej) => (
                          <button
                            key={ej.id}
                            onClick={() => agregarEjercicio(ej)}
                            className="w-full text-left p-2.5 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors border border-transparent hover:border-primary/30"
                          >
                            <p className="text-sm font-medium text-texto-primary">{ej.nombre}</p>
                            {ej.descripcion && (
                              <p className="text-xs text-texto-muted line-clamp-1">{ej.descripcion}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de ejercicios */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-texto-primary">
                        Ejercicios ({items.length})
                      </h3>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-texto-muted/50 italic">Sin ejercicios — busca y agrega desde arriba.</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item, idx) => (
                          <div key={item.id_temp} className="rounded-xl bg-base-claro/30 border border-gray-800/30 overflow-hidden">
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-texto-primary">{item.nombre_ejercicio}</p>
                                  {item.descripcion && (
                                    <button
                                      onClick={() => setEjercicioExpandido(ejercicioExpandido === item.id_temp ? null : item.id_temp)}
                                      className="text-xs text-primary hover:text-primary-claro mt-0.5"
                                    >
                                      {ejercicioExpandido === item.id_temp ? 'Ocultar descripción' : 'Ver descripción'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => eliminarItem(item.id_temp)} className="p-1.5 rounded text-texto-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <AnimatePresence>
                              {ejercicioExpandido === item.id_temp && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="px-3 pb-3"
                                >
                                  <p className="text-xs text-texto-secondary leading-relaxed">{item.descripcion}</p>
                                  {(item.imagen_url || item.video_url) && (
                                    <div className="flex gap-2 mt-2">
                                      {item.imagen_url && (
                                        <a href={item.imagen_url} target="_blank" rel="noopener noreferrer"
                                          className="text-xs text-primary hover:text-primary-claro flex items-center gap-1">
                                          <ExternalLink className="w-3 h-3" /> Ver imagen
                                        </a>
                                      )}
                                      {item.video_url && (
                                        <a href={item.video_url} target="_blank" rel="noopener noreferrer"
                                          className="text-xs text-primary hover:text-primary-claro flex items-center gap-1">
                                          <ExternalLink className="w-3 h-3" /> Ver video
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Series</label>
                                <input
                                  type="number"
                                  value={item.series}
                                  onChange={(e) => actualizarCampo(item.id_temp, 'series', Math.max(1, Number(e.target.value)))}
                                  className="input text-xs py-1.5 px-2"
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Repeticiones</label>
                                <input
                                  type="text"
                                  value={item.repeticiones}
                                  onChange={(e) => actualizarCampo(item.id_temp, 'repeticiones', e.target.value)}
                                  className="input text-xs py-1.5 px-2"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Descanso</label>
                                <input
                                  type="text"
                                  value={item.descanso}
                                  onChange={(e) => actualizarCampo(item.id_temp, 'descanso', e.target.value)}
                                  className="input text-xs py-1.5 px-2"
                                  placeholder="60 seg"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-3 pt-2 border-t border-gray-700/30">
                    <button onClick={eliminarRutina} className="btn-danger flex-1 text-sm flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Eliminar Rutina
                    </button>
                    <button onClick={guardarRutina} disabled={guardando} className="btn-primary flex-[2] flex items-center justify-center gap-2">
                      {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {guardando ? 'Guardando...' : 'Asignar Rutina'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
