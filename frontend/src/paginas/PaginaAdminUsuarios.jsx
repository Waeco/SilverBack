import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, Loader2, User, Stethoscope, Crown, Search } from 'lucide-react'
import cliente from '../servicios/ApiServicio'

const ICONOS_ROL = {
  atleta: { icono: User, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  nutriologo: { icono: Stethoscope, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  admin: { icono: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

export default function PaginaAdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [termino, setTermino] = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const respuesta = await cliente.get('/usuario')
        setUsuarios(respuesta.data.usuarios || [])
      } catch {
        setUsuarios([])
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

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
        <span className="text-sm text-texto-muted">{usuarios.length} registrados</span>
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
          <Shield className="w-12 h-12 text-texto-muted/50 mb-3" />
          <p className="text-texto-secondary text-sm">No se encontraron usuarios</p>
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
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
