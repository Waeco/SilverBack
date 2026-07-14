import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorAutenticacion, useAutenticacion } from './context/ContextoAutenticacion'
import BarraNavegacion from './componentes/BarraNavegacion'
import Landing from './paginas/Landing'
const Dashboard = lazy(() => import('./paginas/Dashboard'))
const PaginaLogin = lazy(() => import('./paginas/PaginaLogin'))
const PaginaRegistro = lazy(() => import('./paginas/PaginaRegistro'))
const PaginaPerfil = lazy(() => import('./paginas/PaginaPerfil'))
const PaginaCitas = lazy(() => import('./paginas/PaginaCitas'))
const PaginaDieta = lazy(() => import('./paginas/PaginaDieta'))
const CatalogoNutriologos = lazy(() => import('./paginas/CatalogoNutriologos'))
const PaginaPacientes = lazy(() => import('./paginas/PaginaPacientes'))
const PaginaAdminUsuarios = lazy(() => import('./paginas/PaginaAdminUsuarios'))
const PaginaRutina = lazy(() => import('./paginas/PaginaRutina'))
const PaginaHistorialMedico = lazy(() => import('./paginas/PaginaHistorialMedico'))
const PaginaRecuperarPassword = lazy(() => import('./paginas/PaginaRecuperarPassword'))
const PaginaRestablecerPassword = lazy(() => import('./paginas/PaginaRestablecerPassword'))
const PaginaNoEncontrada = lazy(() => import('./paginas/PaginaNoEncontrada'))

function RutaProtegida({ children }) {
  const { estaAutenticado } = useAutenticacion()
  if (!estaAutenticado) {
    return <Navigate to="/login" replace />
  }
  return <BarraNavegacion>{children}</BarraNavegacion>
}

function Cargando() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ProveedorAutenticacion>
      <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/dashboard" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
          <Route path="/perfil" element={<RutaProtegida><PaginaPerfil /></RutaProtegida>} />
          <Route path="/citas" element={<RutaProtegida><PaginaCitas /></RutaProtegida>} />
          <Route path="/dieta" element={<RutaProtegida><PaginaDieta /></RutaProtegida>} />
          <Route path="/rutina" element={<RutaProtegida><PaginaRutina /></RutaProtegida>} />
          <Route path="/nutriologos" element={<RutaProtegida><CatalogoNutriologos /></RutaProtegida>} />
          <Route path="/pacientes" element={<RutaProtegida><PaginaPacientes /></RutaProtegida>} />
          <Route path="/admin/usuarios" element={<RutaProtegida><PaginaAdminUsuarios /></RutaProtegida>} />
          <Route path="/historial" element={<RutaProtegida><PaginaHistorialMedico /></RutaProtegida>} />
          <Route path="/historial/:idPaciente" element={<RutaProtegida><PaginaHistorialMedico /></RutaProtegida>} />
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PaginaLogin />} />
          <Route path="/registro" element={<PaginaRegistro />} />
          <Route path="/recuperar-password" element={<PaginaRecuperarPassword />} />
          <Route path="/restablecer" element={<PaginaRestablecerPassword />} />
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Routes>
      </Suspense>
    </ProveedorAutenticacion>
  )
}
