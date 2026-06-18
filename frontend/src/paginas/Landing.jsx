import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Utensils, Dumbbell, CalendarDays, Stethoscope,
  BarChart3, Smartphone, Shield, ChevronLeft, ChevronRight, Star
} from 'lucide-react'

const CARACTERISTICAS = [
  {
    icon: Utensils,
    titulo: 'Planes de Alimentación',
    descripcion: 'Dietas personalizadas diseñadas por nutriólogos, ajustadas a tu deporte, objetivo y estilo de vida.',
    imagen: null,
    /* Ruta sugerida: /images/dieta-atleta.jpg — Atleta viendo su plan de comidas en tablet */
  },
  {
    icon: Dumbbell,
    titulo: 'Rutinas de Ejercicio',
    descripcion: 'Rutinas guiadas con ejercicios, series y repeticiones. Te entrenes donde te entrenes.',
    imagen: null,
    /* Ruta sugerida: /images/rutina-ejercicio.jpg — Persona entrenando con formato */
  },
  {
    icon: CalendarDays,
    titulo: 'Citas con Especialistas',
    descripcion: 'Agenda citas con nutriólogos deportivos, da seguimiento a tu progreso y ajusta tu plan en tiempo real.',
    imagen: null,
    /* Ruta sugerida: /images/consulta-nutriologo.jpg — Nutriólogo y atleta en consulta */
  },
  {
    icon: BarChart3,
    titulo: 'Seguimiento de Macros',
    descripcion: 'Controla calorías, proteínas, carbohidratos y grasas con una interfaz clara y en tu idioma.',
    imagen: null,
    /* Ruta sugerida: /images/macros-panel.jpg — Panel con gráficas de macronutrientes */
  },
]

const TESTIMONIALES = [
  { nombre: 'Carlos M.', rol: 'Maratonista', texto: 'Desde que uso SilverBack mi nutrición dejó de ser un volado. Mi nutriólogo ajusta mi dieta semana a semana y veo la diferencia en cada carrera.', iniciales: 'CM' },
  { nombre: 'Ana R.', rol: 'Nutrióloga Deportiva', texto: 'Tener a todos mis pacientes en un solo lugar, con sus dietas y rutinas sincronizadas, me ahorra horas a la semana. La herramienta que necesitaba.', iniciales: 'AR' },
  { nombre: 'Luis F.', rol: 'CrossFit', texto: 'La rutina que me asignaron más la dieta es una combinación brutal. Todo en una app, sin excusas.', iniciales: 'LF' },
]

