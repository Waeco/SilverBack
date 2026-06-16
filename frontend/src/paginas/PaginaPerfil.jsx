import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import { obtenerUsuario, actualizarUsuario } from '../servicios/ApiServicio'
import { Loader2, Save, User as UserIcon } from 'lucide-react'

export default function PaginaPerfil() {
  const { usuario: usuarioAuth } = useAutenticacion()
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  useEffect(() => {
    if (!usuarioAuth) return
    const cargar = async () => {
      try {
        const respuesta = await obtenerUsuario(usuarioAuth.id_usuario)
        const u = respuesta.data.usuario
        setNombre(u.nombre_completo || '')
        setCorreo(u.correo || '')
      } catch {
        setError('Error al cargar perfil')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuarioAuth])

  const manejarGuardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setExito(null)
    try {
      await actualizarUsuario(usuarioAuth.id_usuario, { nombre_completo: nombre, correo })
      setExito('Perfil actualizado correctamente')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-2xl font-bold text-texto-primary mb-6">Mi Perfil</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="tarjeta-hover text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4 border-2 border-primary/30">
              <UserIcon className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-texto-primary">{usuarioAuth?.nombre_completo}</h3>
            <p className="text-sm text-texto-secondary mt-1 capitalize">{usuarioAuth?.rol}</p>
            <p className="text-xs text-texto-muted mt-1">{usuarioAuth?.correo}</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="tarjeta-hover">
            <h3 className="text-lg font-semibold text-texto-primary mb-4">Editar Información</h3>

            {error && <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">{error}</div>}
            {exito && <div className="p-3 rounded-lg bg-exito/10 border border-exito/20 text-exito text-sm mb-4">{exito}</div>}

            <form onSubmit={manejarGuardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">Nombre completo</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">Correo electrónico</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto-secondary mb-1.5">Rol</label>
                <input type="text" value={usuarioAuth?.rol || ''} className="input capitalize" disabled />
              </div>
              <button type="submit" disabled={guardando} className="btn-primary flex items-center gap-2">
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
