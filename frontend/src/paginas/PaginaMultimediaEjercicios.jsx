import { useState, useEffect, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, Loader2, Dumbbell, Film, Image as ImageIcon, CheckCircle2,
  ChevronLeft, ChevronRight, Upload, Pencil, PartyPopper,
} from 'lucide-react'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { listarMultimediaEjerciciosFast, urlArchivo } from '../servicios/ApiServicio'
import { alertaError } from '../servicios/AlertasServicio'
import ModalMultimediaEjercicio from '../componentes/ModalMultimediaEjercicio'

const POR_PAGINA = 12
const RESUMEN_VACIO = { total: 0, pendientes: 0, sin_video: 0, sin_imagen: 0, completos: 0 }

const FILTROS = [
  { clave: 'pendientes', etiqueta: 'Pendientes' },
  { clave: 'sin_video', etiqueta: 'Sin video' },
  { clave: 'sin_imagen', etiqueta: 'Sin imagen' },
  { clave: 'completos', etiqueta: 'Completos' },
  { clave: 'todos', etiqueta: 'Todos' },
]

function Insignia({ ok, texto, icono: Icono }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
        ok
          ? 'border-exito/30 bg-exito/10 text-exito'
          : 'border-accent/30 bg-accent/10 text-accent'
      }`}
    >
      <Icono className="w-3 h-3" />
      {ok ? texto : `Sin ${texto.toLowerCase()}`}
    </span>
  )
}

function TarjetaEjercicio({ ejercicio, onAbrir }) {
  const tieneImagen = !!ejercicio.imagen_url
  const tieneVideo = !!ejercicio.video_url
  const completo = tieneImagen && tieneVideo

  return (
    <div className="tarjeta-hover !p-0 overflow-hidden flex flex-col">
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        {tieneImagen ? (
          <img
            src={urlArchivo(ejercicio.imagen_url)}
            alt={ejercicio.nombre}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-texto-muted/60">
            <Dumbbell className="w-8 h-8" />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-sm font-semibold text-texto-primary line-clamp-2 min-h-[2.5rem]">{ejercicio.nombre}</p>
        <div className="flex flex-wrap gap-1.5">
          <Insignia ok={tieneImagen} texto="Imagen" icono={ImageIcon} />
          <Insignia ok={tieneVideo} texto="Video" icono={Film} />
        </div>
        <button
          onClick={() => onAbrir(ejercicio)}
          className={`mt-auto text-xs flex items-center justify-center gap-2 py-2 ${
            completo ? 'btn-secondary' : 'btn-primary'
          }`}
        >
          {completo ? <Pencil className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {completo ? 'Editar multimedia' : 'Agregar multimedia'}
        </button>
      </div>
    </div>
  )
}

export default function PaginaMultimediaEjercicios() {
  const { usuario } = useAutenticacion()
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [estado, setEstado] = useState('pendientes')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState({ items: [], total: 0, resumen: RESUMEN_VACIO })
  const [cargando, setCargando] = useState(true)
  const [ejercicioEditando, setEjercicioEditando] = useState(null)
  const idPeticion = useRef(0)

  // Espera a que el usuario deje de escribir antes de consultar.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim())
      setPagina(1)
    }, 350)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const miPeticion = ++idPeticion.current
    if (!silencioso) setCargando(true)
    try {
      const respuesta = await listarMultimediaEjerciciosFast({
        q: busquedaAplicada || undefined,
        estado,
        pagina,
        limite: POR_PAGINA,
      })
      if (miPeticion !== idPeticion.current) return // llegó una respuesta más nueva
      setDatos(respuesta.data)
    } catch (err) {
      if (miPeticion !== idPeticion.current) return
      alertaError('Error', err.response?.data?.detail || 'No se pudo cargar el catálogo de ejercicios.')
    } finally {
      if (miPeticion === idPeticion.current) setCargando(false)
    }
  }, [busquedaAplicada, estado, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (usuario && usuario.rol !== 'nutriologo' && usuario.rol !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const totalPaginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA))
  const resumen = datos.resumen || RESUMEN_VACIO

  const cambiarEstado = (nuevoEstado) => {
    setEstado(nuevoEstado)
    setPagina(1)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Multimedia de ejercicios</h2>
        <p className="text-sm text-texto-muted mt-1">
          Sube imágenes y videos a los ejercicios que no los tienen. Lo que agregues aquí aparece
          automáticamente al asignar rutinas a tus pacientes.
        </p>
      </div>

      <div className="tarjeta mb-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-texto-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar ejercicio por nombre..."
            className="input pl-10 text-sm"
            maxLength={100}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map(({ clave, etiqueta }) => (
            <button
              key={clave}
              onClick={() => cambiarEstado(clave)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                estado === clave
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'border-gray-700/50 text-texto-muted hover:text-texto-secondary hover:border-gray-600'
              }`}
            >
              {etiqueta}
              <span className="text-[11px] opacity-80">({resumen[clave === 'todos' ? 'total' : clave]})</span>
            </button>
          ))}
        </div>
      </div>

      {cargando && datos.items.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : datos.items.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16 text-center">
          {estado === 'pendientes' && !busquedaAplicada && resumen.total > 0 ? (
            <>
              <PartyPopper className="w-12 h-12 text-exito/60 mb-3" />
              <p className="text-texto-secondary text-sm font-medium">¡Todos los ejercicios tienen imagen y video!</p>
              <p className="text-texto-muted text-xs mt-1">No hay nada pendiente por subir.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-texto-muted/40 mb-3" />
              <p className="text-texto-secondary text-sm font-medium">Sin resultados</p>
              <p className="text-texto-muted text-xs mt-1">
                Prueba con otra búsqueda o cambia el filtro.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={`transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {datos.items.map((ejercicio) => (
              <TarjetaEjercicio key={ejercicio.id} ejercicio={ejercicio} onAbrir={setEjercicioEditando} />
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1 || cargando}
                className="btn-secondary !px-3 !py-2 disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-texto-secondary">
                Página {pagina} de {totalPaginas} · {datos.total} ejercicios
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas || cargando}
                className="btn-secondary !px-3 !py-2 disabled:opacity-40"
                aria-label="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <ModalMultimediaEjercicio
        abierto={!!ejercicioEditando}
        ejercicio={ejercicioEditando}
        idUsuario={usuario?.id_usuario}
        onCerrar={() => setEjercicioEditando(null)}
        onGuardado={() => cargar({ silencioso: true })}
      />
    </motion.div>
  )
}
