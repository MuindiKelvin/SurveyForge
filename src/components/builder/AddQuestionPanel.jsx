import { QUESTION_TYPES } from '../../utils/questionTypes';

export default function AddQuestionPanel({ onAdd }) {
  return (
    <div className="card sf-add-panel">
      <div className="card-body">
        <h2 className="h6 mb-3">
          <i className="bi bi-plus-circle me-2 text-primary" aria-hidden="true" />
          Add a question
        </h2>
        <div className="row g-2">
          {QUESTION_TYPES.map((t) => (
            <div className="col-6 col-md-4 col-xl-3" key={t.value}>
              <button
                type="button"
                className="btn btn-outline-secondary w-100 text-start d-flex align-items-center gap-2 sf-type-btn"
                onClick={() => onAdd(t.value)}
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
