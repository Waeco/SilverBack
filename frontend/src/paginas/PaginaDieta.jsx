import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerComidas, obtenerDiasConComidas, obtenerUsuario } from '../servicios/ApiServicio'
import { Utensils, ChevronLeft, ChevronRight } from 'lucide-react'

const COLORES_TIPO = {
  desayuno: 'border-blue-500/30 bg-blue-500/5',
  colacion_1: 'border-yellow-500/30 bg-yellow-500/5',
  comida: 'border-emerald-500/30 bg-emerald-500/5',
  colacion_2: 'border-orange-500/30 bg-orange-500/5',
  cena: 'border-purple-500/30 bg-purple-500/5',
}

const ETIQUETAS_TIPO = {
  desayuno: 'Desayuno',
  colacion_1: 'Colación 1',
  comida: 'Comida',
  colacion_2: 'Colación 2',
  cena: 'Cena',
}

function formatearFecha(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

export default function PaginaDieta() {
  const { usuario } = useAutenticacion()
  const [idPaciente, setIdPaciente] = useState(null)
  const [fecha, setFecha] = useState(new Date())
  const [comidas, setComidas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [diasConComidas, setDiasConComidas] = useState([])
  const fechaStr = formatearFecha(fecha)

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

  const cargarComidas = useCallback(async () => {
    if (!idPaciente) return
    setCargando(true)
    try {
      const r = await obtenerComidas(fechaStr, idPaciente)
      setComidas(r.data.comidas || [])
      const mes = fechaStr.slice(0, 7)
      const r2 = await obtenerDiasConComidas(mes, idPaciente)
      setDiasConComidas(r2.data.fechas || [])
    } catch {
      setComidas([])
    } finally {
      setCargando(false)
    }
  }, [idPaciente, fechaStr])

  useEffect(() => { cargarComidas() }, [cargarComidas])

  const cambiarDia = (delta) => {
    const nueva = new Date(fecha)
    nueva.setDate(nueva.getDate() + delta)
    setFecha(nueva)
  }

  const totalCalorias = comidas.reduce((s, c) => s + Number(c.calorias_totales || 0), 0)
  const totalProteinas = comidas.reduce((s, c) => s + Number(c.proteinas_totales || 0), 0)
  const totalCarbos = comidas.reduce((s, c) => s + Number(c.carbohidratos_totales || 0), 0)
  const totalGrasas = comidas.reduce((s, c) => s + Number(c.grasas_totales || 0), 0)

  const agrupadas = {}
  comidas.forEach(c => {
    if (!agrupadas[c.tipo_comida]) agrupadas[c.tipo_comida] = []
    agrupadas[c.tipo_comida].push(c)
  })

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Dieta del Día</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="tarjeta-hover">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => cambiarDia(-1)} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                <ChevronLeft className="w-5 h-5 text-texto-muted" />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-texto-primary capitalize">
                  {fecha.toLocaleDateString('es-MX', { weekday: 'long' })}
                </p>
                <p className="text-xs text-texto-muted">
                  {fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => cambiarDia(1)} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                <ChevronRight className="w-5 h-5 text-texto-muted" />
              </button>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-800/50">
              <div className="text-center">
                <p className="text-3xl font-bold text-texto-primary">{Math.round(totalCalorias)}</p>
                <p className="text-xs text-texto-muted">kcal totales</p>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400">Proteína</span>
                  <span className="text-texto-muted">{Math.round(totalProteinas)}g</span>
                </div>
                <div className="barra-macro">
                  <div className="barra-macro-llenado bg-blue-500" style={{ width: `${Math.min((totalProteinas / 200) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400">Carbohidratos</span>
                  <span className="text-texto-muted">{Math.round(totalCarbos)}g</span>
                </div>
                <div className="barra-macro">
                  <div className="barra-macro-llenado bg-amber-500" style={{ width: `${Math.min((totalCarbos / 300) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-red-400">Grasas</span>
                  <span className="text-texto-muted">{Math.round(totalGrasas)}g</span>
                </div>
                <div className="barra-macro">
                  <div className="barra-macro-llenado bg-red-500" style={{ width: `${Math.min((totalGrasas / 80) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/50">
              <p className="text-xs text-texto-muted mb-2">Días con registro este mes:</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                  const testFecha = `${fechaStr.slice(0, 7)}-${String(d).padStart(2, '0')}`
                  const tiene = diasConComidas.includes(testFecha)
                  return (
                    <button
                      key={d}
                      onClick={() => setFecha(new Date(parseInt(fechaStr.slice(0, 4)), parseInt(fechaStr.slice(5, 7)) - 1, d))}
                      className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                        testFecha === fechaStr
                          ? 'bg-primary text-white'
                          : tiene
                            ? 'bg-primary/20 text-primary'
                            : 'text-texto-muted hover:text-texto-primary hover:bg-base-claro'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {cargando ? (
            <div className="tarjeta">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-base-claro rounded-lg" />)}
              </div>
            </div>
          ) : comidas.length === 0 ? (
            <div className="tarjeta flex flex-col items-center justify-center py-16">
              <Utensils className="w-12 h-12 text-texto-muted/50 mb-3" />
              <p className="text-texto-secondary text-sm">Sin comidas registradas este día</p>
              <p className="text-texto-muted text-xs mt-1">Usa el Dashboard para agregar comidas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(ETIQUETAS_TIPO).map(([tipo, etiqueta]) => {
                const items = agrupadas[tipo]
                if (!items) return null
                const subtotalCal = items.reduce((s, c) => s + Number(c.calorias_totales || 0), 0)
                const subtotalPro = items.reduce((s, c) => s + Number(c.proteinas_totales || 0), 0)
                const subtotalCar = items.reduce((s, c) => s + Number(c.carbohidratos_totales || 0), 0)
                const subtotalGra = items.reduce((s, c) => s + Number(c.grasas_totales || 0), 0)
                return (
                  <motion.div key={tipo} className={`tarjeta-hover border-l-4 ${COLORES_TIPO[tipo]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-texto-primary">{etiqueta}</h3>
                      <span className="text-xs text-texto-muted">{Math.round(subtotalCal)} kcal</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((comida) => (
                        <div key={comida.id_comida} className="flex items-center justify-between py-2 px-3 rounded-lg bg-base-claro/30">
                          <div>
                            <p className="text-sm font-medium text-texto-primary">{comida.nombre_alimento}</p>
                            <p className="text-xs text-texto-muted">{comida.cantidad} {comida.unidad}</p>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span className="text-blue-400">{Math.round(comida.proteinas_totales)}g</span>
                            <span className="text-amber-400">{Math.round(comida.carbohidratos_totales)}g</span>
                            <span className="text-red-400">{Math.round(comida.grasas_totales)}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-3 pt-2 border-t border-gray-800/30 text-xs text-texto-muted">
                      <span className="text-blue-400">P: {Math.round(subtotalPro)}g</span>
                      <span className="text-amber-400">C: {Math.round(subtotalCar)}g</span>
                      <span className="text-red-400">G: {Math.round(subtotalGra)}g</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
