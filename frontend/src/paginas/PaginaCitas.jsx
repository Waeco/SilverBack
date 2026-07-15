import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerCitas, crearCita, obtenerUsuario, obtenerPacientes } from '../servicios/ApiServicio'
import { ChevronLeft, ChevronRight, Video, Users, Clock, Loader2, Plus, X, FileText, CalendarDays } from 'lucide-react'
import { alertaExito, alertaError } from '../servicios/AlertasServicio'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const COLORES_ESTADO = {
  pendiente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmada: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completada: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelada: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function PaginaCitas() {
  const { usuario } = useAutenticacion()
  const esNutriologo = usuario?.rol === 'nutriologo'
  const esAtleta = usuario?.rol === 'atleta'
  if (usuario?.rol === 'admin') return <Navigate to="/dashboard" replace />

  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mesActual, setMesActual] = useState(new Date().getMonth())
  const [anioActual, setAnioActual] = useState(new Date().getFullYear())
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [pacientes, setPacientes] = useState([])
  const [idNutriologo, setIdNutriologo] = useState(null)
  const [formPaciente, setFormPaciente] = useState('')
  const [formHora, setFormHora] = useState('')
  const [formTipo, setFormTipo] = useState('presencial')
  const [formNotas, setFormNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    const cargar = async () => {
      try {
        const respuesta = await obtenerCitas(usuario.id_usuario, usuario.rol)
        setCitas(respuesta.data.citas || [])
      } catch {
        setCitas([])
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario])

  useEffect(() => {
    if (!usuario || !esNutriologo) return
    const cargar = async () => {
      try {
        const r = await obtenerUsuario(usuario.id_usuario)
        const perfil = r.data.usuario?.perfil
        if (perfil) setIdNutriologo(perfil.id_nutriologo)
        const resp = await obtenerPacientes(usuario.id_usuario)
        setPacientes(resp.data.pacientes || [])
      } catch {}
    }
    cargar()
  }, [usuario, esNutriologo])

  const cambiarMes = (delta) => {
    let m = mesActual + delta
    let a = anioActual
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMesActual(m)
    setAnioActual(a)
  }

  const citasDelDia = (dia) => {
    const fechaStr = `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return citas.filter(c => (c.fecha?.split('T')[0] || c.fecha) === fechaStr)
  }

  const diasDelMes = () => {
    const primerDia = new Date(anioActual, mesActual, 1).getDay()
    const totalDias = new Date(anioActual, mesActual + 1, 0).getDate()
    const dias = []
    for (let i = 0; i < primerDia; i++) dias.push(null)
    for (let i = 1; i <= totalDias; i++) dias.push(i)
    return dias
  }

  const handleDiaClick = (dia) => {
    if (!dia) return
    setDiaSeleccionado(dia)
    setMostrarFormulario(false)
  }

  const guardarCita = async () => {
    if (!formPaciente || !formHora) {
      alertaError('Error', 'Selecciona un paciente y una hora.')
      return
    }
    setGuardando(true)
    try {
      const fechaStr = `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`
      await crearCita({
        id_paciente: parseInt(formPaciente),
        id_nutriologo: idNutriologo,
        fecha: fechaStr,
        hora: formHora,
        tipo: formTipo,
        notas: formNotas || null,
      })
      alertaExito('Cita creada', 'La cita se ha registrado correctamente.')
      setMostrarFormulario(false)
      setFormPaciente('')
      setFormHora('')
      setFormTipo('presencial')
      setFormNotas('')
      const respuesta = await obtenerCitas(usuario.id_usuario, usuario.rol)
      setCitas(respuesta.data.citas || [])
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al crear la cita.')
    } finally {
      setGuardando(false)
    }
  }

  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">
          {esNutriologo ? 'Gestión de Citas' : 'Mis Citas'}
        </h2>
        <span className="text-sm text-texto-muted">{citas.length} cita{citas.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2">
          <div className="tarjeta-hover">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg hover:bg-base-claro transition-colors">
                <ChevronLeft className="w-5 h-5 text-texto-muted" />
              </button>
              <h3 className="text-lg font-semibold text-texto-primary">
                {MESES[mesActual]} {anioActual}
              </h3>
              <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg hover:bg-base-claro transition-colors">
                <ChevronRight className="w-5 h-5 text-texto-muted" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-center text-xs font-medium text-texto-muted py-2">{d}</div>
              ))}
              {diasDelMes().map((dia, i) => {
                const citasDia = dia ? citasDelDia(dia) : []
                const fechaStr = dia ? `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}` : ''
                const esHoy = fechaStr === hoyStr
                const esSeleccionado = diaSeleccionado === dia
                return (
                  <button
                    key={i}
                    onClick={() => handleDiaClick(dia)}
                    disabled={!dia}
                    className={`relative p-2 rounded-lg text-sm transition-all min-h-[3rem] ${
                      !dia ? 'invisible' :
                      esSeleccionado ? 'bg-primary/20 border border-primary/30' :
                      esHoy ? 'bg-primary/10 border border-primary/20' :
                      'hover:bg-base-claro border border-transparent'
                    }`}
                  >
                    <span className={`font-medium ${esHoy ? 'text-primary' : 'text-texto-primary'}`}>{dia}</span>
                    {citasDia.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {citasDia.some(c => c.tipo === 'videollamada') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                        {citasDia.some(c => c.tipo === 'presencial') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Citas del día seleccionado */}
          {diaSeleccionado && (
            <div className="tarjeta-hover mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-texto-primary">
                  {diaSeleccionado} de {MESES[mesActual]} de {anioActual}
                </h3>
                {esNutriologo && (
                  <button
                    onClick={() => setMostrarFormulario(true)}
                    className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Cita
                  </button>
                )}
              </div>
              {citasDelDia(diaSeleccionado).length === 0 ? (
                <p className="text-xs text-texto-muted/50 italic">Sin citas en este día.</p>
              ) : (
                <div className="space-y-2">
                  {citasDelDia(diaSeleccionado).map((cita) => (
                    <div key={cita.id_cita} className="rounded-xl bg-base-claro/30 border border-gray-800/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-texto-muted" />
                              <span className="text-sm font-medium text-texto-primary">{cita.hora?.slice(0, 5)} hrs</span>
                              <span className={`etiqueta text-xs ${COLORES_ESTADO[cita.estado] || COLORES_ESTADO.pendiente}`}>
                                {cita.estado}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {cita.tipo === 'videollamada' ? (
                                <span className="text-xs text-blue-400 flex items-center gap-1">
                                  <Video className="w-3 h-3" /> Videollamada
                                </span>
                              ) : (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <Users className="w-3 h-3" /> Presencial
                                </span>
                              )}
                            </div>
                            {cita.nombre_paciente && (
                              <p className="text-xs text-texto-muted mt-1">{cita.nombre_paciente}</p>
                            )}
                            {cita.nombre_nutriologo && (
                              <p className="text-xs text-texto-muted">{cita.nombre_nutriologo}</p>
                            )}
                            {cita.notas && (
                              <p className="text-xs text-texto-muted mt-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> {cita.notas}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Próximas citas (sidebar) */}
        <div className="tarjeta-hover">
          <h3 className="text-sm font-semibold text-texto-primary mb-3">Próximas Citas</h3>
          {citas.filter(c => c.estado !== 'cancelada').length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-8 h-8 text-texto-muted/30 mx-auto mb-2" />
              <p className="text-xs text-texto-muted">No hay citas próximas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {citas
                .filter(c => c.estado !== 'cancelada')
                .slice(0, 5)
                .map((cita) => (
                  <div key={cita.id_cita} className="rounded-lg bg-base-claro/30 border border-gray-800/30 p-2.5">
                    <div className="flex items-center gap-2">
                      {cita.tipo === 'videollamada' ? (
                        <Video className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-texto-primary truncate">
                          {cita.nombre_paciente || cita.nombre_nutriologo}
                        </p>
                        <p className="text-xs text-texto-muted">
                          {cita.fecha?.split('T')[0] || cita.fecha} — {cita.hora?.slice(0, 5)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal nueva cita (solo nutriólogo) */}
      {mostrarFormulario && esNutriologo && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMostrarFormulario(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card border border-gray-800/50 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
                <h3 className="text-lg font-semibold text-texto-primary">Nueva Cita</h3>
                <button onClick={() => setMostrarFormulario(false)} className="p-1.5 rounded-lg hover:bg-base-claro transition-colors">
                  <X className="w-5 h-5 text-texto-muted" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-texto-muted">
                  {diaSeleccionado} de {MESES[mesActual]} de {anioActual}
                </p>
                <div>
                  <label className="text-xs text-texto-muted block mb-1">Paciente</label>
                  <select
                    value={formPaciente}
                    onChange={e => setFormPaciente(e.target.value)}
                    className="input w-full text-sm"
                  >
                    <option value="">Seleccionar paciente...</option>
                    {pacientes.map(p => (
                      <option key={p.id_paciente} value={p.id_paciente}>{p.nombre_completo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-texto-muted block mb-1">Hora</label>
                  <input
                    type="time"
                    value={formHora}
                    onChange={e => setFormHora(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-texto-muted block mb-2">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormTipo('presencial')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        formTipo === 'presencial'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-base-claro/50 text-texto-muted border border-transparent hover:bg-base-claro'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Presencial
                    </button>
                    <button
                      onClick={() => setFormTipo('videollamada')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        formTipo === 'videollamada'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-base-claro/50 text-texto-muted border border-transparent hover:bg-base-claro'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      Videollamada
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-texto-muted block mb-1">Notas</label>
                  <textarea
                    value={formNotas}
                    onChange={e => setFormNotas(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={3}
                    className="input w-full text-sm resize-none"
                  />
                </div>
                <button
                  onClick={guardarCita}
                  disabled={guardando}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {guardando ? 'Guardando...' : 'Crear Cita'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
