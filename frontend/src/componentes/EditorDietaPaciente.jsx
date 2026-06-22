import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Loader2, Plus, Trash2, Utensils, Save } from 'lucide-react'
import { buscarAlimentos, obtenerDietaPaciente, asignarDieta, desactivarDieta } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

const TIPOS_COMIDA = [
  { valor: 'desayuno', etiqueta: 'Desayuno', icono: '🌅' },
  { valor: 'colacion_1', etiqueta: 'Colación 1', icono: '☕' },
  { valor: 'comida', etiqueta: 'Comida', icono: '🍽️' },
  { valor: 'colacion_2', etiqueta: 'Colación 2', icono: '🥜' },
  { valor: 'cena', etiqueta: 'Cena', icono: '🌙' },
]

function parsearInfoAlimento(descripcion) {
  const calorias = descripcion.match(/Calorías:\s*([\d.]+)/i)
  const proteinas = descripcion.match(/Proteína:\s*([\d.]+)/i)
  const carbohidratos = descripcion.match(/Carbohidratos:\s*([\d.]+)/i)
  const grasas = descripcion.match(/Grasa:\s*([\d.]+)/i)
  return {
    calorias: calorias ? parseFloat(calorias[1]) : 0,
    proteinas: proteinas ? parseFloat(proteinas[1]) : 0,
    carbohidratos: carbohidratos ? parseFloat(carbohidratos[1]) : 0,
    grasas: grasas ? parseFloat(grasas[1]) : 0,
  }
}

