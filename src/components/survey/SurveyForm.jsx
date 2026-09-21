import { memo, useMemo } from 'react';
import { getQuestionNumbers, MAX_TEXT_LENGTH } from '../../utils/surveyModel';
import { selectionLimit, YES_NO_OPTIONS } from '../../utils/answers';

function ClearButton({ onClick }) {
  return (
    <button type="button" className="btn btn-link btn-sm p-0 mt-2 text-decoration-none" onClick={onClick}>
      <i className="bi bi-x-circle me-1" aria-hidden="true" />
      Clear selection
    </button>
  );
}

function RadioList({ q, options, value, onAnswer, disabled, inline = false }) {
  return (
    <div>
      <div className={inline ? 'd-flex flex-wrap gap-4' : ''}>
        {options.map((label, i) => {
          const id = `f-${q.id}-${i}`;
          return (
            <div className="form-check" key={`${label}-${i}`}>
              <input
                className="form-check-input"
                type="radio"
                name={`r-${q.id}`}
                id={id}
                checked={value === label}
                disabled={disabled}
                onChange={() => onAnswer(q.id, label)}
              />
              <label className="form-check-label" htmlFor={id}>
                {label}
              </label>
            </div>
          );
        })}
      </div>
      {value ? <ClearButton onClick={() => onAnswer(q.id, '')} /> : null}
    </div>
  );
}

function Rating({ q, value, onAnswer, disabled }) {
  const max = Number(q.scaleMax) || 5;
  const current = Number(value) || 0;
  return (
    <div>
      <div className="d-flex flex-wrap gap-2" role="group" aria-label={q.text}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`btn sf-rate ${current === n ? 'btn-primary' : 'btn-outline-primary'}`}
            aria-pressed={current === n}
            disabled={disabled}
            onClick={() => onAnswer(q.id, current === n ? '' : n)}
          >
            {n}
          </button>
        ))}
      </div>
      {(q.minLabel || q.maxLabel) && (
        <div className="d-flex justify-content-between small text-secondary mt-1" style={{ maxWidth: max * 52 }}>
          <span>{q.minLabel ? `1 = ${q.minLabel}` : ''}</span>
          <span>{q.maxLabel ? `${max} = ${q.maxLabel}` : ''}</span>
        </div>
      )}
    </div>
  );
}

