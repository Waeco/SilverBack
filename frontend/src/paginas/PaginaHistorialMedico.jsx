import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Weight, Ruler, AlertTriangle, Heart, FileText, Stethoscope, User, Trash2, ArrowLeft, Save, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerHistorial, crearHistorialCompleto, eliminarHistorial, obtenerUsuario } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

const TIPOS = [
  { valor: 'peso', etiqueta: 'Peso', icono: Weight, color: 'text-blue-400 bg-blue-400/10', unidad: 'kg' },
  { valor: 'altura', etiqueta: 'Altura', icono: Ruler, color: 'text-green-400 bg-green-400/10', unidad: 'cm' },
  { valor: 'enfermedad', etiqueta: 'Enfermedad', icono: AlertTriangle, color: 'text-red-400 bg-red-400/10' },
  { valor: 'alergia', etiqueta: 'Alergia', icono: Heart, color: 'text-purple-400 bg-purple-400/10' },
  { valor: 'nota', etiqueta: 'Nota', icono: FileText, color: 'text-yellow-400 bg-yellow-400/10' },
]

function IconoTipo({ tipo }) {
  const t = TIPOS.find(t => t.valor === tipo)
  if (!t) return null
  const Icono = t.icono
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.color}`}>
      <Icono className="w-4 h-4" />
    </div>
  )
}

function formatearFecha(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

function formatearFechaLegible(fechaStr) {
  const [y, m, d] = fechaStr.split('-')
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`
}

