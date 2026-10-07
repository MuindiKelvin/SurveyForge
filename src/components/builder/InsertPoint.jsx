import { memo } from 'react';
import { QUESTION_TYPES } from '../../utils/questionTypes';

/**
 * A small "Insert here" strip that sits before a question. Opening it shows the same question and section
 * types as the bottom panel; picking one inserts it at exactly this position.
 */
function InsertPoint({ index, open, label, onOpen, onClose, onPick }) {
  if (!open) {
    return (
      <div className="sf-insert">
        <button type="button" className="sf-insert-btn" onClick={() => onOpen(index)} aria-label={`Insert a question or section at position ${index + 1}`}>
          <i className="bi bi-plus-lg" aria-hidden="true" />
          <span>Insert here</span>
        </button>
      </div>
    );
  }

  return (
    <div className="card sf-insert-panel mb-3" role="group" aria-label={`Choose what to insert at position ${index + 1}`}>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <h2 className="h6 mb-0 text-truncate">
            <i className="bi bi-arrow-return-right me-2 text-primary" aria-hidden="true" />
            {label}
          </h2>
          <button type="button" className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="row g-2">
          {QUESTION_TYPES.map((t) => (
            <div className="col-6 col-md-4 col-xl-3" key={t.value}>
              <button
                type="button"
                className="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-2 sf-type-btn"
                onClick={() => onPick(t.value, index)}
                title={t.hint}
              >
                <i className={`bi ${t.icon} text-primary`} aria-hidden="true" />
                <span className="small">{t.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(InsertPoint);
