import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Loader2, Trash2, Link2, Image as ImageIcon, Film, Save, CheckCircle2 } from 'lucide-react'
import { guardarMultimediaEjercicioFast, eliminarMultimediaEjercicioFast, urlArchivo } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

const EXTENSIONES = {
  imagen: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  video: ['.mp4', '.mov', '.webm', '.ogg', '.avi', '.mkv'],
}
const LIMITES = { imagen: 5 * 1024 * 1024, video: 100 * 1024 * 1024 }
const ESTADO_VACIO = { archivo: null, enlace: '', modo: 'archivo' }

const esYoutube = (url) => url.includes('youtube.com/watch') || url.includes('youtu.be')
const urlEmbedYoutube = (url) =>
  url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').split('&')[0]

function formatearTamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validarArchivo(archivo, tipo) {
  const extension = '.' + archivo.name.split('.').pop().toLowerCase()
  if (!EXTENSIONES[tipo].includes(extension)) {
    return `Formato no permitido. Usa: ${EXTENSIONES[tipo].join(', ')}`
  }
  if (archivo.size > LIMITES[tipo]) {
    return `El ${tipo} no debe superar los ${LIMITES[tipo] / (1024 * 1024)} MB.`
  }
  return null
}

function useVistaPrevia(archivo) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!archivo) {
      setUrl(null)
      return undefined
    }
    const objeto = URL.createObjectURL(archivo)
    setUrl(objeto)
    return () => URL.revokeObjectURL(objeto)
  }, [archivo])
  return url
}

function ReproductorActual({ url, titulo }) {
  if (esYoutube(url)) {
    return (
      <iframe
        src={urlEmbedYoutube(url)}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={`Video de ${titulo}`}
      />
    )
  }
  return <video src={urlArchivo(url)} className="w-full h-full" controls playsInline preload="metadata" />
}

