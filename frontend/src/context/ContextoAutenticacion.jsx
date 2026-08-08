import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { iniciarSesion as apiIniciarSesion } from '../servicios/ApiServicio'

const ContextoAutenticacion = createContext(null)

export function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('silverback_usuario')
    return guardado ? JSON.parse(guardado) : null
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const iniciarSesion = useCallback(async (correo, contrasena, captchaToken = null) => {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await apiIniciarSesion(correo, contrasena, captchaToken)
      const datos = respuesta.data

      // Paso 1 completado (credenciales válidas): falta resolver el captcha
      if (datos.requiere_captcha) {
        return { requiereCaptcha: true, mensaje: datos.mensaje }
      }

      // Paso 2 completado: sesión iniciada
      localStorage.setItem('silverback_usuario', JSON.stringify(datos.usuario))
      localStorage.setItem('silverback_token', datos.token)
      setUsuario(datos.usuario)
      return { requiereCaptcha: false, usuario: datos.usuario }
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Error al iniciar sesión'
      setError(mensaje)
      throw new Error(mensaje)
    } finally {
      setCargando(false)
    }
  }, [])

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem('silverback_usuario')
    localStorage.removeItem('silverback_token')
    setUsuario(null)
    setError(null)
  }, [])

  const actualizarUsuarioLocal = useCallback((datosParciales) => {
    setUsuario((prev) => {
      if (!prev) return prev
      const actualizado = { ...prev, ...datosParciales }
      localStorage.setItem('silverback_usuario', JSON.stringify(actualizado))
      return actualizado
    })
  }, [])

  const valor = useMemo(() => ({
    usuario,
    cargando,
    error,
    iniciarSesion,
    cerrarSesion,
    actualizarUsuarioLocal,
    estaAutenticado: !!usuario,
  }), [usuario, cargando, error, iniciarSesion, cerrarSesion, actualizarUsuarioLocal])

  return (
    <ContextoAutenticacion.Provider value={valor}>
      {children}
    </ContextoAutenticacion.Provider>
  )
}

export function useAutenticacion() {
  const contexto = useContext(ContextoAutenticacion)
  if (!contexto) {
    throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion')
  }
  return contexto
}
