import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: 'bi-check-circle-fill', cls: 'text-success' },
  error: { icon: 'bi-exclamation-triangle-fill', cls: 'text-danger' },
  info: { icon: 'bi-info-circle-fill', cls: 'text-primary' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (variant, message) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((list) => [...list.slice(-3), { id, variant, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), variant === 'error' ? 7000 : 4000));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3 sf-toasts" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => {
          const v = VARIANTS[t.variant];
          return (
            <div key={t.id} className="toast show align-items-center border-0 shadow mb-2" role="status">
              <div className="d-flex">
                <div className="toast-body d-flex align-items-start gap-2">
                  <i className={`bi ${v.icon} ${v.cls} mt-1`} aria-hidden="true" />
                  <span>{t.message}</span>
                </div>
                <button type="button" className="btn-close me-2 m-auto" aria-label="Close" onClick={() => dismiss(t.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