export default function EditorDietaPaciente({ abierto, onCerrar, paciente, idNutriologo }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)

  const cargarDieta = useCallback(async () => {
    if (!paciente) return
    setCargando(true)
    try {
      const respuesta = await obtenerDietaPaciente(paciente.id_paciente)
      const existentes = (respuesta.data.detalles || []).map(d => ({
        ...d,
        id_temp: Date.now() + Math.random(),
        editando: false,
      }))
      setItems(existentes)
    } catch {
      setItems([])
    } finally {
      setCargando(false)
    }
  }, [paciente])

  useEffect(() => {
    if (abierto) cargarDieta()
  }, [abierto, cargarDieta])

  const manejarBusqueda = useCallback(async () => {
    if (!terminoBusqueda.trim()) return
    setBuscando(true)
    try {
      const respuesta = await buscarAlimentos(terminoBusqueda)
      setResultadosBusqueda(respuesta.data?.results || [])
    } catch {
      setResultadosBusqueda([])
    } finally {
      setBuscando(false)
    }
  }, [terminoBusqueda])

  const agregarItem = (alimento) => {
    if (!tipoSeleccionado) return
    const info = parsearInfoAlimento(alimento.food_description || '')
    const factor = 100 / 100
    const nuevo = {
      id_temp: Date.now(),
      tipo_comida: tipoSeleccionado,
      nombre_alimento: alimento.food_name,
      cantidad: 100,
      unidad: 'g',
      calorias_totales: Math.round((info.calorias || 0) * factor),
      proteinas_totales: Math.round(((info.proteinas || 0) * factor) * 10) / 10,
      carbohidratos_totales: Math.round(((info.carbohidratos || 0) * factor) * 10) / 10,
      grasas_totales: Math.round(((info.grasas || 0) * factor) * 10) / 10,
      editando: false,
    }
    setItems([...items, nuevo])
    setResultadosBusqueda([])
    setTerminoBusqueda('')
  }

  const eliminarItem = (idTemp) => {
    setItems(items.filter(i => i.id_temp !== idTemp))
  }

  const itemsPorTipo = {}
  TIPOS_COMIDA.forEach(t => { itemsPorTipo[t.valor] = items.filter(i => i.tipo_comida === t.valor) })

  const guardarDieta = async () => {
    if (items.length === 0) {
      alertaError('Error', 'Agrega al menos un alimento a la dieta.')
      return
    }
    setGuardando(true)
    try {
      const detalles = items.map(i => ({
        tipo_comida: i.tipo_comida,
        nombre_alimento: i.nombre_alimento,
        cantidad: i.cantidad || 100,
        unidad: 'g',
        calorias_totales: i.calorias_totales || 0,
        proteinas_totales: i.proteinas_totales || 0,
        grasas_totales: i.grasas_totales || 0,
        carbohidratos_totales: i.carbohidratos_totales || 0,
      }))
      await asignarDieta({
        id_paciente: paciente.id_paciente,
        id_nutriologo: idNutriologo,
        detalles,
      })
      alertaExito('Dieta asignada', 'La dieta se ha asignado correctamente al paciente.')
      onCerrar()
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al guardar la dieta.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminarDieta = async () => {
    const result = await alertaConfirmar('Eliminar dieta',
      '¿Estás seguro? El paciente podrá agregar sus propias comidas nuevamente.')
    if (!result.isConfirmed) return
    try {
      const respuesta = await obtenerDietaPaciente(paciente.id_paciente)
      if (respuesta.data.dieta) {
        await desactivarDieta(respuesta.data.dieta.id_plan_dieta)
        alertaExito('Dieta eliminada', 'La dieta se ha desactivado.')
        onCerrar()
      }
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al eliminar la dieta.')
    }
  }

  const totalCalorias = items.reduce((s, i) => s + Number(i.calorias_totales || 0), 0)
  const totalProteinas = items.reduce((s, i) => s + Number(i.proteinas_totales || 0), 0)
  const totalCarbos = items.reduce((s, i) => s + Number(i.carbohidratos_totales || 0), 0)
  const totalGrasas = items.reduce((s, i) => s + Number(i.grasas_totales || 0), 0)

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
                  <h2 className="text-lg font-semibold text-texto-primary">Plan de Dieta</h2>
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
                  {/* Selector de tipo + búsqueda */}
                  <div>
                    <p className="text-sm font-medium text-texto-secondary mb-2">Agregar alimento a:</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {TIPOS_COMIDA.map(t => (
                        <button
                          key={t.valor}
                          onClick={() => setTipoSeleccionado(tipoSeleccionado === t.valor ? null : t.valor)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            tipoSeleccionado === t.valor
                              ? 'bg-primary text-white'
                              : 'bg-base-claro text-texto-secondary hover:text-texto-primary'
                          }`}
                        >
                          {t.etiqueta}
                        </button>
                      ))}
                    </div>
                    {tipoSeleccionado && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={terminoBusqueda}
                          onChange={(e) => setTerminoBusqueda(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                          placeholder="Buscar alimento..."
                          className="input flex-1 text-sm"
                        />
                        <button onClick={manejarBusqueda} className="btn-primary px-3" disabled={buscando || !terminoBusqueda.trim()}>
                          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                    {resultadosBusqueda.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {resultadosBusqueda.map((alimento) => (
                          <button
                            key={alimento.food_id}
                            onClick={() => agregarItem(alimento)}
                            className="w-full text-left p-2.5 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors border border-transparent hover:border-primary/30"
                          >
                            <p className="text-sm font-medium text-texto-primary">{alimento.food_name}</p>
                            <p className="text-xs text-texto-muted line-clamp-1">{alimento.food_description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Items por tipo de comida */}
                  {TIPOS_COMIDA.map(t => {
                    const grupo = itemsPorTipo[t.valor]
                    return (
                      <div key={t.valor}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{t.icono}</span>
                          <h3 className="text-sm font-semibold text-texto-primary">{t.etiqueta}</h3>
                          <span className="text-xs text-texto-muted">({grupo.length} alimentos)</span>
                        </div>
                        {grupo.length === 0 ? (
                          <p className="text-xs text-texto-muted/50 italic pl-7">Sin alimentos — selecciona "{t.etiqueta}" arriba y busca un alimento.</p>
                        ) : (
                          <div className="space-y-1.5 pl-7">
                            {grupo.map((item) => (
                              <div key={item.id_temp} className="flex items-center justify-between p-2.5 rounded-lg bg-base-claro/30 border border-gray-800/30 group">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-texto-primary">{item.nombre_alimento}</p>
                                  <p className="text-xs text-texto-muted">
                                    {item.cantidad}{item.unidad} · {Math.round(item.calorias_totales)} kcal
                                    <span className="ml-2 text-blue-400/70">{Math.round(item.proteinas_totales)}g P</span>
                                    <span className="ml-1.5 text-amber-400/70">{Math.round(item.carbohidratos_totales)}g C</span>
                                    <span className="ml-1.5 text-red-400/70">{Math.round(item.grasas_totales)}g G</span>
                                  </p>
                                </div>
                                <button onClick={() => eliminarItem(item.id_temp)} className="p-1 rounded text-texto-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Totales */}
                  {items.length > 0 && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-sm font-semibold text-texto-primary mb-2">Totales del plan</p>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="texto-display text-xl text-texto-primary">{Math.round(totalCalorias)}</p>
                          <p className="text-xs text-texto-muted">kcal</p>
                        </div>
                        <div>
                          <p className="texto-display text-xl text-blue-400">{Math.round(totalProteinas)}</p>
                          <p className="text-xs text-texto-muted">Proteína</p>
                        </div>
                        <div>
                          <p className="texto-display text-xl text-amber-400">{Math.round(totalCarbos)}</p>
                          <p className="text-xs text-texto-muted">Carbos</p>
                        </div>
                        <div>
                          <p className="texto-display text-xl text-red-400">{Math.round(totalGrasas)}</p>
                          <p className="text-xs text-texto-muted">Grasa</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-3 pt-2 border-t border-gray-700/30">
                    <button onClick={eliminarDieta} className="btn-danger flex-1 text-sm flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Eliminar Dieta
                    </button>
                    <button onClick={guardarDieta} disabled={guardando} className="btn-primary flex-[2] flex items-center justify-center gap-2">
                      {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {guardando ? 'Guardando...' : 'Asignar Dieta'}
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
