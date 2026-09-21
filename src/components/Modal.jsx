import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bootstrap-styled modal that does not need Bootstrap's JavaScript.
 * Closes on Escape or backdrop click. `footer` is optional.
 */
export default function Modal({ show, title, onClose, children, footer, size = 'lg', scrollable = true }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!show) return undefined;
    document.body.classList.add('modal-open');
    const onKey = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && onCloseRef.current) onCloseRef.current();
        }}
      >
        <div className={`modal-dialog modal-${size} modal-dialog-centered ${scrollable ? 'modal-dialog-scrollable' : ''}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => onCloseRef.current && onCloseRef.current()} />
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
}
