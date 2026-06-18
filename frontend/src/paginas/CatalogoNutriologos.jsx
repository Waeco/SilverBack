import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { obtenerNutriologos } from '../servicios/ApiServicio'
import { Search, Stethoscope, MapPin, Award, ChevronLeft, ChevronRight, Loader2, BadgeCheck } from 'lucide-react'

export default function CatalogoNutriologos() {
  const [nutriologos, setNutriologos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [termino, setTermino] = useState('')
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)

  const cargar = useCallback(async (pag = 1) => {
    setCargando(true)
    try {
      const respuesta = await obtenerNutriologos({ termino, pagina: pag, limite: 10 })
      setNutriologos(respuesta.data.nutriologos || [])
      setTotal(respuesta.data.total || 0)
      setTotalPaginas(respuesta.data.total_paginas || 1)
      setPagina(respuesta.data.pagina || 1)
    } catch {
      setNutriologos([])
    } finally {
      setCargando(false)
    }
  }, [termino])

  useEffect(() => {
    cargar(1)
  }, [cargar])

  const manejarBusqueda = (e) => {
    e.preventDefault()
    cargar(1)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Nutriólogos</h2>
        <span className="text-sm text-texto-muted">{total} encontrados</span>
      </div>

      <form onSubmit={manejarBusqueda} className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-texto-muted" />
        <input
          type="text"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscar por nombre o especialidad..."
          className="input pl-10 w-full"
        />
      </form>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : nutriologos.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <Stethoscope className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">Sin resultados</p>
          <p className="text-texto-muted text-xs mt-1 mb-5">No encontramos nutriólogos con ese término. Intenta con otro nombre o especialidad.</p>
          <button onClick={() => { setTermino(''); cargar(1) }} className="btn-secondary text-sm">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {nutriologos.map((n, i) => (
              <motion.div
                key={n.id_nutriologo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="tarjeta-hover"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">
                      {n.nombre_completo?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-texto-primary truncate">{n.nombre_completo}</p>
                      {n.verificado ? (
                        <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      ) : null}
                    </div>
                    {n.especialidad && (
                      <p className="text-sm text-texto-secondary mt-0.5 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-texto-muted" />
                        {n.especialidad}
                      </p>
                    )}
                    {n.experiencia && (
                      <p className="text-sm text-texto-muted mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {n.experiencia} años de experiencia
                      </p>
                    )}
                    {n.cedula && (
                      <p className="text-xs text-texto-muted mt-0.5">Céd. {n.cedula}</p>
                    )}
                    {n.biografia && (
                      <p className="text-xs text-texto-muted mt-2 line-clamp-2">{n.biografia}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => cargar(pagina - 1)}
                disabled={pagina <= 1}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => cargar(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    p === pagina
                      ? 'bg-primary text-white'
                      : 'text-texto-secondary hover:text-texto-primary hover:bg-base-claro'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => cargar(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
