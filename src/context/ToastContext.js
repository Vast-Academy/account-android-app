import React, {createContext, useState, useCallback} from 'react';

export const ToastContext = createContext();

export const ToastProvider = ({children}) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 2000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast = {id, message, type, duration};

    setToasts(prev => [...prev, toast]);

    setTimeout(() => {
      dismissToast(id);
    }, duration);

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = {
    showToast,
    dismissToast,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};
