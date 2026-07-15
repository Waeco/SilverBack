import Swal from 'sweetalert2'

const TEMA_OSCURO = {
  background: '#1e293b',
  color: '#f1f5f9',
  confirmButtonColor: '#3b82f6',
  cancelButtonColor: '#64748b',
  customClass: {
    popup: 'swal-popup-personalizado',
    title: 'swal-titulo',
    htmlContainer: 'swal-contenido',
    confirmButton: 'swal-confirmar',
    cancelButton: 'swal-cancelar',
    icon: 'swal-icono',
  },
  buttonsStyling: false,
}

export function alertaExito(titulo, texto) {
  return Swal.fire({
    ...TEMA_OSCURO,
    icon: 'success',
    title: titulo,
    text: texto,
    timer: 2500,
    showConfirmButton: false,
    iconColor: '#10b981',
  })
}

export function alertaError(titulo, texto) {
  return Swal.fire({
    ...TEMA_OSCURO,
    icon: 'error',
    title: titulo,
    text: texto,
    iconColor: '#ef4444',
    confirmButtonText: 'Entendido',
  })
}

export function alertaAdvertencia(titulo, texto) {
  return Swal.fire({
    ...TEMA_OSCURO,
    icon: 'warning',
    title: titulo,
    text: texto,
    iconColor: '#f59e0b',
    confirmButtonText: 'Entendido',
  })
}

export function alertaConfirmar(titulo, texto) {
  return Swal.fire({
    ...TEMA_OSCURO,
    icon: 'warning',
    title: titulo,
    text: texto,
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    iconColor: '#f59e0b',
  })
}
