import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

export const REGLAS = [
  { key: 'minLength', label: 'Al menos 6 caracteres', test: (v) => v.length >= 6 },
  { key: 'uppercase', label: 'Al menos una mayúscula', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', label: 'Al menos una minúscula', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'Al menos un número', test: (v) => /[0-9]/.test(v) },
  { key: 'match', label: 'Las contraseñas coinciden', test: (v, c) => !c || v === c },
]

export function passwordEsValida(valor, confirmar) {
  return REGLAS.every((r) => r.test(valor, confirmar))
}

export default function ValidadorPassword({ valor, confirmar, visible, onCerrar }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[100] right-4 top-1/4 w-64 p-4 rounded-xl bg-card border border-gray-700/50 shadow-xl max-lg:right-2 max-lg:top-auto max-lg:bottom-4 max-lg:left-2 max-lg:w-auto"
          style={{ maxHeight: 'calc(100vh - 2rem)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-texto-secondary uppercase tracking-wider">Requisitos de contraseña</p>
            <button onClick={onCerrar} className="text-texto-muted hover:text-texto-primary text-xs">Cerrar</button>
          </div>
          <ul className="space-y-1.5">
            {REGLAS.map((r) => {
              const cumple = r.test(valor, confirmar)
              return (
                <li key={r.key} className="flex items-center gap-2 text-sm">
                  {cumple ? (
                    <Check className="w-3.5 h-3.5 text-exito flex-shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-error flex-shrink-0" />
                  )}
                  <span className={cumple ? 'text-exito' : 'text-texto-muted'}>{r.label}</span>
                </li>
              )
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
