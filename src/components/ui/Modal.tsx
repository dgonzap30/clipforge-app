import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
  closeButtonClassName?: string
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  closeButtonClassName,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, closeOnEscape])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const modalRoot = document.getElementById('modal-root')
  if (!modalRoot) {
    console.error('Modal root element not found. Make sure to add <div id="modal-root"></div> to your HTML.')
    return null
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'relative w-full max-w-lg max-h-[90vh] overflow-auto card p-6 m-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          className
        )}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className={cn(
              'absolute top-4 right-4 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all',
              closeButtonClassName
            )}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {children}
      </div>
    </div>,
    modalRoot
  )
}
