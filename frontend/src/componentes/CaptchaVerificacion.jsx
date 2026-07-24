import { useEffect, useRef, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY
const ID_SCRIPT_RECAPTCHA = 'script-google-recaptcha'

function cargarScriptRecaptcha() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve()
      return
    }
    const existente = document.getElementById(ID_SCRIPT_RECAPTCHA)
    if (existente) {
      existente.addEventListener('load', () => resolve())
      existente.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = ID_SCRIPT_RECAPTCHA
    script.src = 'https://www.google.com/recaptcha/api.js'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

/**
 * Widget de reCAPTCHA v2 ("No soy un robot").
 * Llama a onVerificado(token) cuando el usuario resuelve el captcha
 * y a onExpirado() si el token expira antes de usarse.
 */
export default function CaptchaVerificacion({ onVerificado, onExpirado }) {
  const contenedorRef = useRef(null)
  const idWidgetRef = useRef(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false

    if (!SITE_KEY) {
      setError('Falta configurar VITE_RECAPTCHA_SITE_KEY en el frontend (.env).')
      setCargando(false)
      return
    }

    cargarScriptRecaptcha()
      .then(() => esperarGrecaptcha())
      .then(() => {
        if (cancelado || !contenedorRef.current) return
        idWidgetRef.current = window.grecaptcha.render(contenedorRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onVerificado?.(token),
          'expired-callback': () => onExpirado?.(),
        })
        setCargando(false)
      })
      .catch(() => {
        if (!cancelado) {
          setError('No se pudo cargar el captcha. Revisa tu conexión a internet.')
          setCargando(false)
        }
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function esperarGrecaptcha(intentos = 20) {
    return new Promise((resolve, reject) => {
      const intervalo = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(intervalo)
          resolve()
        } else if (--intentos <= 0) {
          clearInterval(intervalo)
          reject(new Error('grecaptcha no disponible'))
        }
      }, 150)
    })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {cargando && (
        <p className="text-sm text-texto-muted">Cargando verificación...</p>
      )}
      {error && (
        <p className="text-sm text-error text-center">{error}</p>
      )}
      <div ref={contenedorRef} />
    </div>
  )
}
