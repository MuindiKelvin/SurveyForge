import { memo } from 'react';
import { QUESTION_TYPES, OPTION_TYPES, typeIcon, typeLabel } from '../../utils/questionTypes';
import { changeQuestionType, RATING_MAX_SCALE, RATING_MIN_SCALE } from '../../utils/surveyModel';
import OptionsEditor from './OptionsEditor';

const MARKERS = { multiple_choice: 'bi-circle', checkboxes: 'bi-square', dropdown: 'bi-caret-down-square' };

function summaryOf(q) {
  if (OPTION_TYPES.includes(q.type)) return ` \u00B7 ${(q.options || []).length} options`;
  if (q.type === 'matrix') return ` \u00B7 ${(q.rows || []).length} rows \u00D7 ${(q.options || []).length} columns`;
  if (q.type === 'rating') return ` \u00B7 1 to ${q.scaleMax || 5}`;
  return '';
}

function QuestionEditor({ question: q, number, index, total, issues, isOpen, onToggle, onChange, onMove, onDuplicate, onDelete }) {
  const isSection = q.type === 'section';
  const update = (patch) => onChange(q.id, { ...q, ...patch });
  const idBase = `q-${q.id}`;

  return (
    <div className={`card sf-qcard mb-3 ${isOpen ? 'sf-qcard-open' : ''} ${isSection ? 'sf-qcard-section' : ''}`} id={`qcard-${q.id}`}>
      {/* ---- header (always visible) ---- */}
      <div className="d-flex flex-wrap align-items-center gap-2 p-2 ps-3">
        <button
          type="button"
          className="btn btn-link text-start text-decoration-none sf-qhead-main d-flex align-items-center gap-3 p-0 min-w-0"
          onClick={() => onToggle(q.id)}
          aria-expanded={isOpen}
          aria-controls={`${idBase}-body`}
        >
          <span className={`sf-qnum ${isSection ? 'sf-qnum-section' : ''}`}>
            {isSection ? <i className="bi bi-type-h2" aria-hidden="true" /> : number}
          </span>
          <span className="min-w-0">
            <span className="d-block text-truncate fw-semibold text-body">{q.text || (isSection ? 'Untitled section' : 'Untitled question')}</span>
            <span className="d-block small text-secondary text-truncate">
              <i className={`bi ${typeIcon(q.type)} me-1`} aria-hidden="true" />
              {typeLabel(q.type)}
              {summaryOf(q)}
              {q.required ? ' \u00B7 required' : ''}
            </span>
          </span>
        </button>

        {issues.length > 0 && (
          <i
            className="bi bi-exclamation-circle-fill text-warning fs-5"
            title={issues.map((i) => i.message).join('\n')}
            role="img"
            aria-label={`Needs attention: ${issues.map((i) => i.message).join('. ')}`}
          />
        )}

        <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Question actions">
          <button type="button" className="btn btn-outline-secondary" onClick={() => onMove(q.id, -1)} disabled={index === 0} aria-label="Move up" title="Move up">
            <i className="bi bi-arrow-up" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => onMove(q.id, 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            title="Move down"
          >
            <i className="bi bi-arrow-down" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => onDuplicate(q.id)} aria-label="Duplicate" title="Duplicate">
            <i className="bi bi-copy" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-outline-danger" onClick={() => onDelete(q.id)} aria-label="Delete" title="Delete">
            <i className="bi bi-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ---- body (edit form) ---- */}
      {isOpen && (
        <div className="border-top p-3" id={`${idBase}-body`}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label small fw-semibold" htmlFor={`${idBase}-text`}>
                {isSection ? 'Section title' : 'Question'}
              </label>
              <textarea
                id={`${idBase}-text`}
                className="form-control"
                rows={2}
                value={q.text}
                placeholder={isSection ? 'e.g. Business profile' : 'Type your question'}
                onChange={(e) => update({ text: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold" htmlFor={`${idBase}-type`}>
                Answer type
              </label>
              <select id={`${idBase}-type`} className="form-select" value={q.type} onChange={(e) => onChange(q.id, changeQuestionType(q, e.target.value))}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold" htmlFor={`${idBase}-help`}>
                {isSection ? 'Description' : 'Help text'} <span className="text-secondary fw-normal">(optional)</span>
              </label>
              <input
                id={`${idBase}-help`}
                type="text"
                className="form-control"
                value={q.help || ''}
                placeholder={isSection ? 'Shown under the section title' : 'Shown under the question, e.g. "Select all that apply"'}
                onChange={(e) => update({ help: e.target.value })}
              />
            </div>

            {/* ---- choice questions ---- */}
            {OPTION_TYPES.includes(q.type) && (
              <div className="col-12">
                <OptionsEditor
                  title="Options"
                  noun="option"
                  marker={MARKERS[q.type]}
                  items={q.options || []}
                  onChange={(options) => update({ options })}
                  idPrefix={`${idBase}-opt`}
                />
                {q.type === 'checkboxes' && (
                  <div className="mt-3" style={{ maxWidth: 260 }}>
                    <label className="form-label small fw-semibold" htmlFor={`${idBase}-max`}>
                      Limit selections
                    </label>
                    <input
                      id={`${idBase}-max`}
                      type="number"
                      min={0}
                      max={(q.options || []).length}
                      className="form-control form-control-sm"
                      value={q.maxSelections ?? 0}
                      onChange={(e) => update({ maxSelections: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    />
                    <div className="form-text">Most options a respondent may tick. Use 0 for no limit.</div>
                  </div>
                )}
              </div>
            )}

            {/* ---- grid questions ---- */}
            {q.type === 'matrix' && (
              <>
                <div className="col-md-6">
                  <OptionsEditor
                    title="Rows (things to rate)"
                    noun="row"
                    marker="bi-dash-lg"
                    items={q.rows || []}
                    onChange={(rows) => update({ rows })}
                    idPrefix={`${idBase}-row`}
                  />
                </div>
                <div className="col-md-6">
                  <OptionsEditor
                    title="Columns (choices for every row)"
                    noun="column"
                    marker="bi-layout-three-columns"
                    items={q.options || []}
                    onChange={(options) => update({ options })}
                    idPrefix={`${idBase}-col`}
                  />
                </div>
              </>
            )}

            {/* ---- rating ---- */}
            {q.type === 'rating' && (
              <>
                <div className="col-sm-4">
                  <label className="form-label small fw-semibold" htmlFor={`${idBase}-scale`}>
                    Scale from 1 to
                  </label>
                  <select
                    id={`${idBase}-scale`}
                    className="form-select form-select-sm"
                    value={q.scaleMax || 5}
                    onChange={(e) => update({ scaleMax: parseInt(e.target.value, 10) })}
                  >
                    {Array.from({ length: RATING_MAX_SCALE - RATING_MIN_SCALE + 1 }, (_, i) => RATING_MIN_SCALE + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-sm-4">
                  <label className="form-label small fw-semibold" htmlFor={`${idBase}-minl`}>
                    Label for 1
                  </label>
                  <input
                    id={`${idBase}-minl`}
                    type="text"
                    className="form-control form-control-sm"
                    value={q.minLabel || ''}
                    placeholder="e.g. Poor"
                    onChange={(e) => update({ minLabel: e.target.value })}
                  />
                </div>
                <div className="col-sm-4">
                  <label className="form-label small fw-semibold" htmlFor={`${idBase}-maxl`}>
                    Label for {q.scaleMax || 5}
                  </label>
                  <input
                    id={`${idBase}-maxl`}
                    type="text"
                    className="form-control form-control-sm"
                    value={q.maxLabel || ''}
                    placeholder="e.g. Excellent"
                    onChange={(e) => update({ maxLabel: e.target.value })}
                  />
                </div>
              </>
            )}

            {q.type === 'yes_no' && (
              <div className="col-12 small text-secondary">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                Respondents choose between <strong>Yes</strong> and <strong>No</strong>.
              </div>
            )}
            {['short_text', 'long_text', 'number', 'date', 'email'].includes(q.type) && (
              <div className="col-12 small text-secondary">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                Respondents type their own answer{q.type === 'email' ? ' (checked to be a valid email address)' : ''}.
              </div>
            )}

            {!isSection && (
              <div className="col-12">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id={`${idBase}-req`}
                    checked={Boolean(q.required)}
                    onChange={(e) => update({ required: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={`${idBase}-req`}>
                    Required
                  </label>
                </div>
              </div>
            )}

            {issues.length > 0 && (
              <div className="col-12">
                <div className="alert alert-warning py-2 px-3 mb-0 small" role="status">
                  <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
                  {issues.map((i) => i.message).join(' \u00B7 ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(QuestionEditor);
