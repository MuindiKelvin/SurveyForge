import { useCallback, useRef, useState } from 'react';
import { useOutsideClick } from '../hooks/useOutsideClick';

/**
 * Small dropdown with download options.
 * `items` = [{ key, label, icon, onSelect }]. `onSelect` may be async.
 */
export default function DownloadMenu({ items, label = 'Download', busyKey = '', disabled = false, buttonClass = 'btn btn-outline-secondary btn-sm', hideLabelOnMobile = true }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(ref, close, open);

  return (
    <div className="position-relative d-inline-block" ref={ref}>
      <button type="button" className={buttonClass} onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        {busyKey ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-download" aria-hidden="true" />}
        <span className={hideLabelOnMobile ? 'd-none d-md-inline ms-1' : 'ms-1'}>{label}</span>
      </button>
      <div className={`dropdown-menu dropdown-menu-end sf-user-menu shadow ${open ? 'show' : ''}`} role="menu">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="dropdown-item"
            role="menuitem"
            disabled={Boolean(busyKey)}
            onClick={async () => {
              setOpen(false);
              await item.onSelect();
            }}
          >
            <i className={`bi ${item.icon} me-2`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
