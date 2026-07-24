import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAutenticacion } from '../context/ContextoAutenticacion'
import {
  obtenerUsuario, actualizarUsuario, quitarNutriologoPaciente,
  subirFotoPerfil, eliminarFotoPerfil, urlFotoPerfil
} from '../servicios/ApiServicio'
import { Loader2, Save, User as UserIcon, UserX, Stethoscope, Camera, Trash2, MessageCircle } from 'lucide-react'

export default function PaginaPerfil() {
  const { usuario: usuarioAuth, actualizarUsuarioLocal } = useAutenticacion()
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)
  const [perfilPaciente, setPerfilPaciente] = useState(null)
  const [quitando, setQuitando] = useState(false)
  const [fotoPerfil, setFotoPerfil] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const inputFotoRef = useRef(null)

  useEffect(() => {
    if (!usuarioAuth) return
    const cargar = async () => {
      try {
        const respuesta = await obtenerUsuario(usuarioAuth.id_usuario)
        const u = respuesta.data.usuario
        setNombre(u.nombre_completo || '')
        setCorreo(u.correo || '')
        setFotoPerfil(u.foto_perfil || null)
        if (u.perfil) setPerfilPaciente(u.perfil)
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

  const manejarSeleccionFoto = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a seleccionar el mismo archivo después
    if (!archivo) return

    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!tiposPermitidos.includes(archivo.type)) {
      setError('Formato no soportado. Usa JPG, PNG, GIF o WEBP.')
      return
    }
    if (archivo.size > 3 * 1024 * 1024) {
      setError('La imagen no debe superar los 3 MB.')
      return
    }

    setError(null)
    setExito(null)
    setSubiendoFoto(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const lector = new FileReader()
        lector.onload = () => resolve(lector.result)
        lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
        lector.readAsDataURL(archivo)
      })
      const respuesta = await subirFotoPerfil(usuarioAuth.id_usuario, base64)
      const nuevaRuta = respuesta.data.foto_perfil
      setFotoPerfil(nuevaRuta)
      actualizarUsuarioLocal({ foto_perfil: nuevaRuta })
      setExito('Foto de perfil actualizada correctamente')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir la foto de perfil')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const manejarEliminarFoto = async () => {
    setError(null)
    setExito(null)
    setSubiendoFoto(true)
    try {
      await eliminarFotoPerfil(usuarioAuth.id_usuario)
      setFotoPerfil(null)
      actualizarUsuarioLocal({ foto_perfil: null })
      setExito('Foto de perfil eliminada correctamente')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la foto de perfil')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const manejarQuitarNutriologo = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar a tu nutriólogo asignado?')) return
    setQuitando(true)
    setError(null)
    setExito(null)
    try {
      await quitarNutriologoPaciente(perfilPaciente.id_paciente)
      setPerfilPaciente((prev) => ({ ...prev, id_nutriologo_asignado: null }))
      setExito('Nutriólogo removido correctamente.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al remover nutriólogo')
    } finally {
      setQuitando(false)
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
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-2 border-primary/30 overflow-hidden">
                {fotoPerfil ? (
                  <img src={urlFotoPerfil(fotoPerfil)} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-10 h-10 text-primary" />
                )}
                {subiendoFoto && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => inputFotoRef.current?.click()}
                disabled={subiendoFoto}
                title="Cambiar foto de perfil"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:bg-primary-claro text-white flex items-center justify-center shadow-lg border-2 border-card transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={manejarSeleccionFoto}
              />
            </div>
            {fotoPerfil && (
              <button
                type="button"
                onClick={manejarEliminarFoto}
                disabled={subiendoFoto}
                className="text-xs text-texto-muted hover:text-error transition-colors inline-flex items-center gap-1 mb-3"
              >
                <Trash2 className="w-3 h-3" />
                Quitar foto
              </button>
            )}
            <h3 className="text-lg font-semibold text-texto-primary">{usuarioAuth?.nombre_completo}</h3>
            <p className="text-sm text-texto-secondary mt-1 capitalize">{usuarioAuth?.rol}</p>
            <p className="text-xs text-texto-muted mt-1">{usuarioAuth?.correo}</p>
          </div>

          {perfilPaciente && perfilPaciente.id_nutriologo_asignado && (
            <div className="tarjeta-hover mt-4">
              <h4 className="text-sm font-semibold text-texto-primary mb-3 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-primary" />
                Nutriólogo Asignado
              </h4>
              <Link
                to="/mensajes"
                className="btn-primary text-sm flex items-center gap-2 w-full justify-center"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar Mensaje
              </Link>
              <button
                onClick={manejarQuitarNutriologo}
                disabled={quitando}
                className="btn-secondary text-sm flex items-center gap-2 w-full justify-center mt-2"
              >
                {quitando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserX className="w-4 h-4" />
                )}
                {quitando ? 'Removiendo...' : 'Quitar Nutriólogo'}
              </button>
            </div>
          )}
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