function Matrix({ q, value, onAnswer, disabled }) {
  const rows = q.rows || [];
  const cols = q.options || [];
  const current = value && typeof value === 'object' ? value : {};
  const setRow = (rowId, label) => onAnswer(q.id, { ...current, [rowId]: label });
  const answered = Object.values(current).some(Boolean);

  return (
    <div>
      {/* Wider screens: a table of radio buttons */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-sm align-middle sf-matrix mb-0">
          <thead>
            <tr>
              <th scope="col" />
              {cols.map((c) => (
                <th scope="col" key={c.id} className="text-center small fw-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="fw-normal">
                  {r.label}
                </th>
                {cols.map((c) => (
                  <td key={c.id} className="text-center">
                    <input
                      className="form-check-input"
                      type="radio"
                      name={`m-${q.id}-${r.id}`}
                      aria-label={`${r.label}: ${c.label}`}
                      checked={current[r.id] === c.label}
                      disabled={disabled}
                      onChange={() => setRow(r.id, c.label)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one compact dropdown per row */}
      <div className="d-md-none d-grid gap-3">
        {rows.map((r) => (
          <div key={r.id}>
            <label className="form-label small fw-semibold mb-1" htmlFor={`mm-${q.id}-${r.id}`}>
              {r.label}
            </label>
            <select
              id={`mm-${q.id}-${r.id}`}
              className="form-select form-select-sm"
              value={current[r.id] || ''}
              disabled={disabled}
              onChange={(e) => setRow(r.id, e.target.value)}
            >
              <option value="">Select...</option>
              {cols.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {answered ? <ClearButton onClick={() => onAnswer(q.id, {})} /> : null}
    </div>
  );
}

function Field({ q, value, onAnswer, disabled, invalid }) {
  const id = `f-${q.id}`;
  const cls = `form-control ${invalid ? 'is-invalid' : ''}`;
  const set = (v) => onAnswer(q.id, v);

  switch (q.type) {
    case 'short_text':
      return <input id={id} type="text" className={cls} maxLength={MAX_TEXT_LENGTH} value={value ?? ''} disabled={disabled} autoComplete="off" onChange={(e) => set(e.target.value)} />;
    case 'long_text':
      return <textarea id={id} rows={4} className={cls} maxLength={MAX_TEXT_LENGTH} value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)} />;
    case 'email':
      return <input id={id} type="email" inputMode="email" className={cls} value={value ?? ''} disabled={disabled} autoComplete="off" onChange={(e) => set(e.target.value)} />;
    case 'number':
      return <input id={id} type="number" inputMode="decimal" step="any" className={cls} style={{ maxWidth: 260 }} value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)} />;
    case 'date':
      return <input id={id} type="date" className={cls} style={{ maxWidth: 260 }} value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)} />;
    case 'multiple_choice':
      return <RadioList q={q} options={(q.options || []).map((o) => o.label)} value={value} onAnswer={onAnswer} disabled={disabled} />;
    case 'yes_no':
      return <RadioList q={q} options={YES_NO_OPTIONS} value={value} onAnswer={onAnswer} disabled={disabled} inline />;
    case 'dropdown':
      return (
        <select id={id} className={`form-select ${invalid ? 'is-invalid' : ''}`} style={{ maxWidth: 420 }} value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)}>
          <option value="">Select...</option>
          {(q.options || []).map((o) => (
            <option key={o.id} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'checkboxes': {
      const selected = Array.isArray(value) ? value : [];
      const limit = selectionLimit(q);
      return (
        <div>
          {limit > 0 && (
            <div className="small text-secondary mb-1">
              Select up to {limit} ({selected.length} selected)
            </div>
          )}
          {(q.options || []).map((o, i) => {
            const checked = selected.includes(o.label);
            const boxId = `${id}-${i}`;
            return (
              <div className="form-check" key={o.id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={boxId}
                  checked={checked}
                  disabled={disabled || (limit > 0 && !checked && selected.length >= limit)}
                  onChange={() => set(checked ? selected.filter((x) => x !== o.label) : [...selected, o.label])}
                />
                <label className="form-check-label" htmlFor={boxId}>
                  {o.label}
                </label>
              </div>
            );
          })}
        </div>
      );
    }
    case 'rating':
      return <Rating q={q} value={value} onAnswer={onAnswer} disabled={disabled} />;
    case 'matrix':
      return <Matrix q={q} value={value} onAnswer={onAnswer} disabled={disabled} />;
    default:
      return null;
  }
}

const QuestionCard = memo(function QuestionCard({ q, number, value, error, onAnswer, disabled }) {
  return (
    <div className={`card sf-qfill mb-3 ${error ? 'border-danger' : ''}`} id={`question-${q.id}`}>
      <div className="card-body">
        <div className="fw-semibold mb-1" style={{ whiteSpace: 'pre-line' }}>
          <span className="text-secondary me-1">{number}.</span>
          {q.text}
          {q.required && (
            <span className="text-danger ms-1" title="Required" aria-label="required">
              *
            </span>
          )}
        </div>
        {q.help ? <div className="form-text mt-0 mb-2">{q.help}</div> : <div className="mb-2" />}
        <Field q={q} value={value} onAnswer={onAnswer} disabled={disabled} invalid={Boolean(error)} />
        {error && (
          <div className="text-danger small mt-2" role="alert">
            <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
});

/** Renders a survey for a respondent (also used for the preview inside the builder). */
export default function SurveyForm({ questions, answers, errors = {}, onAnswer, disabled = false }) {
  const numbers = useMemo(() => getQuestionNumbers(questions), [questions]);
  return (
    <div>
      {questions.map((q) =>
        q.type === 'section' ? (
          <div key={q.id} className="sf-section mt-4 mb-3">
            <h2 className="h5 mb-1">{q.text}</h2>
            {q.help ? <p className="text-secondary mb-0">{q.help}</p> : null}
          </div>
        ) : (
          <QuestionCard key={q.id} q={q} number={numbers[q.id]} value={answers[q.id]} error={errors[q.id]} onAnswer={onAnswer} disabled={disabled} />
        ),
      )}
    </div>
  );
}
