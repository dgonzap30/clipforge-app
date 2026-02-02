import { useState } from 'react'
import { Modal } from './Modal'

/**
 * Example usage of the Modal component
 * This file demonstrates how to use the Modal component in your application
 */
export function ModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="p-8">
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
      >
        Open Modal
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      >
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Modal Title</h2>
          <p className="text-dark-400">
            This is a generic modal component with portal-based rendering.
            It includes an overlay, close button, and supports children content.
          </p>
          <div className="flex gap-2 mt-6">
            <button className="btn-primary">
              Confirm
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Example with custom styling
 */
export function CustomModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="p-8">
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
      >
        Open Custom Modal
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="max-w-2xl"
        closeOnOverlayClick={false}
        closeOnEscape={true}
      >
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gradient">Custom Styled Modal</h2>
          <p className="text-dark-400">
            This modal has custom styling and won't close when clicking the overlay.
            Press ESC or click the close button to dismiss.
          </p>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-sm text-dark-300">
              You can customize the modal's appearance and behavior using props.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Example without close button
 */
export function NoCloseButtonExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="p-8">
      <button
        onClick={() => setIsOpen(true)}
        className="btn-ghost"
      >
        Open Modal (No Close Button)
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showCloseButton={false}
        closeOnEscape={true}
        closeOnOverlayClick={true}
      >
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Important Action</h2>
          <p className="text-dark-400">
            This modal doesn't show a close button, but you can still close it
            by clicking outside or pressing ESC.
          </p>
          <button
            onClick={() => setIsOpen(false)}
            className="btn-primary w-full"
          >
            I Understand
          </button>
        </div>
      </Modal>
    </div>
  )
}
