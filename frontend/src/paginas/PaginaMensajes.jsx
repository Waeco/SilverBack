import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import {
  obtenerUsuario, obtenerPacientes, obtenerNutriologo,
  obtenerMensajes, enviarMensaje, marcarMensajesLeidos, obtenerMensajesNoLeidos,
  urlFotoPerfil
} from '../servicios/ApiServicio'
import { Send, Loader2, MessageCircle, Search, Stethoscope, Users } from 'lucide-react'

const INTERVALO_POLLING = 4000

function Avatar({ foto, nombre, className = 'w-10 h-10' }) {
  return (
    <div className={`${className} rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20`}>
      {foto ? (
        <img src={urlFotoPerfil(foto)} alt={nombre || 'Usuario'} className="w-full h-full object-cover" />
      ) : (
        <span className="text-primary font-semibold text-sm">{nombre?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
  )
}

function aFechaLocal(fechaStr) {
  return new Date(fechaStr.replace(' ', 'T'))
}

function formatearHora(fechaStr) {
  return aFechaLocal(fechaStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatearSeparadorDia(fechaStr) {
  const fecha = aFechaLocal(fechaStr)
  const hoy = new Date()
  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy'
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer'
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PaginaMensajes() {
  const { idPaciente: idPacienteParam } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAutenticacion()
  const esNutriologo = usuario?.rol === 'nutriologo'
  const esAtleta = usuario?.rol === 'atleta'

  const [cargandoContexto, setCargandoContexto] = useState(true)
  const [idNutriologo, setIdNutriologo] = useState(null)
  const [nutriologoInfo, setNutriologoInfo] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [noLeidosPorPaciente, setNoLeidosPorPaciente] = useState({})
  const [idPacienteSeleccionado, setIdPacienteSeleccionado] = useState(
    idPacienteParam ? parseInt(idPacienteParam) : null
  )
  const [busqueda, setBusqueda] = useState('')

  const [mensajes, setMensajes] = useState([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const finRef = useRef(null)
  const ultimoIdRef = useRef(null)

  useEffect(() => {
    if (!usuario) return
    const cargar = async () => {
      setCargandoContexto(true)
      try {
        if (esAtleta) {
          const r = await obtenerUsuario(usuario.id_usuario)
          const perfil = r.data.usuario?.perfil
          if (perfil) {
            setIdPacienteSeleccionado(perfil.id_paciente)
            if (perfil.id_nutriologo_asignado) {
              setIdNutriologo(perfil.id_nutriologo_asignado)
              try {
                const rn = await obtenerNutriologo(perfil.id_nutriologo_asignado)
                setNutriologoInfo(rn.data.nutriologo)
              } catch {
                setNutriologoInfo(null)
              }
            }
          }
        } else if (esNutriologo) {
          const r = await obtenerUsuario(usuario.id_usuario)
          const perfil = r.data.usuario?.perfil
          if (perfil) {
            setIdNutriologo(perfil.id_nutriologo)
            const rp = await obtenerPacientes(usuario.id_usuario)
            setPacientes(rp.data.pacientes || [])
          }
        }
      } finally {
        setCargandoContexto(false)
      }
    }
    cargar()
  }, [usuario, esAtleta, esNutriologo])

  const cargarNoLeidos = useCallback(async () => {
    if (!usuario) return
    try {
      const r = await obtenerMensajesNoLeidos(usuario.id_usuario)
      const mapa = {}
      ;(r.data.por_paciente || []).forEach((f) => { mapa[f.id_paciente] = f.no_leidos })
      setNoLeidosPorPaciente(mapa)
    } catch {
      // silencioso: no debe bloquear la vista de mensajes
    }
  }, [usuario])

  useEffect(() => {
    cargarNoLeidos()
    const intervalo = setInterval(cargarNoLeidos, INTERVALO_POLLING)
    return () => clearInterval(intervalo)
  }, [cargarNoLeidos])

  const cargarMensajes = useCallback(async (inicial = false) => {
    if (!idPacienteSeleccionado || !idNutriologo || !usuario) return
    try {
      const despuesDe = inicial ? null : ultimoIdRef.current
      const r = await obtenerMensajes(idPacienteSeleccionado, idNutriologo, despuesDe)
      const nuevos = r.data.mensajes || []
      if (inicial) {
        setMensajes(nuevos)
      } else if (nuevos.length > 0) {
        setMensajes((prev) => [...prev, ...nuevos])
      }
      if (nuevos.some((m) => m.id_emisor !== usuario.id_usuario)) {
        marcarMensajesLeidos({
          id_paciente: idPacienteSeleccionado,
          id_nutriologo: idNutriologo,
          id_usuario: usuario.id_usuario,
        }).catch(() => {})
        cargarNoLeidos()
      }
      setError(null)
    } catch (err) {
      if (inicial) setError(err.response?.data?.error || 'Error al cargar la conversación')
    }
  }, [idPacienteSeleccionado, idNutriologo, usuario, cargarNoLeidos])

  useEffect(() => {
    if (mensajes.length > 0) ultimoIdRef.current = mensajes[mensajes.length - 1].id_mensaje
  }, [mensajes])

  useEffect(() => {
    if (!idPacienteSeleccionado || !idNutriologo) {
      setMensajes([])
      return
    }
    setCargandoMensajes(true)
    ultimoIdRef.current = null
    cargarMensajes(true).finally(() => setCargandoMensajes(false))
    const intervalo = setInterval(() => cargarMensajes(false), INTERVALO_POLLING)
    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPacienteSeleccionado, idNutriologo])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const seleccionarPaciente = (idPac) => {
    setIdPacienteSeleccionado(idPac)
    navigate(`/mensajes/${idPac}`, { replace: true })
  }

  const manejarEnviar = async (e) => {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido || enviando) return
    if (contenido.length > 2000) {
      setError('El mensaje no puede superar los 2000 caracteres.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const r = await enviarMensaje({
        id_paciente: idPacienteSeleccionado,
        id_nutriologo: idNutriologo,
        id_emisor: usuario.id_usuario,
        contenido,
      })
      setMensajes((prev) => [...prev, r.data.mensaje])
      setTexto('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const manejarTecla = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      manejarEnviar(e)
    }
  }

  if (cargandoContexto) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (esAtleta && !idNutriologo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="tarjeta flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">Aún no tienes un nutriólogo asignado</p>
          <p className="text-texto-muted text-xs mt-1 mb-5">Elige un nutriólogo para poder empezar a chatear con él.</p>
          <Link to="/nutriologos" className="btn-primary text-sm flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Buscar nutriólogo
          </Link>
        </div>
      </div>
    )
  }

  if (esNutriologo && pacientes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="tarjeta flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">Sin pacientes asignados</p>
          <p className="text-texto-muted text-xs mt-1">Cuando tengas pacientes asignados podrás chatear con ellos aquí.</p>
        </div>
      </div>
    )
  }

  const pacientesFiltrados = pacientes.filter((p) =>
    p.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase())
  )
  const pacienteActivo = esNutriologo
    ? pacientes.find((p) => p.id_paciente === idPacienteSeleccionado)
    : null
  const nombreContraparte = esAtleta ? nutriologoInfo?.nombre_completo : pacienteActivo?.nombre_completo
  const fotoContraparte = esAtleta ? nutriologoInfo?.foto_perfil : pacienteActivo?.foto_perfil
  const subtituloContraparte = esAtleta
    ? (nutriologoInfo?.especialidad || 'Nutriólogo')
    : pacienteActivo?.correo

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-2xl font-bold text-texto-primary mb-4">Mensajes</h2>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        {esNutriologo && (
          <div className="w-72 flex-shrink-0 tarjeta !p-0 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-800/50 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-texto-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="input pl-9 text-sm py-2"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pacientesFiltrados.map((p) => {
                const noLeidos = noLeidosPorPaciente[p.id_paciente] || 0
                const activo = p.id_paciente === idPacienteSeleccionado
                return (
                  <button
                    key={p.id_paciente}
                    onClick={() => seleccionarPaciente(p.id_paciente)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-colors border-b border-gray-800/30 ${
                      activo ? 'bg-primary/10' : 'hover:bg-base-claro'
                    }`}
                  >
                    <Avatar foto={p.foto_perfil} nombre={p.nombre_completo} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${activo ? 'text-primary' : 'text-texto-primary'}`}>
                        {p.nombre_completo}
                      </p>
                      <p className="text-xs text-texto-muted truncate">{p.correo}</p>
                    </div>
                    {noLeidos > 0 && (
                      <span className="text-xs font-bold bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {noLeidos > 9 ? '9+' : noLeidos}
                      </span>
                    )}
                  </button>
                )
              })}
              {pacientesFiltrados.length === 0 && (
                <p className="text-xs text-texto-muted text-center py-6">Sin resultados</p>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 tarjeta !p-0 overflow-hidden flex flex-col min-w-0">
          {!idPacienteSeleccionado || !idNutriologo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageCircle className="w-12 h-12 text-texto-muted/30 mb-3" />
              <p className="text-texto-secondary text-sm font-medium">Selecciona un paciente para ver la conversación</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-800/50 flex items-center gap-3 flex-shrink-0">
                <Avatar foto={fotoContraparte} nombre={nombreContraparte} />
                <div className="min-w-0">
                  <p className="font-semibold text-texto-primary truncate">{nombreContraparte || 'Conversación'}</p>
                  <p className="text-xs text-texto-muted truncate capitalize">{subtituloContraparte}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cargandoMensajes ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageCircle className="w-10 h-10 text-texto-muted/30 mb-2" />
                    <p className="text-texto-muted text-sm">Aún no hay mensajes. ¡Envía el primero!</p>
                  </div>
                ) : (
                  mensajes.map((m, i) => {
                    const esMio = m.id_emisor === usuario.id_usuario
                    const anterior = mensajes[i - 1]
                    const mostrarSeparador =
                      !anterior || aFechaLocal(anterior.enviado_en).toDateString() !== aFechaLocal(m.enviado_en).toDateString()
                    return (
                      <div key={m.id_mensaje}>
                        {mostrarSeparador && (
                          <div className="flex justify-center my-3">
                            <span className="text-xs text-texto-muted bg-base-claro px-3 py-1 rounded-full">
                              {formatearSeparadorDia(m.enviado_en)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              esMio ? 'bg-primary text-white rounded-br-sm' : 'bg-base-claro text-texto-primary rounded-bl-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{m.contenido}</p>
                            <p className={`text-[10px] mt-1 text-right ${esMio ? 'text-white/70' : 'text-texto-muted'}`}>
                              {formatearHora(m.enviado_en)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={finRef} />
              </div>

              {error && (
                <div className="px-4 py-2 text-xs text-error bg-error/10 border-t border-error/20 flex-shrink-0">{error}</div>
              )}

              <form onSubmit={manejarEnviar} className="p-3 border-t border-gray-800/50 flex items-end gap-2 flex-shrink-0">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={manejarTecla}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  maxLength={2000}
                  className="input resize-none text-sm flex-1 max-h-32"
                />
                <button
                  type="submit"
                  disabled={enviando || !texto.trim()}
                  className="btn-primary p-2.5 flex-shrink-0 disabled:opacity-50"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
