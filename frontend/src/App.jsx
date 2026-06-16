import { Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorAutenticacion, useAutenticacion } from './context/ContextoAutenticacion'
import BarraNavegacion from './componentes/BarraNavegacion'
import Dashboard from './paginas/Dashboard'
import PaginaLogin from './paginas/PaginaLogin'
import PaginaRegistro from './paginas/PaginaRegistro'
import PaginaPerfil from './paginas/PaginaPerfil'
import PaginaCitas from './paginas/PaginaCitas'
import PaginaDieta from './paginas/PaginaDieta'
import CatalogoNutriologos from './paginas/CatalogoNutriologos'
import PaginaPacientes from './paginas/PaginaPacientes'
import PaginaAdminUsuarios from './paginas/PaginaAdminUsuarios'

function RutaProtegida({ children }) {
  const { estaAutenticado } = useAutenticacion()
  if (!estaAutenticado) {
    return <Navigate to="/login" replace />
  }
  return <BarraNavegacion>{children}</BarraNavegacion>
}

export default function App() {
  return (
    <ProveedorAutenticacion>
      <Routes>
        <Route path="/dashboard" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
        <Route path="/perfil" element={<RutaProtegida><PaginaPerfil /></RutaProtegida>} />
        <Route path="/citas" element={<RutaProtegida><PaginaCitas /></RutaProtegida>} />
        <Route path="/dieta" element={<RutaProtegida><PaginaDieta /></RutaProtegida>} />
        <Route path="/nutriologos" element={<RutaProtegida><CatalogoNutriologos /></RutaProtegida>} />
        <Route path="/pacientes" element={<RutaProtegida><PaginaPacientes /></RutaProtegida>} />
        <Route path="/admin/usuarios" element={<RutaProtegida><PaginaAdminUsuarios /></RutaProtegida>} />
        <Route path="/login" element={<PaginaLogin />} />
        <Route path="/registro" element={<PaginaRegistro />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ProveedorAutenticacion>
  )
}
