import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SurveyForm from '../components/survey/SurveyForm';
import Loader from '../components/Loader';
import { getPublicShare } from '../services/shareService';
import { submitResponse } from '../services/responseService';
import { cleanAnswers, validateAnswers } from '../utils/answers';
import { formatDateTimeLong } from '../utils/format';

function Shell({ children }) {
  return (
    <div className="sf-public">
      <header className="sf-public-header">
        <div className="container d-flex align-items-center gap-2" style={{ maxWidth: 780 }}>
          <span className="sf-logo" aria-hidden="true">
            <i className="bi bi-ui-checks-grid" />
          </span>
          <span className="fw-semibold">SurveyForge</span>
        </div>
      </header>
      <main className="container py-4 py-md-5" style={{ maxWidth: 780 }}>
        {children}
      </main>
    </div>
  );
}

function Message({ icon, tone, title, children }) {
  return (
    <div className="card text-center shadow-sm">
      <div className="card-body p-4 p-md-5">
        <i className={`bi ${icon} display-3 ${tone}`} aria-hidden="true" />
        <h1 className="h3 mt-3">{title}</h1>
        <div className="text-secondary">{children}</div>
      </div>
    </div>
  );
}

export default function PublicSurvey() {
  const { shareId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | invalid | error | ready | done
  const [share, setShare] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getPublicShare(shareId);
        if (cancelled) return;
        if (!s || s.questions.length === 0) {
          setStatus('invalid');
        } else {
          setShare(s);
          setStatus('ready');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const onAnswer = useCallback((qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    setErrors((prev) => {
      if (!prev[qid]) return prev;
      const next = { ...prev };
      delete next[qid];
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !share) return;
    setSubmitError('');

    const found = validateAnswers(share.questions, answers);
    setErrors(found);
    const firstBad = share.questions.find((q) => found[q.id]);
    if (firstBad) {
      const el = document.getElementById(`question-${firstBad.id}`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const cleaned = cleanAnswers(share.questions, answers);
    if (Object.keys(cleaned).length === 0) {
      setSubmitError('Please answer at least one question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitResponse({ surveyId: share.surveyId, shareId: share.id, answers: cleaned });
      setStatus('done');
      window.scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      if (err && err.code === 'permission-denied') {
        setSubmitError('This link has expired or was withdrawn, so your answers could not be saved.');
      } else {
        setSubmitError('We could not send your answers. Check your internet connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Shell>
        <Loader label="Opening survey..." />
      </Shell>
    );
  }
  if (status === 'invalid') {
    return (
      <Shell>
        <Message icon="bi-hourglass-bottom" tone="text-warning" title="This survey link has expired">
          Survey links only work for 24 hours. It may also have been withdrawn. Please ask the person who sent it for a new link.
        </Message>
      </Shell>
    );
  }
  if (status === 'error') {
    return (
      <Shell>
        <Message icon="bi-wifi-off" tone="text-danger" title="We could not open the survey">
          Check your internet connection and reload the page.
        </Message>
      </Shell>
    );
  }
  if (status === 'done') {
    return (
      <Shell>
        <Message icon="bi-check-circle-fill" tone="text-success" title="Thank you!">
          Your answers have been sent. You can close this page now.
        </Message>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card sf-public-title mb-4">
        <div className="card-body p-4">
          <h1 className="h3 mb-2 text-break">{share.title}</h1>
          {share.description ? (
            <p className="mb-0 text-secondary" style={{ whiteSpace: 'pre-line' }}>
              {share.description}
            </p>
          ) : null}
          {share.expiresAt ? (
            <p className="small text-secondary mt-3 mb-0">
              <i className="bi bi-clock me-1" aria-hidden="true" />
              This link is open until {formatDateTimeLong(share.expiresAt)}. Fields marked <span className="text-danger">*</span> are required.
            </p>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <SurveyForm questions={share.questions} answers={answers} errors={errors} onAnswer={onAnswer} disabled={submitting} />

        {Object.keys(errors).length > 0 && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
            Please fix the highlighted questions.
          </div>
        )}
        {submitError && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
            {submitError}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg px-5" disabled={submitting}>
          {submitting ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-send me-2" aria-hidden="true" />}
          Submit answers
        </button>
      </form>
    </Shell>
  );
}