export default function PaginaHistorialMedico() {
  const { idPaciente: idPacienteParam } = useParams()
  const { usuario } = useAutenticacion()
  const esNutriologo = usuario?.rol === 'nutriologo'
  const esAtleta = usuario?.rol === 'atleta'

  const [idPaciente, setIdPaciente] = useState(null)
  const [idNutriologo, setIdNutriologo] = useState(null)
  const [tieneNutriologo, setTieneNutriologo] = useState(false)
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha] = useState(new Date())
  const fechaStr = formatearFecha(fecha)

  const [form, setForm] = useState({
    peso: '', altura: '', enfermedades: '', alergias: '', notas: '',
    fecha: formatearFecha(new Date()),
  })
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')

  const cargarPerfil = useCallback(async () => {
    if (!usuario) return
    try {
      if (esAtleta) {
        const r = await obtenerUsuario(usuario.id_usuario)
        const perfil = r.data.usuario?.perfil
        if (perfil) {
          setIdPaciente(perfil.id_paciente)
          setIdNutriologo(perfil.id_nutriologo_asignado)
          setTieneNutriologo(!!perfil.id_nutriologo_asignado)
        }
      } else if (esNutriologo) {
        if (idPacienteParam) setIdPaciente(parseInt(idPacienteParam))
        const r = await obtenerUsuario(usuario.id_usuario)
        const perfil = r.data.usuario?.perfil
        if (perfil) setIdNutriologo(perfil.id_nutriologo)
      }
    } catch {
      setIdPaciente(null)
    }
  }, [usuario, esAtleta, esNutriologo, idPacienteParam])

  const cargarHistorial = useCallback(async (pacId) => {
    if (!pacId) return
    setCargando(true)
    try {
      const r = await obtenerHistorial(pacId)
      setHistorial(r.data || [])
    } catch {
      setHistorial([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarPerfil() }, [cargarPerfil])
  useEffect(() => { if (idPaciente) cargarHistorial(idPaciente) }, [idPaciente, cargarHistorial])
  useEffect(() => { setForm(prev => ({ ...prev, fecha: fechaStr })) }, [fechaStr])

  const cambiarDia = (delta) => {
    const nueva = new Date(fecha)
    nueva.setDate(nueva.getDate() + delta)
    setFecha(nueva)
  }

  const diasConRegistros = [...new Set(historial.map(h => (h.fecha?.split('T')[0] || h.fecha)))].filter(Boolean).sort()

  // Últimos valores registrados
  const ultimoPeso = historial.find(h => h.tipo === 'peso')
  const ultimaAltura = historial.find(h => h.tipo === 'altura')
  const ultimaEnfermedad = historial.find(h => h.tipo === 'enfermedad')
  const ultimaAlergia = historial.find(h => h.tipo === 'alergia')

  // Entradas del día seleccionado
  const entradasDelDia = historial.filter(h => {
    const f = (h.fecha?.split('T')[0] || h.fecha)
    if (f !== fechaStr) return false
    if (filtroTipo && h.tipo !== filtroTipo) return false
    return true
  })

  const totalesPorTipo = {}
  historial.forEach(h => { totalesPorTipo[h.tipo] = (totalesPorTipo[h.tipo] || 0) + 1 })

  const guardar = async () => {
    if (!form.peso && !form.altura && !form.enfermedades && !form.alergias && !form.notas) {
      alertaError('Error', 'Completa al menos un campo del formulario.')
      return
    }
    setGuardando(true)
    try {
      await crearHistorialCompleto({
        id_paciente: idPaciente,
        id_nutriologo: idNutriologo,
        fecha: form.fecha,
        peso: form.peso || null, altura: form.altura || null,
        enfermedades: form.enfermedades || null, alergias: form.alergias || null,
        notas: form.notas || null,
      })
      alertaExito('Guardado', 'Historial médico actualizado correctamente.')
      setForm(prev => ({ ...prev, peso: '', altura: '', enfermedades: '', alergias: '', notas: '' }))
      cargarHistorial(idPaciente)
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    const confirm = await alertaConfirmar('Eliminar registro', '¿Estás seguro?')
    if (!confirm.isConfirmed) return
    try {
      await eliminarHistorial(id)
      alertaExito('Eliminado', 'Registro eliminado.')
      cargarHistorial(idPaciente)
    } catch (err) {
      alertaError('Error', err.response?.data?.detail || 'Error al eliminar.')
    }
  }

  if (!esNutriologo && esAtleta && !tieneNutriologo) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="p-8 rounded-2xl border border-dashed border-gray-700/50 text-center">
          <User className="w-12 h-12 text-texto-muted/30 mx-auto mb-3" />
          <p className="text-texto-secondary font-medium">Historial médico no disponible</p>
          <p className="text-xs text-texto-muted mt-1">Debes tener un nutriólogo asignado para acceder a tu historial médico.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {idPacienteParam && (
            <a href="/pacientes" className="p-2 rounded-lg hover:bg-base-claro transition-colors">
              <ArrowLeft className="w-5 h-5 text-texto-muted" />
            </a>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-texto-primary">Historial Médico</h1>
            <p className="text-sm text-texto-muted mt-1">
              {esAtleta ? 'Tu historial médico' : 'Historial del paciente'}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen de últimos valores registrados (visible para ambos) */}
      {historial.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-blue-400/5 border border-blue-400/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Weight className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-texto-muted">Peso</span>
            </div>
            <p className="text-lg font-bold text-texto-primary">{ultimoPeso?.valor || '—'} <span className="text-xs text-texto-muted font-normal">kg</span></p>
          </div>
          <div className="rounded-xl bg-green-400/5 border border-green-400/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Ruler className="w-4 h-4 text-green-400" />
              <span className="text-xs text-texto-muted">Altura</span>
            </div>
            <p className="text-lg font-bold text-texto-primary">{ultimaAltura?.valor || '—'} <span className="text-xs text-texto-muted font-normal">cm</span></p>
          </div>
          <div className="rounded-xl bg-red-400/5 border border-red-400/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-texto-muted">Enfermedades</span>
            </div>
            <p className="text-sm font-medium text-texto-primary truncate">{ultimaEnfermedad?.descripcion || '—'}</p>
          </div>
          <div className="rounded-xl bg-purple-400/5 border border-purple-400/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-texto-muted">Alergias</span>
            </div>
            <p className="text-sm font-medium text-texto-primary truncate">{ultimaAlergia?.descripcion || '—'}</p>
          </div>
        </div>
      )}

      {/* Formulario solo para nutriólogo */}
      {esNutriologo && (
        <div className="rounded-2xl bg-base-claro/30 border border-gray-800/30 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-texto-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Nuevo registro médico
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="hm-peso" className="text-xs text-texto-muted block mb-1">Peso (kg)</label>
              <input id="hm-peso" name="peso" type="number" step="0.1"
                value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })}
                placeholder="72.5" className="input text-sm w-full" />
            </div>
            <div>
              <label htmlFor="hm-altura" className="text-xs text-texto-muted block mb-1">Altura (cm)</label>
              <input id="hm-altura" name="altura" type="number" step="1"
                value={form.altura} onChange={e => setForm({ ...form, altura: e.target.value })}
                placeholder="175" className="input text-sm w-full" />
            </div>
            <div>
              <label htmlFor="hm-fecha" className="text-xs text-texto-muted block mb-1">Fecha</label>
              <input id="hm-fecha" name="fecha" type="date"
                value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="input text-sm w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="hm-enfermedades" className="text-xs text-texto-muted block mb-1">Enfermedades</label>
              <textarea id="hm-enfermedades" name="enfermedades"
                value={form.enfermedades} onChange={e => setForm({ ...form, enfermedades: e.target.value })}
                placeholder="Diabetes, hipertensión, etc." rows={2} className="input text-sm w-full resize-none" />
            </div>
            <div>
              <label htmlFor="hm-alergias" className="text-xs text-texto-muted block mb-1">Alergias</label>
              <textarea id="hm-alergias" name="alergias"
                value={form.alergias} onChange={e => setForm({ ...form, alergias: e.target.value })}
                placeholder="Polen, lácteos, medicamentos, etc." rows={2} className="input text-sm w-full resize-none" />
            </div>
          </div>
          <div>
            <label htmlFor="hm-notas" className="text-xs text-texto-muted block mb-1">Notas adicionales</label>
            <textarea id="hm-notas" name="notas"
              value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Observaciones..." rows={2} className="input text-sm w-full resize-none" />
          </div>
          <button onClick={guardar} disabled={guardando} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {guardando ? 'Guardando...' : 'Guardar en historial médico'}
          </button>
        </div>
      )}

      {/* Navegación por días (como dieta) */}
      {historial.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => cambiarDia(-1)} className="p-2 rounded-lg hover:bg-base-claro transition-colors">
              <ChevronLeft className="w-5 h-5 text-texto-muted" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-texto-primary">{formatearFechaLegible(fechaStr)}</p>
              <p className="text-xs text-texto-muted">{entradasDelDia.length} registro{entradasDelDia.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => cambiarDia(1)} className="p-2 rounded-lg hover:bg-base-claro transition-colors">
              <ChevronRight className="w-5 h-5 text-texto-muted" />
            </button>
          </div>

          {/* Stats por tipo (filtros) */}
          <div className="grid grid-cols-5 gap-2">
            {TIPOS.map(t => {
              const count = totalesPorTipo[t.valor] || 0
              const Icono = t.icono
              return (
                <button key={t.valor} onClick={() => setFiltroTipo(filtroTipo === t.valor ? '' : t.valor)}
                  className={`p-3 rounded-xl border text-center transition-all ${filtroTipo === t.valor ? 'border-primary/30 bg-primary/5' : 'border-gray-800/30 bg-base-claro/30 hover:bg-base-claro'}`}>
                  <Icono className={`w-4 h-4 mx-auto mb-1 ${t.color.split(' ')[0]}`} />
                  <p className="text-xs text-texto-muted">{t.etiqueta}</p>
                  <p className="text-sm font-bold text-texto-primary">{count}</p>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Lista del día seleccionado */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : historial.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700/50 p-10 text-center">
          <FileText className="w-12 h-12 text-texto-muted/30 mx-auto mb-3" />
          <p className="text-texto-secondary font-medium">Sin registros médicos</p>
          <p className="text-xs text-texto-muted mt-1">{esNutriologo ? 'Usa el formulario para agregar el primer registro.' : 'Tu nutriólogo aún no ha registrado tu historial médico.'}</p>
        </div>
      ) : entradasDelDia.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700/50 p-8 text-center">
          <CalendarDays className="w-10 h-10 text-texto-muted/30 mx-auto mb-2" />
          <p className="text-texto-secondary text-sm font-medium">Sin registros en esta fecha</p>
          <p className="text-xs text-texto-muted mt-1">
            {diasConRegistros.includes(fechaStr) ? 'Filtro activo — cambia el filtro o fecha.' : 'No hay entradas para este día.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entradasDelDia.map((item) => {
            const t = TIPOS.find(t => t.valor === item.tipo)
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-base-claro/30 border border-gray-800/30 p-4">
                <div className="flex items-start gap-3">
                  <IconoTipo tipo={item.tipo} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-texto-primary uppercase">{t?.etiqueta || item.tipo}</span>
                      {item.valor && <span className="text-sm font-bold text-primary">{item.valor} {t?.unidad || ''}</span>}
                    </div>
                    {item.descripcion && <p className="text-sm text-texto-secondary mt-1">{item.descripcion}</p>}
                    {item.nutriologo_nombre && (
                      <p className="text-xs text-texto-muted mt-1 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" /> {item.nutriologo_nombre}
                      </p>
                    )}
                  </div>
                  {esNutriologo && (
                    <button onClick={() => eliminar(item.id)} className="p-1.5 rounded text-texto-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
