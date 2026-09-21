import { useEffect, useRef, useState } from 'react';
import { createOption } from '../../utils/surveyModel';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Editable, re-orderable list of labels (used for choices, grid rows and grid columns).
 * `items` = [{ id, label }]. `onChange` receives the new array.
 */
export default function OptionsEditor({ title, noun = 'option', marker = 'bi-circle', items, onChange, idPrefix }) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [focusId, setFocusId] = useState(null);
  const inputs = useRef({});

  useEffect(() => {
    if (focusId && inputs.current[focusId]) {
      inputs.current[focusId].focus();
      setFocusId(null);
    }
  }, [focusId, items]);

  const setLabel = (id, label) => onChange(items.map((o) => (o.id === id ? { ...o, label } : o)));
  const remove = (id) => onChange(items.filter((o) => o.id !== id));
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = () => {
    const option = createOption(`${cap(noun)} ${items.length + 1}`);
    onChange([...items, option]);
    setFocusId(option.id);
  };
  const addBulk = () => {
    const labels = bulkText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!labels.length) return;
    onChange([...items, ...labels.map((l) => createOption(l))]);
    setBulkText('');
    setBulkOpen(false);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="form-label small fw-semibold mb-0">{title}</span>
        <span className="small text-secondary">{items.length}</span>
      </div>

      <ul className="list-unstyled mb-2 d-grid gap-2">
        {items.map((o, i) => (
          <li key={o.id} className="input-group input-group-sm">
            <span className="input-group-text text-secondary">
              <i className={`bi ${marker}`} aria-hidden="true" />
            </span>
            <input
              ref={(el) => {
                if (el) inputs.current[o.id] = el;
                else delete inputs.current[o.id];
              }}
              type="text"
              className="form-control"
              value={o.label}
              placeholder={`${cap(noun)} ${i + 1}`}
              aria-label={`${cap(noun)} ${i + 1}`}
              id={idPrefix ? `${idPrefix}-${o.id}` : undefined}
              onChange={(e) => setLabel(o.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" className="btn btn-outline-secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${noun} ${i + 1} up`}>
              <i className="bi bi-chevron-up" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              aria-label={`Move ${noun} ${i + 1} down`}
            >
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => remove(o.id)}
              disabled={items.length <= 1}
              aria-label={`Remove ${noun} ${i + 1}`}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={add}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Add {noun}
        </button>
        <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setBulkOpen((o) => !o)} aria-expanded={bulkOpen}>
          <i className="bi bi-list-ul me-1" aria-hidden="true" />
          Paste several
        </button>
      </div>

      {bulkOpen && (
        <div className="mt-2">
          <textarea
            className="form-control form-control-sm"
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`One ${noun} per line`}
            aria-label={`Paste ${noun}s, one per line`}
          />
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-primary" onClick={addBulk} disabled={!bulkText.trim()}>
              Add these {noun}s
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
