import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    // यदि मॉडल बंद हो रहा है, तो एक कस्टम इवेंट ट्रिगर करें
    // जिसे पेरेंट कंपोनेंट सुन सकता है
    if (!isOpen) {
      const event = new CustomEvent('modalClosed');
      window.dispatchEvent(event);
    }
  };
}, [isOpen, onClose]);
  
  // Prevent scrolling on the background when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg md:max-w-2xl',
    lg: 'sm:max-w-lg md:max-w-3xl lg:max-w-4xl',
    xl: 'sm:max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity" 
          aria-hidden="true"
          onClick={() => {
            // मॉडल को बंद करें, और onClose कॉल करें
            onClose();
          }}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        {/* Modal panel */}
        <div 
          className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full ${sizeClasses[size]}`}
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          {/* Modal header */}
          <div className="flex justify-between items-center bg-gray-50 px-6 py-4 border-b">
            <h3 
              className="text-lg font-medium text-gray-900" 
              id="modal-headline"
            >
              {title}
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
          
          {/* Modal content */}
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;