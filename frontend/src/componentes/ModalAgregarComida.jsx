import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Loader2, Plus } from 'lucide-react'
import { buscarAlimentos, guardarComida } from '../servicios/ApiServicio'

const TIPOS_COMIDA = [
  { valor: 'desayuno', etiqueta: 'Desayuno' },
  { valor: 'colacion_1', etiqueta: 'Colación 1' },
  { valor: 'comida', etiqueta: 'Comida' },
  { valor: 'colacion_2', etiqueta: 'Colación 2' },
  { valor: 'cena', etiqueta: 'Cena' },
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

export default function ModalAgregarComida({ abierto, onCerrar, idPaciente, fechaSeleccionada, onComidaAgregada }) {
  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [alimentoSeleccionado, setAlimentoSeleccionado] = useState(null)
  const [tipoComida, setTipoComida] = useState('desayuno')
  const [cantidad, setCantidad] = useState(100)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const manejarBusqueda = useCallback(async () => {
    if (!termino.trim()) return
    setBuscando(true)
    setError(null)
    try {
      const respuesta = await buscarAlimentos(termino)
      const foods = respuesta.data?.results || []
      setResultados(foods)
    } catch (err) {
      setError('Error al buscar alimentos')
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }, [termino])

  const seleccionarAlimento = (alimento) => {
    const info = parsearInfoAlimento(alimento.food_description || '')
    setAlimentoSeleccionado({ ...alimento, ...info })
    setResultados([])
    setTermino('')
  }

  const calcularMacros = () => {
    if (!alimentoSeleccionado) return { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
    const factor = cantidad / 100
    return {
      calorias: Math.round((alimentoSeleccionado.calorias || 0) * factor),
      proteinas: Math.round(((alimentoSeleccionado.proteinas || 0) * factor) * 10) / 10,
      carbohidratos: Math.round(((alimentoSeleccionado.carbohidratos || 0) * factor) * 10) / 10,
      grasas: Math.round(((alimentoSeleccionado.grasas || 0) * factor) * 10) / 10,
    }
  }

  const manejarGuardar = async () => {
    if (!alimentoSeleccionado) return
    setGuardando(true)
    setError(null)
    const macros = calcularMacros()
    try {
      await guardarComida({
        id_paciente: idPaciente,
        fecha: fechaSeleccionada,
        tipo_comida: tipoComida,
        nombre_alimento: alimentoSeleccionado.food_name,
        cantidad: cantidad,
        unidad: 'g',
        calorias_totales: macros.calorias,
        proteinas_totales: macros.proteinas,
        grasas_totales: macros.grasas,
        carbohidratos_totales: macros.carbohidratos,
      })
      onComidaAgregada()
      cerrarModal()
    } catch (err) {
      setError('Error al guardar la comida')
    } finally {
      setGuardando(false)
    }
  }

  const cerrarModal = () => {
    setTermino('')
    setResultados([])
    setAlimentoSeleccionado(null)
    setCantidad(100)
    setTipoComida('desayuno')
    setError(null)
    onCerrar()
  }

  const macros = calcularMacros()

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={cerrarModal}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card border border-gray-800/50 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-800/50">
                <h2 className="text-lg font-semibold text-texto-primary">
                  {alimentoSeleccionado ? 'Confirmar Alimento' : 'Agregar Comida'}
                </h2>
                <button onClick={cerrarModal} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                  <X className="w-5 h-5 text-texto-muted" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                    {error}
                  </div>
                )}

                {!alimentoSeleccionado ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={termino}
                        onChange={(e) => setTermino(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && manejarBusqueda()}
                        placeholder="Buscar alimento (ej. pollo, avena, huevo)..."
                        className="input flex-1"
                      />
                      <button onClick={manejarBusqueda} className="btn-primary px-4" disabled={buscando || !termino.trim()}>
                        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>

                    {resultados.length > 0 && (
                      <div className="space-y-2">
                        {resultados.map((alimento) => (
                          <button
                            key={alimento.food_id}
                            onClick={() => seleccionarAlimento(alimento)}
                            className="w-full text-left p-3 rounded-lg bg-base-claro/50 hover:bg-base-claro transition-colors border border-transparent hover:border-primary/30"
                          >
                            <p className="text-sm font-medium text-texto-primary">{alimento.food_name}</p>
                            <p className="text-xs text-texto-muted mt-0.5 line-clamp-1">{alimento.food_description}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {!buscando && !resultados.length && termino && (
                      <p className="text-center text-texto-muted text-sm py-4">
                        No se encontraron alimentos. Intenta con otro término.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-base-claro/50 border border-gray-700/30">
                      <h3 className="font-semibold text-texto-primary">{alimentoSeleccionado.food_name}</h3>
                      <p className="text-xs text-texto-muted mt-1">Valores por 100g</p>
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-texto-primary">{Math.round(alimentoSeleccionado.calorias)}</p>
                          <p className="text-xs text-texto-muted">kcal</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-400">{alimentoSeleccionado.proteinas}</p>
                          <p className="text-xs text-texto-muted">Proteína</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-amber-400">{alimentoSeleccionado.carbohidratos}</p>
                          <p className="text-xs text-texto-muted">Carbos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-400">{alimentoSeleccionado.grasas}</p>
                          <p className="text-xs text-texto-muted">Grasa</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-texto-secondary mb-1.5">Tipo de comida</label>
                        <select
                          value={tipoComida}
                          onChange={(e) => setTipoComida(e.target.value)}
                          className="input"
                        >
                          {TIPOS_COMIDA.map((t) => (
                            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-texto-secondary mb-1.5">Cantidad (g)</label>
                        <input
                          type="number"
                          value={cantidad}
                          onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                          min="1"
                          max="5000"
                          className="input"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-sm font-medium text-texto-primary mb-2">Totales calculados</p>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-sm font-bold text-texto-primary">{macros.calorias}</p>
                          <p className="text-xs text-texto-muted">kcal</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-blue-400">{macros.proteinas}g</p>
                          <p className="text-xs text-texto-muted">Proteína</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-400">{macros.carbohidratos}g</p>
                          <p className="text-xs text-texto-muted">Carbos</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-400">{macros.grasas}g</p>
                          <p className="text-xs text-texto-muted">Grasa</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setAlimentoSeleccionado(null)} className="btn-secondary flex-1">
                        Cambiar Alimento
                      </button>
                      <button onClick={manejarGuardar} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={guardando}>
                        {guardando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {guardando ? 'Guardando...' : 'Agregar a la Dieta'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
