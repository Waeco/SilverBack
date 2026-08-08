import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Loader2, Trash2, Save, GripVertical, Dumbbell } from 'lucide-react'
import { buscarEjerciciosFast, obtenerCategoriasEjercicios, buscarEjerciciosPorCategoria, obtenerRutinaPacienteFast, crearRutinaFast, desactivarRutinaFast } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

const DIAS = ['Todos los días', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const EQUIPOS = ['Sin especificar', 'Peso corporal', 'Mancuernas', 'Barra', 'Máquina', 'Banda de resistencia', 'Kettlebell', 'Otro']

export default function EditorRutinaPaciente({ abierto, onCerrar, paciente, idNutriologo }) {
  const [nombreRutina, setNombreRutina] = useState('Rutina asignada')
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [ejercicioExpandido, setEjercicioExpandido] = useState(null)
  const [diaParaAgregar, setDiaParaAgregar] = useState('Todos los días')
  const [filtroDia, setFiltroDia] = useState('Todos')
  const [idArrastrado, setIdArrastrado] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('')

  const cargarRutina = useCallback(async () => {
    if (!paciente) return
    setCargando(true)
    try {
      const respuesta = await obtenerRutinaPacienteFast(paciente.id_paciente)
      const existentes = (respuesta.data.detalles || []).map(d => ({
        ...d,
        dia_semana: d.dia_semana || 'Todos los días',
        equipo: d.equipo || 'Sin especificar',
        progresion_peso: d.progresion_peso || '',
        id_temp: Date.now() + Math.random(),
      }))
      setItems(existentes)
      setNombreRutina(respuesta.data.rutina?.nombre_rutina || 'Rutina asignada')
      setFiltroDia('Todos')
    } catch {
      setItems([])
      setNombreRutina('Rutina asignada')
    } finally {
      setCargando(false)
    }
  }, [paciente])

  useEffect(() => {
    if (abierto) {
      cargarRutina()
      obtenerCategoriasEjercicios().then(r => setCategorias(r.data || [])).catch(() => setCategorias([]))
    }
  }, [abierto, cargarRutina])

  const manejarBusqueda = useCallback(async () => {
    if (categoriaActiva) {
      const respuesta = await buscarEjerciciosPorCategoria(categoriaActiva, terminoBusqueda)
      setResultadosBusqueda(respuesta.data || [])
      return
    }
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
  }, [terminoBusqueda, categoriaActiva])

  const seleccionarCategoria = async (cat) => {
    setCategoriaActiva(cat)
    setResultadosBusqueda([])
    if (cat) {
      setBuscando(true)
      try {
        const respuesta = await buscarEjerciciosPorCategoria(cat)
        setResultadosBusqueda(respuesta.data || [])
      } catch {
        setResultadosBusqueda([])
      } finally {
        setBuscando(false)
      }
    }
  }

  const agregarEjercicio = (ejercicio) => {
    if (items.length >= 10) return
    const nuevo = {
      id_temp: Date.now() + Math.random(),
      id_ejercicio: String(ejercicio.id),
      nombre_ejercicio: ejercicio.nombre,
      descripcion: ejercicio.descripcion || '',
      series: 3,
      repeticiones: '10',
      descanso: '60 seg',
      imagen_url: ejercicio.imagen_url || ejercicio.imagen || '',
      video_url: ejercicio.video_url || ejercicio.video || '',
      dia_semana: diaParaAgregar,
      equipo: 'Sin especificar',
      progresion_peso: '',
    }
    setItems([...items, nuevo])
    setResultadosBusqueda([])
    setTerminoBusqueda('')
  }

  const expandirEjercicio = (item) => {
    const idTemp = item.id_temp
    setEjercicioExpandido(prev => prev === idTemp ? null : idTemp)
  }

  const eliminarItem = (idTemp) => {
    setItems(prev => prev.filter(i => i.id_temp !== idTemp))
  }

  const actualizarCampo = (idTemp, campo, valor) => {
    setItems(prev => prev.map(i => i.id_temp === idTemp ? { ...i, [campo]: valor } : i))
  }

  // --- Arrastrar y soltar para reordenar ---
  const manejarInicioArrastre = (idTemp) => {
    setIdArrastrado(idTemp)
  }

  const manejarSoltar = (idTempDestino) => {
    if (!idArrastrado || idArrastrado === idTempDestino) {
      setIdArrastrado(null)
      return
    }
    setItems(prev => {
      const lista = [...prev]
      const desdeIdx = lista.findIndex(i => i.id_temp === idArrastrado)
      const haciaIdx = lista.findIndex(i => i.id_temp === idTempDestino)
      if (desdeIdx === -1 || haciaIdx === -1) return prev
      const [movido] = lista.splice(desdeIdx, 1)
      lista.splice(haciaIdx, 0, movido)
      return lista
    })
    setIdArrastrado(null)
  }

  const guardarRutina = async () => {
    if (items.length === 0) {
      alertaError('Error', 'Agrega al menos un ejercicio a la rutina.')
      return
    }
    if (items.length > 10) {
      alertaError('Límite alcanzado', 'La rutina no puede tener más de 10 ejercicios.')
      return
    }
    setGuardando(true)
    try {
      const ejercicios = items.map((i, idx) => ({
        ejercicio_id: parseInt(i.id_ejercicio) || 0,
        nombre_ejercicio: i.nombre_ejercicio,
        descripcion: i.descripcion,
        series: i.series,
        repeticiones: String(i.repeticiones),
        descanso: i.descanso,
        imagen_url: i.imagen_url,
        video_url: i.video_url,
        orden: idx,
        dia_semana: i.dia_semana,
        equipo: i.equipo === 'Sin especificar' ? null : i.equipo,
        progresion_peso: i.progresion_peso || null,
      }))
      await crearRutinaFast({
        id_paciente: paciente.id_paciente,
        id_asignador: idNutriologo,
        rol_asignador: 'nutriologo',
        nombre_rutina: nombreRutina.trim() || 'Rutina asignada',
        ejercicios,
      })
      alertaExito('Rutina asignada', 'La rutina se ha asignado correctamente al paciente.')
      onCerrar()
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || err.response?.data?.error || 'Error al guardar la rutina.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarRutina = async () => {
    const result = await alertaConfirmar('Eliminar rutina',
      '¿Estás seguro? El paciente podrá crear su propia rutina nuevamente.')
    if (!result.isConfirmed) return
    try {
      const respuesta = await obtenerRutinaPacienteFast(paciente.id_paciente)
      if (respuesta.data.rutina) {
        await desactivarRutinaFast(respuesta.data.rutina.id_plan_rutina)
        alertaExito('Rutina eliminada', 'La rutina se ha desactivado.')
        onCerrar()
      }
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || err.response?.data?.error || 'Error al eliminar la rutina.')
    }
  }

  const diasConItems = ['Todos', ...DIAS.filter(d => items.some(i => i.dia_semana === d))]
  const itemsVisibles = filtroDia === 'Todos' ? items : items.filter(i => i.dia_semana === filtroDia)
  const reordenarHabilitado = filtroDia === 'Todos'

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
                  {/* Nombre de la rutina */}
                  <div>
                    <label className="text-sm font-medium text-texto-secondary mb-1.5 block">Nombre de la rutina</label>
                    <input
                      type="text"
                      value={nombreRutina}
                      onChange={(e) => setNombreRutina(e.target.value)}
                      placeholder="Ej: Rutina de fuerza — fase 1"
                      className="input text-sm w-full"
                      maxLength={100}
                    />
                  </div>

                  {/* Buscar ejercicios */}
                  <div>
                    <p className="text-sm font-medium text-texto-secondary mb-2">Buscar ejercicios</p>

                    {/* Categorías */}
                    {categorias.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <button
                          onClick={() => seleccionarCategoria('')}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            categoriaActiva === ''
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'border-gray-700/50 text-texto-muted hover:text-texto-secondary hover:border-gray-600'
                          }`}
                        >
                          Todos
                        </button>
                        {categorias.map((c) => (
                          <button
                            key={c.nombre}
                            onClick={() => seleccionarCategoria(c.nombre)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              categoriaActiva === c.nombre
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'border-gray-700/50 text-texto-muted hover:text-texto-secondary hover:border-gray-600'
                            }`}
                          >
                            {c.nombre}
                            <span className="ml-1 opacity-60">({c.total})</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        type="text"
                        value={terminoBusqueda}
                        onChange={(e) => {
                          setTerminoBusqueda(e.target.value)
                          if (categoriaActiva && e.target.value.trim().length >= 3) manejarBusqueda()
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                        placeholder={categoriaActiva ? `Buscar dentro de ${categoriaActiva}...` : "Ej: press, sentadilla, curl..."}
                        className="input flex-1 text-sm min-w-[140px]"
                      />
                      <select
                        value={diaParaAgregar}
                        onChange={(e) => setDiaParaAgregar(e.target.value)}
                        className="input text-sm w-auto"
                        title="Día al que se asignará el ejercicio agregado"
                      >
                        {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <button onClick={manejarBusqueda} className="btn-primary px-3" disabled={buscando || (!terminoBusqueda.trim() && !categoriaActiva)}>
                        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                    {items.length >= 10 && (
                      <p className="text-xs text-warning mt-1">Límite de 10 ejercicios alcanzado.</p>
                    )}
                    {resultadosBusqueda.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                        {resultadosBusqueda.map((ej) => (
                          <button
                            key={ej.id}
                            onClick={() => agregarEjercicio(ej)}
                            disabled={items.length >= 10}
                            className="w-full text-left p-2.5 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors border border-transparent hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
                          >
                            {ej.imagen_url ? (
                              <img
                                src={ej.imagen_url}
                                alt={ej.nombre}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-900"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-800/60 flex items-center justify-center flex-shrink-0">
                                <Dumbbell className="w-4 h-4 text-texto-muted" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-texto-primary">{ej.nombre}</p>
                              {ej.descripcion && (
                                <p className="text-xs text-texto-muted line-clamp-1">{ej.descripcion}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de ejercicios */}
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-texto-primary">
                        Ejercicios ({items.length}/10)
                      </h3>
                      {items.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {diasConItems.map(d => (
                            <button
                              key={d}
                              onClick={() => setFiltroDia(d)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                filtroDia === d
                                  ? 'bg-primary/20 border-primary/50 text-primary'
                                  : 'border-gray-700/50 text-texto-muted hover:text-texto-secondary hover:border-gray-600'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!reordenarHabilitado && itemsVisibles.length > 1 && (
                      <p className="text-xs text-texto-muted/70 italic mb-2">
                        Selecciona "Todos" para poder reordenar los ejercicios arrastrándolos.
                      </p>
                    )}

                    {items.length === 0 ? (
                      <p className="text-xs text-texto-muted/50 italic">Sin ejercicios — busca y agrega desde arriba.</p>
                    ) : itemsVisibles.length === 0 ? (
                      <p className="text-xs text-texto-muted/50 italic">No hay ejercicios asignados a este día.</p>
                    ) : (
                      <div className="space-y-2">
                        {itemsVisibles.map((item, idx) => (
                          <div
                            key={item.id_temp}
                            onDragOver={(e) => reordenarHabilitado && e.preventDefault()}
                            onDrop={() => reordenarHabilitado && manejarSoltar(item.id_temp)}
                            className={`rounded-xl bg-base-claro/30 border overflow-hidden transition-colors ${
                              idArrastrado === item.id_temp ? 'border-primary/60 opacity-50' : 'border-gray-800/30'
                            }`}
                          >
                            <div className="flex items-center justify-between p-3 gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {reordenarHabilitado && (
                                  <span
                                    draggable
                                    onDragStart={() => manejarInicioArrastre(item.id_temp)}
                                    onDragEnd={() => setIdArrastrado(null)}
                                    className="cursor-grab active:cursor-grabbing text-texto-muted/60 hover:text-texto-muted flex-shrink-0 touch-none"
                                    title="Arrastrar para reordenar"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </span>
                                )}
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-texto-primary truncate">{item.nombre_ejercicio}</p>
                                  <button
                                    onClick={() => expandirEjercicio(item)}
                                    className="text-xs text-primary hover:text-primary-claro mt-0.5 flex items-center gap-1"
                                  >
                                    {ejercicioExpandido === item.id_temp ? 'Ocultar detalles' : 'Ver detalles'}
                                  </button>
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
                                  {item.descripcion && (
                                    <p className="text-xs text-texto-secondary leading-relaxed mb-2">{item.descripcion}</p>
                                  )}
                                  {item.imagen_url && (
                                    <div className="mt-2 rounded-xl overflow-hidden border border-gray-800/30">
                                      <img
                                        src={item.imagen_url}
                                        alt={item.nombre_ejercicio}
                                        className="w-full h-auto max-h-60 object-contain bg-gray-900"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}
                                  {item.video_url && (
                                    <div className="mt-2 aspect-video rounded-xl overflow-hidden border border-gray-800/30 bg-gray-900">
                                      {item.video_url.includes('youtube.com/watch') || item.video_url.includes('youtu.be') ? (
                                        <iframe
                                          src={item.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').split('&')[0]}
                                          className="w-full h-full"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                          title={`Video de ${item.nombre_ejercicio}`}
                                        />
                                      ) : (
                                        <video
                                          src={item.video_url}
                                          className="w-full h-full"
                                          controls
                                          playsInline
                                          preload="metadata"
                                        />
                                      )}
                                    </div>
                                  )}
                                  {!item.descripcion && !item.imagen_url && !item.video_url && (
                                    <p className="text-xs text-texto-muted italic">Sin información adicional disponible.</p>
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
                                  onChange={(e) => { const num = Number(e.target.value); if (!isNaN(num)) actualizarCampo(item.id_temp, 'series', Math.max(1, num)) }}
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

                            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Día</label>
                                <select
                                  value={item.dia_semana}
                                  onChange={(e) => actualizarCampo(item.id_temp, 'dia_semana', e.target.value)}
                                  className="input text-xs py-1.5 px-2"
                                >
                                  {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-texto-muted block mb-0.5">Equipo</label>
                                <select
                                  value={item.equipo}
                                  onChange={(e) => actualizarCampo(item.id_temp, 'equipo', e.target.value)}
                                  className="input text-xs py-1.5 px-2"
                                >
                                  {EQUIPOS.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="px-3 pb-3">
                              <label className="text-xs text-texto-muted block mb-0.5">Progresión de peso</label>
                              <input
                                type="text"
                                value={item.progresion_peso}
                                onChange={(e) => actualizarCampo(item.id_temp, 'progresion_peso', e.target.value)}
                                className="input text-xs py-1.5 px-2 w-full"
                                placeholder="Ej: Iniciar con 10 kg, subir 2 kg cada 2 semanas"
                                maxLength={255}
                              />
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
