import axios from 'axios'

export const URL_SERVIDOR = 'http://localhost:8000'

const cliente = axios.create({
  baseURL: `${URL_SERVIDOR}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

cliente.interceptors.request.use((config) => {
  const token = localStorage.getItem('silverback_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const esPeticionDeLogin = error.config?.url?.includes('/auth')
    // Un 401 al intentar iniciar sesión es un error esperado (credenciales
    // incorrectas) y debe mostrarse en el propio formulario, no provocar una
    // redirección que recargue la página y borre el mensaje de error.
    if (error.response?.status === 401 && !esPeticionDeLogin) {
      localStorage.removeItem('silverback_usuario')
      localStorage.removeItem('silverback_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export async function iniciarSesion(correo, contrasena, captchaToken = null) {
  const cuerpo = { correo, contrasena }
  if (captchaToken) cuerpo.captcha_token = captchaToken
  return cliente.post('/auth', cuerpo)
}

export async function registrarUsuario(datos, captchaToken = null) {
  const cuerpo = { ...datos }
  if (captchaToken) cuerpo.captcha_token = captchaToken
  return cliente.post('/registro', cuerpo)
}

export async function verificarCorreo(correo, codigo) {
  return cliente.post('/verificar-correo', { correo, codigo })
}

export async function reenviarCodigoVerificacion(correo) {
  return cliente.post('/reenviar-codigo', { correo })
}

export async function obtenerComidas(fecha, idPaciente = null) {
  const params = { fecha }
  if (idPaciente) params.id_paciente = idPaciente
  return cliente.get('/comidas', { params })
}

export async function guardarComida(datos) {
  return cliente.post('/comidas', datos)
}

export async function eliminarComida(idComida) {
  return cliente.delete(`/comidas/${idComida}`)
}

export async function buscarAlimentos(termino) {
  return cliente.get('/buscar-alimentos', { params: { termino } })
}

export async function obtenerUsuario(idUsuario) {
  return cliente.get(`/usuario/${idUsuario}`)
}

export async function actualizarUsuario(idUsuario, datos) {
  return cliente.put(`/usuario/${idUsuario}`, datos)
}

export async function subirFotoPerfil(idUsuario, imagenBase64) {
  return cliente.post(`/usuario/${idUsuario}/foto`, { imagen: imagenBase64 })
}

export async function eliminarFotoPerfil(idUsuario) {
  return cliente.delete(`/usuario/${idUsuario}/foto`)
}

export function urlFotoPerfil(ruta) {
  if (!ruta) return null
  return `${URL_SERVIDOR}${ruta}`
}

export async function obtenerCitas(idUsuario = null, rol = null) {
  const params = {}
  if (idUsuario) params.id_usuario = idUsuario
  if (rol) params.rol = rol
  return cliente.get('/citas', { params })
}

export async function crearCita(datos) {
  return cliente.post('/citas', datos)
}

export async function obtenerDiasConComidas(mes, idPaciente) {
  return cliente.get('/dias-con-comidas', { params: { mes, id_paciente: idPaciente } })
}

export async function obtenerNutriologos({ termino = '', pagina = 1, limite = 10 } = {}) {
  return cliente.get('/nutriologos', { params: { termino, pagina, limite } })
}

export async function obtenerNutriologo(idNutriologo) {
  return cliente.get(`/nutriologo/${idNutriologo}`)
}

export async function obtenerPacientes(idNutriologo) {
  return cliente.get('/pacientes', { params: { id_nutriologo: idNutriologo } })
}

export async function obtenerMensajes(idPaciente, idNutriologo, despuesDe = null) {
  const params = { id_paciente: idPaciente, id_nutriologo: idNutriologo }
  if (despuesDe) params.despues_de = despuesDe
  return cliente.get('/mensajes', { params })
}

export async function enviarMensaje(datos) {
  return cliente.post('/mensajes', datos)
}

export async function marcarMensajesLeidos(datos) {
  return cliente.put('/mensajes/leidos', datos)
}

export async function obtenerMensajesNoLeidos(idUsuario) {
  return cliente.get('/mensajes/no-leidos', { params: { id_usuario: idUsuario } })
}

export async function obtenerNotificaciones(idUsuario) {
  return cliente.get('/notificaciones', { params: { id_usuario: idUsuario } })
}

export async function obtenerNotificacionesNoLeidas(idUsuario) {
  return cliente.get('/notificaciones/no-leidas', { params: { id_usuario: idUsuario } })
}

export async function marcarNotificacionLeida(idNotificacion) {
  return cliente.put(`/notificaciones/${idNotificacion}/leida`)
}

export async function marcarNotificacionesLeidas(idUsuario) {
  return cliente.put('/notificaciones/leidas', { id_usuario: idUsuario })
}

export async function obtenerStatsAdmin() {
  return cliente.get('/admin/stats')
}

export async function adminActualizarUsuario(idUsuario, datos) {
  return cliente.put(`/admin/usuarios/${idUsuario}`, datos)
}

export async function adminCrearUsuario(datos) {
  return cliente.post('/admin/usuarios', datos)
}

export async function adminEliminarUsuario(idUsuario) {
  return cliente.delete(`/admin/usuarios/${idUsuario}`)
}

export async function obtenerDietaPaciente(idPaciente) {
  return cliente.get(`/dieta/${idPaciente}`)
}

export async function asignarDieta(datos) {
  return cliente.post('/dieta', datos)
}

export async function desactivarDieta(idPlan) {
  return cliente.delete(`/dieta/${idPlan}`)
}

// --- Cliente FastAPI (puerto 8001) ---
const clienteFast = axios.create({
  baseURL: 'http://localhost:8001/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// --- Nuevos endpoints FastAPI (baja latencia, mirror local wger) ---

export async function buscarEjerciciosFast(termino) {
  return clienteFast.get('/ejercicios/buscar', { params: { q: termino } })
}

export async function obtenerCategoriasEjercicios() {
  return clienteFast.get('/ejercicios/categorias')
}

export async function buscarEjerciciosPorCategoria(categoria, termino = '') {
  const params = { categoria }
  if (termino && termino.trim()) params.q = termino
  return clienteFast.get('/ejercicios/buscar', { params })
}

export async function obtenerRutinaPacienteFast(idPaciente) {
  return clienteFast.get(`/rutinas/paciente/${idPaciente}`)
}

export async function crearRutinaFast(datos) {
  return clienteFast.post('/rutinas', datos)
}

export async function desactivarRutinaFast(idPlan) {
  return clienteFast.delete(`/rutinas/${idPlan}`)
}

// --- Historial Médico (FastAPI) ---

export async function obtenerHistorial(idPaciente) {
  return clienteFast.get(`/historial/${idPaciente}`)
}

export async function crearHistorialCompleto(datos) {
  return clienteFast.post('/historial/completo', datos)
}

export async function eliminarHistorial(id) {
  return clienteFast.delete(`/historial/${id}`)
}

// --- Solicitudes Nutriólogo (FastAPI) ---

export async function enviarSolicitud(idPaciente, idNutriologo) {
  return clienteFast.post('/solicitudes', { id_paciente: idPaciente, id_nutriologo: idNutriologo })
}

export async function obtenerSolicitudesPendientes(idNutriologo) {
  return clienteFast.get(`/solicitudes/pendientes/${idNutriologo}`)
}

export async function obtenerSolicitudesPendientesCount(idUsuario) {
  return clienteFast.get('/solicitudes/pendientes-count', { params: { id_usuario: idUsuario } })
}

export async function aceptarSolicitud(idSolicitud) {
  return clienteFast.put(`/solicitudes/${idSolicitud}/aceptar`)
}

export async function rechazarSolicitud(idSolicitud) {
  return clienteFast.put(`/solicitudes/${idSolicitud}/rechazar`)
}

export async function quitarNutriologoPaciente(idPaciente) {
  return clienteFast.delete(`/paciente/${idPaciente}/nutriologo`)
}

// --- Recuperación de Contraseña ---

export async function solicitarRecuperacion(correo) {
  return cliente.post('/recuperar-password', { correo })
}

export async function cambiarPassword(correo, token, nueva_contrasena) {
  return cliente.post('/cambiar-password', { correo, token, nueva_contrasena })
}

export default cliente