function SeccionMedia({ tipo, titulo, icono: Icono, actual, valor, setValor, onQuitar, quitando, bloqueado, nombreEjercicio }) {
  const vistaPrevia = useVistaPrevia(valor.archivo)
  const [arrastrando, setArrastrando] = useState(false)
  const esImagen = tipo === 'imagen'

  const elegirArchivo = (archivo) => {
    if (!archivo) return
    const error = validarArchivo(archivo, tipo)
    if (error) {
      alertaError('Archivo no válido', error)
      return
    }
    setValor({ ...valor, archivo, enlace: '' })
  }

  const soltar = (e) => {
    e.preventDefault()
    setArrastrando(false)
    if (!bloqueado) elegirArchivo(e.dataTransfer.files?.[0])
  }

  const reemplazaActual = !!(valor.archivo || valor.enlace.trim())

  return (
    <div className="rounded-xl border border-gray-800/40 bg-base-claro/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icono className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-texto-primary">{titulo}</h3>
        </div>
        {actual ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-exito/30 bg-exito/10 text-exito flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ya tiene {tipo}
          </span>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent">
            Sin {tipo}
          </span>
        )}
      </div>

      {actual && (
        <div className="mb-3">
          <div className={`rounded-lg overflow-hidden border border-gray-800/30 bg-gray-900 ${esImagen ? '' : 'aspect-video'}`}>
            {esImagen ? (
              <img src={urlArchivo(actual)} alt={nombreEjercicio} className="w-full max-h-48 object-contain" />
            ) : (
              <ReproductorActual url={actual} titulo={nombreEjercicio} />
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-texto-muted">
              {reemplazaActual ? `Se reemplazará al guardar.` : 'Sube otro archivo o enlace para reemplazarlo.'}
            </p>
            <button
              type="button"
              onClick={onQuitar}
              disabled={bloqueado || quitando}
              className="text-xs text-error hover:text-error/80 flex items-center gap-1 disabled:opacity-50"
            >
              {quitando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Quitar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-2.5">
        {[
          { clave: 'archivo', etiqueta: 'Subir archivo', icono: Upload },
          { clave: 'enlace', etiqueta: 'Pegar enlace', icono: Link2 },
        ].map(({ clave, etiqueta, icono: IconoModo }) => (
          <button
            key={clave}
            type="button"
            disabled={bloqueado}
            onClick={() => setValor({ ...ESTADO_VACIO, modo: clave })}
            className={`text-xs px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
              valor.modo === clave
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'border-gray-700/50 text-texto-muted hover:text-texto-secondary hover:border-gray-600'
            }`}
          >
            <IconoModo className="w-3 h-3" />
            {etiqueta}
          </button>
        ))}
      </div>

      {valor.modo === 'archivo' ? (
        valor.archivo ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            {vistaPrevia && (
              <div className={`rounded-lg overflow-hidden bg-gray-900 mb-2 ${esImagen ? '' : 'aspect-video'}`}>
                {esImagen ? (
                  <img src={vistaPrevia} alt="Vista previa" className="w-full max-h-48 object-contain" />
                ) : (
                  <video src={vistaPrevia} className="w-full h-full" controls playsInline preload="metadata" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-texto-secondary truncate">
                {valor.archivo.name} · {formatearTamano(valor.archivo.size)}
              </p>
              <button
                type="button"
                disabled={bloqueado}
                onClick={() => setValor({ ...valor, archivo: null })}
                className="text-xs text-texto-muted hover:text-error flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
              >
                <X className="w-3 h-3" /> Quitar selección
              </button>
            </div>
          </div>
        ) : (
          <label
            onDragOver={(e) => { e.preventDefault(); if (!bloqueado) setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={`flex flex-col items-center justify-center gap-1.5 border border-dashed rounded-xl py-6 px-3 text-center cursor-pointer transition-colors ${
              arrastrando
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-700/60 text-texto-muted hover:border-primary/50 hover:text-primary'
            } ${bloqueado ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="w-5 h-5" />
            <span className="text-xs font-medium">
              Haz clic o arrastra {esImagen ? 'una imagen' : 'un video'} aquí
            </span>
            <span className="text-[11px] text-texto-muted">
              {EXTENSIONES[tipo].join(', ')} · máx. {LIMITES[tipo] / (1024 * 1024)} MB
            </span>
            <input
              type="file"
              accept={esImagen ? 'image/*' : 'video/*'}
              className="hidden"
              disabled={bloqueado}
              onChange={(e) => {
                elegirArchivo(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        )
      ) : (
        <div>
          <input
            type="url"
            value={valor.enlace}
            disabled={bloqueado}
            onChange={(e) => setValor({ ...valor, archivo: null, enlace: e.target.value })}
            placeholder={esImagen ? 'https://ejemplo.com/imagen.jpg' : 'https://www.youtube.com/watch?v=...'}
            className="input text-sm w-full"
            maxLength={500}
          />
          <p className="text-[11px] text-texto-muted mt-1">
            {esImagen
              ? 'Enlace directo a la imagen (http o https).'
              : 'Enlace de YouTube o enlace directo a un archivo de video (.mp4, .webm...).'}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Modal para agregar, reemplazar o quitar la imagen y el video de un ejercicio del catálogo.
 * Lo que se guarda aquí queda en el catálogo, así que aparece en todas las rutinas futuras.
 *
 * Props:
 *  - abierto: boolean
 *  - ejercicio: { id, nombre, imagen_url, video_url } | null
 *  - idUsuario: id del usuario (nutriólogo/admin) que realiza el cambio
 *  - onCerrar: () => void
 *  - onGuardado: ({ id, imagen_url, video_url, cambiados }) => void   (al guardar o al quitar;
 *    `cambiados` lista los campos que se modificaron: 'imagen_url' y/o 'video_url')
 */
export default function ModalMultimediaEjercicio({ abierto, ejercicio, idUsuario, onCerrar, onGuardado }) {
  const [imagen, setImagen] = useState(ESTADO_VACIO)
  const [video, setVideo] = useState(ESTADO_VACIO)
  const [actual, setActual] = useState({ imagen_url: '', video_url: '' })
  const [guardando, setGuardando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [quitando, setQuitando] = useState(null)

  useEffect(() => {
    if (abierto && ejercicio) {
      setImagen(ESTADO_VACIO)
      setVideo(ESTADO_VACIO)
      setActual({ imagen_url: ejercicio.imagen_url || '', video_url: ejercicio.video_url || '' })
      setGuardando(false)
      setProgreso(0)
      setQuitando(null)
    }
    // Solo se reinicia al abrir o al cambiar de ejercicio (no en cada render del padre).
  }, [abierto, ejercicio?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const datosImagen = imagen.modo === 'archivo' ? imagen.archivo : imagen.enlace.trim()
  const datosVideo = video.modo === 'archivo' ? video.archivo : video.enlace.trim()
  const hayCambios = !!(datosImagen || datosVideo)
  const bloqueado = guardando || !!quitando

  const mensajeError = (err, porDefecto) => {
    const detalle = err.response?.data?.detail
    return typeof detalle === 'string' ? detalle : porDefecto
  }

  const guardar = async () => {
    if (!hayCambios || !ejercicio) return
    const formData = new FormData()
    formData.append('id_usuario', String(idUsuario))
    if (imagen.modo === 'archivo' && imagen.archivo) formData.append('imagen', imagen.archivo)
    if (imagen.modo === 'enlace' && imagen.enlace.trim()) formData.append('imagen_externa', imagen.enlace.trim())
    if (video.modo === 'archivo' && video.archivo) formData.append('video', video.archivo)
    if (video.modo === 'enlace' && video.enlace.trim()) formData.append('video_externo', video.enlace.trim())

    setGuardando(true)
    setProgreso(0)
    try {
      const respuesta = await guardarMultimediaEjercicioFast(ejercicio.id, formData, setProgreso)
      const cambiados = []
      if (datosImagen) cambiados.push('imagen_url')
      if (datosVideo) cambiados.push('video_url')
      onGuardado?.({
        id: ejercicio.id,
        imagen_url: respuesta.data.imagen_url || '',
        video_url: respuesta.data.video_url || '',
        cambiados,
      })
      alertaExito('Multimedia guardado', 'Ya estará disponible en las rutinas que uses este ejercicio.')
      onCerrar()
    } catch (err) {
      alertaError('No se pudo guardar', mensajeError(err, 'Ocurrió un error al subir el archivo.'))
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async (tipo) => {
    const nombreTipo = tipo === 'imagen' ? 'la imagen' : 'el video'
    const confirmacion = await alertaConfirmar(
      `Quitar ${tipo}`,
      `¿Quitar ${nombreTipo} de "${ejercicio?.nombre}"? También se quitará de las rutinas ya asignadas que la usen.`
    )
    if (!confirmacion.isConfirmed) return
    setQuitando(tipo)
    try {
      const respuesta = await eliminarMultimediaEjercicioFast(ejercicio.id, tipo, idUsuario)
      const nuevo = {
        imagen_url: respuesta.data.imagen_url || '',
        video_url: respuesta.data.video_url || '',
      }
      setActual(nuevo)
      onGuardado?.({ id: ejercicio.id, ...nuevo, cambiados: [tipo === 'imagen' ? 'imagen_url' : 'video_url'] })
    } catch (err) {
      alertaError('No se pudo quitar', mensajeError(err, 'Ocurrió un error al quitar el archivo.'))
    } finally {
      setQuitando(null)
    }
  }

  return (
    <AnimatePresence>
      {abierto && ejercicio && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
            onClick={bloqueado ? undefined : onCerrar}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto bg-card border border-gray-800/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-gray-700/50 sticky top-0 bg-card z-10">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-texto-primary">Multimedia del ejercicio</h2>
                  <p className="text-sm text-texto-muted mt-0.5 truncate">{ejercicio.nombre}</p>
                </div>
                <button
                  onClick={onCerrar}
                  disabled={bloqueado}
                  className="p-1.5 rounded-lg hover:bg-base-claro transition-colors disabled:opacity-40"
                >
                  <X className="w-5 h-5 text-texto-muted" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <SeccionMedia
                  tipo="imagen"
                  titulo="Imagen"
                  icono={ImageIcon}
                  actual={actual.imagen_url}
                  valor={imagen}
                  setValor={setImagen}
                  onQuitar={() => quitar('imagen')}
                  quitando={quitando === 'imagen'}
                  bloqueado={bloqueado}
                  nombreEjercicio={ejercicio.nombre}
                />
                <SeccionMedia
                  tipo="video"
                  titulo="Video"
                  icono={Film}
                  actual={actual.video_url}
                  valor={video}
                  setValor={setVideo}
                  onQuitar={() => quitar('video')}
                  quitando={quitando === 'video'}
                  bloqueado={bloqueado}
                  nombreEjercicio={ejercicio.nombre}
                />

                {guardando && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-texto-secondary mb-1">
                      <span>{progreso < 100 ? 'Subiendo...' : 'Procesando...'}</span>
                      <span>{progreso}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-base">
                      <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progreso}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-gray-700/30">
                  <button onClick={onCerrar} disabled={bloqueado} className="btn-secondary flex-1 text-sm disabled:opacity-50">
                    Cerrar
                  </button>
                  <button
                    onClick={guardar}
                    disabled={!hayCambios || bloqueado}
                    className="btn-primary flex-[2] flex items-center justify-center gap-2"
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {guardando ? 'Guardando...' : 'Guardar multimedia'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
