import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Dumbbell, Plus, Trash2, Search, X, Save, Target, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerRutinaPacienteFast, crearRutinaFast, desactivarRutinaFast, buscarEjerciciosFast, obtenerUsuario } from '../servicios/ApiServicio'
import { alertaExito, alertaError } from '../servicios/AlertasServicio'

export default function PaginaRutina() {
  const { usuario } = useAutenticacion()
  const [idPaciente, setIdPaciente] = useState(null)
  const [rutinaActual, setRutinaActual] = useState(null)
  const [detalles, setDetalles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [esPlanPropio, setEsPlanPropio] = useState(true)

  const [modoEdicion, setModoEdicion] = useState(false)
  const [itemsEdit, setItemsEdit] = useState([])
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ejercicioExpandido, setEjercicioExpandido] = useState(null)

  // Cargar perfil para obtener id_paciente
  useEffect(() => {
    if (!usuario) return
    const cargarPerfil = async () => {
      try {
        const r = await obtenerUsuario(usuario.id_usuario)
        if (r.data.usuario.perfil) {
          setIdPaciente(r.data.usuario.perfil.id_paciente)
        }
      } catch {
        setIdPaciente(null)
      }
    }
    cargarPerfil()
  }, [usuario])

  const cargarRutina = useCallback(async () => {
    if (!idPaciente) return
    setCargando(true)
    try {
      const respuesta = await obtenerRutinaPacienteFast(idPaciente)
      const data = respuesta.data
      if (data.rutina && data.rutina.id_nutriologo) {
        setRutinaActual(data.rutina)
        setDetalles(data.detalles || [])
        setEsPlanPropio(false)
      } else if (data.rutina) {
        setRutinaActual(data.rutina)
        setDetalles(data.detalles || [])
        setEsPlanPropio(true)
      } else {
        setRutinaActual(null)
        setDetalles([])
        setEsPlanPropio(true)
      }
    } catch {
      setRutinaActual(null)
      setDetalles([])
      setEsPlanPropio(true)
    } finally {
      setCargando(false)
    }
  }, [idPaciente])

  useEffect(() => {
    cargarRutina()
  }, [cargarRutina])

  const abrirEditor = () => {
    setItemsEdit(detalles.map(d => ({ ...d, id_temp: Date.now() + Math.random() })))
    setModoEdicion(true)
  }

  const cerrarEditor = () => {
    setModoEdicion(false)
    setTerminoBusqueda('')
    setResultadosBusqueda([])
    setEjercicioExpandido(null)
  }

  const manejarBusqueda = useCallback(async () => {
    if (!terminoBusqueda.trim()) return
    setBuscando(true)
    try {
      const respuesta = await buscarEjerciciosFast(terminoBusqueda)
      setResultadosBusqueda(respuesta.data || [])
    } catch {
      setResultadosBusqueda([])
    } finally {
      setBuscando(false)
    }
  }, [terminoBusqueda])

  const agregarEjercicio = (ejercicio) => {
    if (itemsEdit.length >= 10) return
    const nuevo = {
      id_temp: Date.now(),
      id_ejercicio: String(ejercicio.id),
      nombre_ejercicio: ejercicio.nombre,
      descripcion: ejercicio.descripcion || '',
      series: 3,
      repeticiones: '10',
      descanso: '60 seg',
      imagen_url: ejercicio.imagen_url || ejercicio.imagen || '',
      video_url: ejercicio.video_url || ejercicio.video || '',
    }
    setItemsEdit([...itemsEdit, nuevo])
    setResultadosBusqueda([])
    setTerminoBusqueda('')
  }

  const eliminarItem = (idTemp) => {
    setItemsEdit(itemsEdit.filter(i => i.id_temp !== idTemp))
  }

  const actualizarCampo = (idTemp, campo, valor) => {
    setItemsEdit(itemsEdit.map(i => i.id_temp === idTemp ? { ...i, [campo]: valor } : i))
  }

  const guardarRutinaPropia = async () => {
    if (itemsEdit.length === 0) {
      alertaError('Error', 'Agrega al menos un ejercicio a tu rutina.')
      return
    }
    if (itemsEdit.length > 10) {
      alertaError('Límite alcanzado', 'La rutina no puede tener más de 10 ejercicios.')
      return
    }
    setGuardando(true)
    try {
      const ejercicios = itemsEdit.map((i, idx) => ({
        ejercicio_id: parseInt(i.id_ejercicio) || 0,
        nombre_ejercicio: i.nombre_ejercicio,
        descripcion: i.descripcion,
        series: i.series,
        repeticiones: String(i.repeticiones),
        descanso: i.descanso,
        imagen_url: i.imagen_url,
        video_url: i.video_url,
        orden: idx,
      }))
      if (rutinaActual && esPlanPropio) {
        await desactivarRutinaFast(rutinaActual.id_plan_rutina)
      }
      await crearRutinaFast({
        id_paciente: idPaciente,
        nombre_rutina: 'Rutina personal',
        ejercicios,
      })
      alertaExito('Rutina guardada', 'Tu rutina se ha guardado correctamente.')
      cerrarEditor()
      cargarRutina()
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || err.response?.data?.error || 'Error al guardar la rutina.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarRutinaPropia = async () => {
    if (!rutinaActual) return
    try {
      await desactivarRutinaFast(rutinaActual.id_plan_rutina)
      alertaExito('Rutina eliminada', 'Tu rutina ha sido eliminada.')
      setRutinaActual(null)
      setDetalles([])
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || err.response?.data?.error || 'Error al eliminar la rutina.')
    }
  }

  const expandirEjercicio = (idx) => {
    setEjercicioExpandido(ejercicioExpandido === idx ? null : idx)
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-texto-primary">Rutina de Ejercicios</h1>
          <p className="text-sm text-texto-muted mt-1">
            {esPlanPropio ? 'Tu plan de entrenamiento' : 'Plan asignado por tu nutriólogo'}
          </p>
        </div>
        {!esPlanPropio ? null : (
          <div className="flex gap-2">
            {detalles.length > 0 && (
              <button onClick={eliminarRutinaPropia} className="btn-danger text-sm px-3 py-2">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={abrirEditor} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {detalles.length > 0 ? 'Editar' : 'Crear Rutina'}
            </button>
          </div>
        )}
      </div>

      {/* Banner de plan del nutriólogo */}
      {!esPlanPropio && (
        <div className="p-4 rounded-xl bg-info/10 border border-info/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-texto-primary">Plan asignado por tu nutriólogo</p>
            <p className="text-xs text-texto-muted mt-0.5">
              Sigue la rutina diseñada para ti. Si tienes dudas, consulta con tu nutriólogo.
            </p>
          </div>
        </div>
      )}

      {/* Lista de ejercicios */}
      {detalles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700/50 p-10 text-center">
          <Dumbbell className="w-12 h-12 text-texto-muted/30 mx-auto mb-3" />
          <p className="text-texto-secondary font-medium">Sin rutina de ejercicios</p>
          <p className="text-xs text-texto-muted mt-1">
            {esPlanPropio
              ? 'Crea tu propia rutina para empezar a entrenar.'
              : 'Tu nutriólogo aún no te ha asignado una rutina.'}
          </p>
          {esPlanPropio && (
            <button onClick={abrirEditor} className="btn-primary mt-4 text-sm px-4 py-2.5 flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Crear Rutina
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {detalles.map((item, idx) => (
            <motion.div
              key={item.id_detalle_rutina || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl bg-base-claro/30 border border-gray-800/30 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-texto-primary">{item.nombre_ejercicio}</p>
                    <button
                      onClick={() => expandirEjercicio(idx, item)}
                      className="text-xs text-primary hover:text-primary-claro flex items-center gap-1 mt-0.5"
                    >
                      {ejercicioExpandido === idx ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {ejercicioExpandido === idx ? 'Ocultar' : 'Ver detalles'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-texto-muted">
                  <div className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>{item.series} × {item.repeticiones}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{item.descanso}</span>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {ejercicioExpandido === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4"
                  >
                    <p className="text-xs text-texto-secondary leading-relaxed">{item.descripcion || 'Sin descripción disponible.'}</p>
                    {item.imagen_url && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-gray-800/30">
                        <img
                          src={item.imagen_url}
                          alt={item.nombre_ejercicio}
                          className="w-full h-auto max-h-80 object-contain bg-gray-900"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {item.video_url && (
                      <div className="mt-3 aspect-video rounded-xl overflow-hidden border border-gray-800/30 bg-gray-900">
                        <iframe
                          src={item.video_url.includes('youtube.com/watch') || item.video_url.includes('youtu.be')
                            ? item.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').split('&')[0]
                            : item.video_url}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={`Video de ${item.nombre_ejercicio}`}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal editor */}
      <AnimatePresence>
        {modoEdicion && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={cerrarEditor}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-card border border-gray-800/50 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-gray-700/50 sticky top-0 bg-card z-10">
                  <h2 className="text-lg font-semibold text-texto-primary">
                    {detalles.length > 0 ? 'Editar Rutina' : 'Crear Rutina'}
                  </h2>
                  <button onClick={cerrarEditor} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                    <X className="w-5 h-5 text-texto-muted" />
                  </button>
                </div>

                <div className="p-5 space-y-6">
                  {/* Buscar */}
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
                    {itemsEdit.length >= 10 && (
                      <p className="text-xs text-warning mt-1">Límite de 10 ejercicios alcanzado.</p>
                    )}
                    {resultadosBusqueda.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {resultadosBusqueda.map((ej) => (
                          <button
                            key={ej.id}
                            onClick={() => agregarEjercicio(ej)}
                            disabled={itemsEdit.length >= 10}
                            className="w-full text-left p-2.5 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors border border-transparent hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
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

                  {/* Items */}
                  <div>
                    <h3 className="text-sm font-semibold text-texto-primary mb-3">
                      Ejercicios ({itemsEdit.length}/10)
                    </h3>
                    {itemsEdit.length === 0 ? (
                      <p className="text-xs text-texto-muted/50 italic">Busca y agrega ejercicios desde arriba.</p>
                    ) : (
                      <div className="space-y-2">
                        {itemsEdit.map((item, idx) => (
                          <div key={item.id_temp} className="rounded-xl bg-base-claro/30 border border-gray-800/30 overflow-hidden">
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-medium text-texto-primary truncate">{item.nombre_ejercicio}</span>
                              </div>
                              <button onClick={() => eliminarItem(item.id_temp)} className="p-1.5 rounded text-texto-muted hover:text-error hover:bg-error/10 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Series</label>
                                <input type="number" value={item.series} onChange={(e) => actualizarCampo(item.id_temp, 'series', Math.max(1, Number(e.target.value)))} className="input text-xs py-1.5 px-2" min="1" />
                              </div>
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Repeticiones</label>
                                <input type="text" value={item.repeticiones} onChange={(e) => actualizarCampo(item.id_temp, 'repeticiones', e.target.value)} className="input text-xs py-1.5 px-2" />
                              </div>
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Descanso</label>
                                <input type="text" value={item.descanso} onChange={(e) => actualizarCampo(item.id_temp, 'descanso', e.target.value)} className="input text-xs py-1.5 px-2" placeholder="60 seg" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={guardarRutinaPropia} disabled={guardando} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {guardando ? 'Guardando...' : 'Guardar Rutina'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
