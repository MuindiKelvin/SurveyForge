import { useState } from 'react';
import Modal from './Modal';
import {
  DEFAULT_DATA_OPTIONS,
  EXPORT_FORMATS,
  EXPORT_GROUPS,
  FORMAT_MAP,
  HEADER_CHOICES,
  VALUES_CHOICES,
} from '../utils/exportFormats';

/**
 * "Download results" dialog: pick a file format and, for data formats, how answers are written.
 * `onDownload(formatKey, options)` may be async; `busy` is true while a file is being created.
 */
export default function DownloadResultsModal({ show, onClose, onDownload, busy = false, responseCount = 0 }) {
  const [format, setFormat] = useState('xlsx');
  const [options, setOptions] = useState(DEFAULT_DATA_OPTIONS);

  const def = FORMAT_MAP[format];
  const setOption = (key, value) => setOptions((prev) => ({ ...prev, [key]: value }));
  const has = (key) => def.options.includes(key);

  const radioGroup = (name, legend, choices, current, onPick) => (
    <fieldset className="mb-3">
      <legend className="form-label fw-semibold fs-6 mb-1">{legend}</legend>
      {choices.map((c) => (
        <div className="form-check" key={c.value}>
          <input
            className="form-check-input"
            type="radio"
            name={name}
            id={`${name}-${c.value}`}
            checked={current === c.value}
            onChange={() => onPick(c.value)}
            disabled={busy}
          />
          <label className="form-check-label" htmlFor={`${name}-${c.value}`}>
            {c.label} <span className="text-secondary small">- {c.hint}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );

  return (
    <Modal
      show={show}
      title="Download results"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onDownload(format, options)} disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-download me-2" aria-hidden="true" />}
            Download {def.label}
          </button>
        </>
      }
    >
      <p className="text-secondary small">
        {responseCount === 1 ? '1 response' : `${responseCount} responses`} will be included. Choose a file format.
      </p>

      {EXPORT_GROUPS.map((group) => (
        <section key={group.key} className="mb-3" aria-label={group.label}>
          <h3 className="h6 mb-0">{group.label}</h3>
          <p className="small text-secondary mb-2">{group.hint}</p>
          <div className="list-group" role="radiogroup" aria-label={`${group.label} formats`}>
            {EXPORT_FORMATS.filter((f) => f.group === group.key).map((f) => (
              <div key={f.key} className={`list-group-item d-flex align-items-start gap-3 ${format === f.key ? 'bg-primary-subtle border-primary' : ''}`}>
                <input
                  className="form-check-input mt-2 flex-shrink-0"
                  type="radio"
                  name="download-format"
                  id={`fmt-${f.key}`}
                  value={f.key}
                  checked={format === f.key}
                  onChange={() => setFormat(f.key)}
                  aria-describedby={`fmt-${f.key}-hint`}
                  disabled={busy}
                />
                <i className={`bi ${f.icon} fs-4 text-primary flex-shrink-0`} aria-hidden="true" />
                <div className="min-w-0">
                  <label className="fw-semibold" htmlFor={`fmt-${f.key}`}>
                    {f.label} <span className="badge text-bg-light border fw-normal">{f.ext}</span>
                  </label>
                  <div className="small text-secondary" id={`fmt-${f.key}-hint`}>
                    {f.hint}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {(def.options.length > 0 || def.note) && (
        <div className="card bg-body-tertiary" aria-live="polite">
          <div className="card-body">
            <h3 className="h6">{def.label} options</h3>
            {def.note && <p className="small text-secondary mb-3">{def.note}</p>}
            {has('values') && radioGroup('opt-values', 'Answer values', VALUES_CHOICES, options.values, (v) => setOption('values', v))}
            {has('headers') && radioGroup('opt-headers', 'Column headings', HEADER_CHOICES, options.headers, (v) => setOption('headers', v))}
            {has('splitMulti') && (
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="opt-split"
                  checked={options.splitMulti}
                  onChange={(e) => setOption('splitMulti', e.target.checked)}
                  disabled={busy}
                />
                <label className="form-check-label" htmlFor="opt-split">
                  Put each checkbox choice in its own column
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