function CarruselImagenes() {
  const [actual, setActual] = useState(0)
  const slides = [
    {
      /* RUTA: /images/hero-atleta.jpg — Atleta revisando su progreso en el dashboard */
      emoji: '🏋️',
      titulo: 'Tu rendimiento comienza en el plato',
      desc: 'Conecta con nutriólogos que entienden tu deporte y lleva tu alimentación al siguiente nivel.',
    },
    {
      /* RUTA: /images/hero-consulta.jpg — Nutrióloga revisando plan con paciente */
      emoji: '🥗',
      titulo: 'Dietas que se adaptan a ti',
      desc: 'Planes de alimentación dinámicos que evolucionan con tu entrenamiento y tus metas.',
    },
    {
      /* RUTA: /images/hero-rutina.jpg — Persona ejercitándose al aire libre */
      emoji: '📊',
      titulo: 'Todo en un solo lugar',
      desc: 'Macros, citas, rutinas y progreso. Sin hojas sueltas ni apps separadas.',
    },
  ]

  const siguiente = useCallback(() => setActual(a => (a + 1) % slides.length), [slides.length])
  const anterior = useCallback(() => setActual(a => (a - 1 + slides.length) % slides.length), [slides.length])

  useEffect(() => {
    const timer = setInterval(siguiente, 5000)
    return () => clearInterval(timer)
  }, [siguiente])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-base-claro to-secondary/5 border border-gray-800/40">
      <div className="aspect-[16/9] sm:aspect-[21/9] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={actual}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 sm:p-12 text-center"
          >
            <span className="text-5xl sm:text-6xl mb-4">{slides[actual].emoji}</span>
            <h3 className="texto-display text-2xl sm:text-3xl text-texto-primary mb-3">{slides[actual].titulo}</h3>
            <p className="text-sm sm:text-base text-texto-secondary max-w-md">{slides[actual].desc}</p>
          </motion.div>
        </AnimatePresence>

        <button onClick={anterior} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={siguiente} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white">
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setActual(i)} className={`w-2 h-2 rounded-full transition-all ${i === actual ? 'bg-primary w-6' : 'bg-gray-600 hover:bg-gray-500'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TarjetaCaracteristica({ item, idx }) {
  const Icono = item.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: idx * 0.1, duration: 0.4 }}
      className="group tarjeta-hover relative overflow-hidden"
    >
      {item.imagen ? (
        <img src={item.imagen} alt={item.titulo} className="w-full h-40 object-cover rounded-t-xl" />
      ) : (
        /* COLOCAR RUTA DE IMAGEN:
           Ejemplo: <img src="/images/caracteristica-X.jpg" alt={item.titulo} className="w-full h-40 object-cover rounded-t-xl" />
           Reemplazar el div de abajo con el img tag cuando tengas las imágenes */
        <div className="w-full h-32 sm:h-40 bg-gradient-to-br from-primary/5 via-base-claro to-secondary/5 flex items-center justify-center">
          <Icono className="w-12 h-12 text-primary/30 group-hover:scale-110 transition-transform duration-300" />
        </div>
      )}
      <div className="p-5">
        <h3 className="font-semibold text-texto-primary mb-2 flex items-center gap-2">
          <Icono className="w-4 h-4 text-primary" />
          {item.titulo}
        </h3>
        <p className="text-sm text-texto-secondary leading-relaxed">{item.descripcion}</p>
      </div>
    </motion.div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-base">
      {/* HEADER */}
      <header className="border-b border-gray-800/30 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-xs">SB</span>
            </div>
            <span className="texto-display text-xl text-texto-primary">SilverBack</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm px-4 py-2">Iniciar Sesión</Link>
            <Link to="/registro" className="btn-primary text-sm px-4 py-2">Crear Cuenta</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-xs texto-mono text-primary uppercase tracking-[0.2em] mb-3">Plataforma de Nutrición Deportiva</p>
            <h1 className="texto-display text-4xl sm:text-5xl lg:text-6xl text-texto-primary leading-[0.9] mb-5">
              El combustible<br />de tu <span className="text-primary">rendimiento</span>
            </h1>
            <p className="text-base sm:text-lg text-texto-secondary leading-relaxed max-w-md mb-8">
              SilverBack conecta atletas con nutriólogos deportivos para crear planes de alimentación y rutinas de ejercicio 
              que se adaptan a tu cuerpo, tu deporte y tus metas. Todo en un solo lugar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/registro" className="btn-primary text-sm px-6 py-3 flex items-center gap-2">
                Empieza Gratis <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="btn-secondary text-sm px-6 py-3">Ya tengo cuenta</Link>
            </div>
            <div className="flex items-center gap-4 mt-8 text-xs text-texto-muted">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-emerald-400" /> Datos seguros</span>
              <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-primary" /> Dashboard web</span>
              <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400" /> Multiplataforma</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <CarruselImagenes />
          </motion.div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section className="border-t border-gray-800/30 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs texto-mono text-primary uppercase tracking-[0.2em] mb-2">Funcionalidades</p>
            <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary">Todo lo que necesitas para rendir al máximo</h2>
            <p className="text-sm text-texto-secondary mt-3 max-w-lg mx-auto">
              Desde planes de alimentación hasta rutinas de ejercicio, SilverBack integra las herramientas 
              que atletas y nutriólogos necesitan en un solo ecosistema.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CARACTERISTICAS.map((item, i) => (
              <TarjetaCaracteristica key={item.titulo} item={item} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="border-t border-gray-800/30 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs texto-mono text-primary uppercase tracking-[0.2em] mb-2">Cómo funciona</p>
            <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary">En tres pasos</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                paso: '01',
                titulo: 'Crea tu perfil',
                desc: 'Regístrate como atleta o nutriólogo. Completa tu perfil con tu deporte, objetivos y datos clave.',
                /* COLOCAR RUTA DE IMAGEN: /images/paso-1-registro.jpg */
              },
              {
                paso: '02',
                titulo: 'Conecta o agenda',
                desc: 'Como atleta, busca nutriólogos y agenda citas. Como nutriólogo, recibe pacientes y asigna planes.',
                /* COLOCAR RUTA DE IMAGEN: /images/paso-2-conexion.jpg */
              },
              {
                paso: '03',
                titulo: 'Sigue tu progreso',
                desc: 'Registra comidas, sigue tu rutina de ejercicio y mira cómo evolucionan tus macros día a día.',
                /* COLOCAR RUTA DE IMAGEN: /images/paso-3-progreso.jpg */
              },
            ].map((p, i) => (
              <motion.div
                key={p.paso}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="tarjeta-hover text-center p-6 sm:p-8"
              >
                <span className="texto-display text-5xl text-primary/30 leading-none">{p.paso}</span>
                <h3 className="font-semibold text-texto-primary mt-4 mb-2">{p.titulo}</h3>
                <p className="text-sm text-texto-secondary leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALES */}
      <section className="border-t border-gray-800/30 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs texto-mono text-primary uppercase tracking-[0.2em] mb-2">Testimonios</p>
            <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary">Lo que dicen nuestros usuarios</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {TESTIMONIALES.map((t, i) => (
              <motion.div
                key={t.nombre}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="tarjeta-hover"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-texto-secondary leading-relaxed mb-4 italic">"{t.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{t.iniciales}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-texto-primary">{t.nombre}</p>
                    <p className="text-xs text-texto-muted">{t.rol}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-gray-800/30 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-lg mx-auto"
          >
            <h2 className="texto-display text-3xl sm:text-4xl text-texto-primary mb-4">¿Listo para el siguiente nivel?</h2>
            <p className="text-sm text-texto-secondary mb-8">
              Únete a la comunidad de atletas y nutriólogos que ya entrenan y comen con propósito.
            </p>
            <Link to="/registro" className="btn-primary text-sm px-8 py-3.5 flex items-center gap-2 mx-auto w-fit">
              Crear mi cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-800/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">SB</span>
            </div>
            <span className="texto-display text-sm text-texto-primary">SilverBack</span>
          </div>
          <p className="text-xs text-texto-muted">© 2026 SilverBack. Nutrición deportiva inteligente.</p>
        </div>
      </footer>
    </div>
  )
}
