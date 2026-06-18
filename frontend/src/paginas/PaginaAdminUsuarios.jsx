import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Loader2, User, Stethoscope, Crown, Search, Plus, Edit3, Trash2, X } from 'lucide-react'
import cliente, { registrarUsuario, adminActualizarUsuario, adminEliminarUsuario } from '../servicios/ApiServicio'
import { alertaExito, alertaError, alertaConfirmar } from '../servicios/AlertasServicio'

const ICONOS_ROL = {
  atleta: { icono: User, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  nutriologo: { icono: Stethoscope, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  admin: { icono: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

const ROLES = ['atleta', 'nutriologo', 'admin']

export default function PaginaAdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [termino, setTermino] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [formNombre, setFormNombre] = useState('')
  const [formCorreo, setFormCorreo] = useState('')
  const [formContrasena, setFormContrasena] = useState('')
  const [formRol, setFormRol] = useState('atleta')
  const [formActivo, setFormActivo] = useState(true)

  const cargarUsuarios = async () => {
    try {
      const respuesta = await cliente.get('/usuario')
      setUsuarios(respuesta.data.usuarios || [])
    } catch {
      setUsuarios([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarUsuarios() }, [])

  const abrirModalCrear = () => {
    setEditando(null)
    setFormNombre('')
    setFormCorreo('')
    setFormContrasena('')
    setFormRol('atleta')
    setFormActivo(true)
    setModalAbierto(true)
  }

  const abrirModalEditar = (u) => {
    setEditando(u)
    setFormNombre(u.nombre_completo || '')
    setFormCorreo(u.correo || '')
    setFormContrasena('')
    setFormRol(u.rol || 'atleta')
    setFormActivo(Boolean(u.activo))
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditando(null)
  }

  const manejarGuardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      if (editando) {
        const datos = { nombre_completo: formNombre, correo: formCorreo, rol: formRol, activo: formActivo ? 1 : 0 }
        await adminActualizarUsuario(editando.id_usuario, datos)
        alertaExito('Usuario modificado', 'Los cambios se guardaron correctamente.')
      } else {
        if (!formContrasena || formContrasena.length < 6) {
          alertaError('Error', 'La contraseña debe tener al menos 6 caracteres.')
          setGuardando(false)
          return
        }
        const datos = { nombre_completo: formNombre, correo: formCorreo, contrasena: formContrasena, rol: formRol }
        await registrarUsuario(datos)
        alertaExito('Usuario creado', 'El usuario se registró correctamente.')
      }
      cerrarModal()
      setCargando(true)
      await cargarUsuarios()
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al guardar usuario.')
    } finally {
      setGuardando(false)
    }
  }

  const manejarEliminar = async (u) => {
    const result = await alertaConfirmar('Eliminar usuario', `¿Estás seguro de eliminar a "${u.nombre_completo}"? Esta acción no se puede deshacer.`)
    if (!result.isConfirmed) return
    try {
      await adminEliminarUsuario(u.id_usuario)
      alertaExito('Usuario eliminado', 'El usuario fue eliminado correctamente.')
      setCargando(true)
      await cargarUsuarios()
    } catch (err) {
      alertaError('Error', err.response?.data?.error || 'Error al eliminar usuario.')
    }
  }

  const filtrados = usuarios.filter(u =>
    u.nombre_completo?.toLowerCase().includes(termino.toLowerCase()) ||
    u.correo?.toLowerCase().includes(termino.toLowerCase())
  )

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-texto-primary">Usuarios</h2>
        <button onClick={abrirModalCrear} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-texto-muted" />
        <input
          type="text"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscar usuarios..."
          className="input pl-10 w-full"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <Shield className="w-12 h-12 text-texto-muted/40 mb-3" />
          <p className="text-texto-secondary text-sm font-medium">{termino ? 'Sin resultados' : 'No hay usuarios registrados'}</p>
          <p className="text-texto-muted text-xs mt-1 mb-5">
            {termino
              ? 'Ningún usuario coincide con tu búsqueda.'
              : 'Comienza creando el primer usuario del sistema.'}
          </p>
          {termino ? (
            <button onClick={() => setTermino('')} className="btn-secondary text-sm">
              Limpiar búsqueda
            </button>
          ) : (
            <button onClick={abrirModalCrear} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Crear Usuario
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u, i) => {
            const config = ICONOS_ROL[u.rol] || ICONOS_ROL.atleta
            const Icono = config.icono
            return (
              <motion.div
                key={u.id_usuario}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="tarjeta-hover flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icono className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-texto-primary truncate">{u.nombre_completo}</p>
                  <p className="text-xs text-texto-muted">{u.correo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
                    {u.rol}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <button onClick={() => abrirModalEditar(u)} className="p-1.5 rounded-lg hover:bg-base-claro text-texto-muted hover:text-primary transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => manejarEliminar(u)} className="p-1.5 rounded-lg hover:bg-base-claro text-texto-muted hover:text-error transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {modalAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-xl border border-gray-700/50 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-700/30">
                <h3 className="text-lg font-semibold text-texto-primary">
                  {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button onClick={cerrarModal} className="p-1 rounded-lg hover:bg-base-claro text-texto-muted hover:text-texto-primary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={manejarGuardar} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Nombre completo</label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="input w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
                  <input type="email" value={formCorreo} onChange={(e) => setFormCorreo(e.target.value)} className="input w-full" required />
                </div>
                {!editando && (
                  <div>
                    <label className="block text-sm font-medium text-texto-secondary mb-1.5">Contraseña</label>
                    <input type="password" value={formContrasena} onChange={(e) => setFormContrasena(e.target.value)} className="input w-full" placeholder="Mínimo 6 caracteres" required={!editando} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-texto-secondary mb-1.5">Rol</label>
                  <select value={formRol} onChange={(e) => setFormRol(e.target.value)} className="input w-full">
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                {editando && (
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formActivo} onChange={(e) => setFormActivo(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-base-claro rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                    <span className="text-sm text-texto-secondary">Usuario activo</span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={cerrarModal} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" disabled={guardando} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                    {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
