import { useState, useEffect, createContext, useContext } from 'react';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        const duracion = type === 'error' ? 6000 : 1500;
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracion);
    };

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        {t.type === 'success' && '✓'}
                        {t.type === 'error' && '✕'}
                        {t.type === 'warning' && '⚠'}
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
