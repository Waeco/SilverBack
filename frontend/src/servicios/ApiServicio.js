import axios from 'axios'

const cliente = axios.create({
  baseURL: 'http://localhost:8000/api',
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
    if (error.response?.status === 401) {
      localStorage.removeItem('silverback_usuario')
      localStorage.removeItem('silverback_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export async function iniciarSesion(correo, contrasena) {
  return cliente.post('/auth', { correo, contrasena })
}

export async function registrarUsuario(datos) {
  return cliente.post('/registro', datos)
}

export async function obtenerComidas(fecha, idPaciente = null) {
  const params = { fecha }
  if (idPaciente) params.id_paciente = idPaciente
  return cliente.get('/comidas', { params })
}

export async function guardarComida(datos) {
  return cliente.post('/comidas', datos)
}

export async function actualizarComida(idComida, datos) {
  return cliente.put(`/comidas/${idComida}`, datos)
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

export async function obtenerCitas(idUsuario = null, rol = null) {
  const params = {}
  if (idUsuario) params.id_usuario = idUsuario
  if (rol) params.rol = rol
  return cliente.get('/citas', { params })
}

export async function crearCita(datos) {
  return cliente.post('/citas', datos)
}

export async function actualizarCita(idCita, estado) {
  return cliente.put(`/citas/${idCita}`, { estado })
}

export async function eliminarCita(idCita) {
  return cliente.delete(`/citas/${idCita}`)
}

export async function obtenerHabitos(idPaciente, fecha = null) {
  const params = { id_paciente: idPaciente }
  if (fecha) params.fecha = fecha
  return cliente.get('/habitos', { params })
}

export async function guardarHabito(datos) {
  return cliente.post('/habitos', datos)
}

export async function obtenerDiasConComidas(mes, idPaciente) {
  return cliente.get('/dias-con-comidas', { params: { mes, id_paciente: idPaciente } })
}

export async function obtenerNutriologos({ termino = '', pagina = 1, limite = 10 } = {}) {
  return cliente.get('/nutriologos', { params: { termino, pagina, limite } })
}

export async function obtenerPacientes(idNutriologo) {
  return cliente.get('/pacientes', { params: { id_nutriologo: idNutriologo } })
}

export async function obtenerStatsAdmin() {
  return cliente.get('/admin/stats')
}

export async function adminActualizarUsuario(idUsuario, datos) {
  return cliente.put(`/admin/usuarios/${idUsuario}`, datos)
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

export async function buscarEjercicios(termino) {
  return cliente.get('/buscar-ejercicios', { params: { termino } })
}

export async function obtenerInfoEjercicio(idEjercicio) {
  return cliente.get(`/ejercicio-info/${idEjercicio}`)
}

export async function obtenerRutinaPaciente(idPaciente) {
  return cliente.get(`/rutina/${idPaciente}`)
}

export async function asignarRutina(datos) {
  return cliente.post('/rutina', datos)
}

export async function desactivarRutina(idPlan) {
  return cliente.delete(`/rutina/${idPlan}`)
}

export default cliente
