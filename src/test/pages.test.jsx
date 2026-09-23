import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom';
import { makeQuestion } from '../utils/surveyModel';
import { buildOwnerDiagnosticTemplate } from '../templates/ownerDiagnostic';

// Charts need a real <canvas>; replace them with simple placeholders.
vi.mock('react-chartjs-2', () => ({
  Doughnut: (props) => <div data-testid="doughnut" aria-label={props['aria-label']} />,
  Bar: (props) => <div data-testid="bar" aria-label={props['aria-label']} />,
}));

const auth = { user: { uid: 'u1', email: 'me@example.com', displayName: 'Me' }, loading: false };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ ...auth, signInWithGoogle: vi.fn(), signInWithEmail: vi.fn(), signUpWithEmail: vi.fn(), resetPassword: vi.fn(), logout: vi.fn() }),
  friendlyAuthError: (e) => e.message,
}));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../services/surveyService', () => ({
  listSurveys: vi.fn(),
  getSurvey: vi.fn(),
  createSurvey: vi.fn(),
  updateSurvey: vi.fn(),
  duplicateSurvey: vi.fn(),
  countResponses: vi.fn(),
  deleteSurveyCascade: vi.fn(),
}));
vi.mock('../services/shareService', () => ({
  createShare: vi.fn(),
  listShares: vi.fn(),
  revokeShare: vi.fn(),
  getPublicShare: vi.fn(),
  shareUrl: (id) => `https://example.test/s/${id}`,
  SHARE_TTL_MS: 86400000,
}));
vi.mock('../services/responseService', () => ({
  submitResponse: vi.fn(),
  listResponses: vi.fn(),
  MAX_RESPONSES_LOADED: 5000,
}));

const surveyService = await import('../services/surveyService');
const shareService = await import('../services/shareService');
const responseService = await import('../services/responseService');

const { default: PublicSurvey } = await import('../pages/PublicSurvey');
const { default: SurveyBuilder } = await import('../pages/SurveyBuilder');
const { default: Dashboard } = await import('../pages/Dashboard');
const { default: SurveyDetail } = await import('../pages/SurveyDetail');
const { default: SurveyResults } = await import('../pages/SurveyResults');
const { default: Login } = await import('../pages/Login');
const { default: SurveyForm } = await import('../components/survey/SurveyForm');

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleSurvey = () => ({
  id: 's1',
  title: 'Customer survey',
  description: 'Tell us more',
  status: 'complete',
  ownerId: 'u1',
  createdAt: 1,
  updatedAt: 2,
  questions: [
    makeQuestion({ type: 'section', text: 'About you' }),
    makeQuestion({ type: 'short_text', text: 'Your name', required: true }),
    makeQuestion({ type: 'multiple_choice', text: 'Favourite colour', options: ['Red', 'Blue'] }),
    makeQuestion({ type: 'checkboxes', text: 'Toppings', options: ['A', 'B', 'C'], maxSelections: 2 }),
    makeQuestion({ type: 'rating', text: 'Rate us', scaleMax: 5 }),
    makeQuestion({ type: 'matrix', text: 'How was it?', rows: ['Food', 'Service'], options: ['Bad', 'Good'] }),
  ],
});

describe('SurveyForm', () => {
  it('lets a respondent answer every kind of question and limits checkboxes', async () => {
    const user = userEvent.setup();
    const s = sampleSurvey();
    let answers = {};
    const onAnswer = vi.fn((id, v) => {
      answers = { ...answers, [id]: v };
    });
    const { rerender } = render(<SurveyForm questions={s.questions} answers={answers} onAnswer={onAnswer} />);

    await user.type(screen.getByRole('textbox'), 'A');
    expect(onAnswer).toHaveBeenCalledWith(s.questions[1].id, 'A');

    await user.click(screen.getByLabelText('Blue'));
    expect(onAnswer).toHaveBeenCalledWith(s.questions[2].id, 'Blue');

    rerender(<SurveyForm questions={s.questions} answers={{ [s.questions[3].id]: ['A', 'B'] }} onAnswer={onAnswer} />);
    expect(screen.getByLabelText('C')).toBeDisabled(); // limit of 2 reached
    expect(screen.getByLabelText('A')).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '4' }));
    expect(onAnswer).toHaveBeenCalledWith(s.questions[4].id, 4);

    await user.click(screen.getByLabelText('Food: Good'));
    expect(onAnswer).toHaveBeenCalledWith(s.questions[5].id, { [s.questions[5].rows[0].id]: 'Good' });
    // section headings are shown but not numbered
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
  });
});

describe('PublicSurvey', () => {
  const renderPublic = () =>
    render(
      <MemoryRouter initialEntries={['/s/abc123']}>
        <Routes>
          <Route path="/s/:shareId" element={<PublicSurvey />} />
        </Routes>
      </MemoryRouter>,
    );

  const acceptConsent = async (user) => {
    await screen.findByRole('heading', { name: 'Customer survey' });
    await user.click(screen.getByLabelText(/agree to have my responses/i));
    await user.click(screen.getByRole('button', { name: /continue to survey/i }));
  };

  it('shows an expired message when the link is not readable', async () => {
    shareService.getPublicShare.mockResolvedValue(null);
    renderPublic();
    expect(await screen.findByText(/link has expired/i)).toBeInTheDocument();
  });

  it('asks for consent before showing the survey, and blocks continuing until agreed', async () => {
    const user = userEvent.setup();
    const s = sampleSurvey();
    shareService.getPublicShare.mockResolvedValue({ id: 'abc123', surveyId: 's1', title: s.title, description: s.description, questions: s.questions, expiresAt: Date.now() + 3600000 });
    renderPublic();

    await screen.findByRole('heading', { name: 'Customer survey' });
    expect(screen.queryByRole('button', { name: /submit answers/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to survey/i })).toBeDisabled();

    await user.click(screen.getByLabelText(/agree to have my responses/i));
    expect(screen.getByRole('button', { name: /continue to survey/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /continue to survey/i }));

    expect(await screen.findByRole('button', { name: /submit answers/i })).toBeInTheDocument();
  });

  it('validates, submits cleaned answers and thanks the respondent', async () => {
    const user = userEvent.setup();
    const s = sampleSurvey();
    shareService.getPublicShare.mockResolvedValue({ id: 'abc123', surveyId: 's1', title: s.title, description: s.description, questions: s.questions, expiresAt: Date.now() + 3600000 });
    responseService.submitResponse.mockResolvedValue();
    renderPublic();

    await acceptConsent(user);
    await user.click(screen.getByRole('button', { name: /submit answers/i }));
    expect(await screen.findByText('This question is required.')).toBeInTheDocument();
    expect(responseService.submitResponse).not.toHaveBeenCalled();

    await user.type(screen.getAllByRole('textbox')[0], '  Wanjiru ');
    await user.click(screen.getByLabelText('Red'));
    await user.click(screen.getByLabelText('A'));
    await user.click(screen.getByLabelText('C'));
    await user.click(screen.getByRole('button', { name: /submit answers/i }));

    expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    expect(responseService.submitResponse).toHaveBeenCalledTimes(1);
    const arg = responseService.submitResponse.mock.calls[0][0];
    expect(arg).toMatchObject({ surveyId: 's1', shareId: 'abc123' });
    expect(arg.answers).toEqual({
      [s.questions[1].id]: 'Wanjiru',
      [s.questions[2].id]: 'Red',
      [s.questions[3].id]: ['A', 'C'],
    });
  });

  it('explains when the link expired while the person was filling it in', async () => {
    const user = userEvent.setup();
    const s = sampleSurvey();
    shareService.getPublicShare.mockResolvedValue({ id: 'abc123', surveyId: 's1', title: s.title, description: '', questions: s.questions, expiresAt: null });
    responseService.submitResponse.mockRejectedValue({ code: 'permission-denied' });
    renderPublic();
    await acceptConsent(user);
    await user.type(screen.getAllByRole('textbox')[0], 'X');
    await user.click(screen.getByRole('button', { name: /submit answers/i }));
    expect(await screen.findByText(/expired or was withdrawn/i)).toBeInTheDocument();
  });
});

function renderBuilder(path) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>HOME</div> },
      { path: '/surveys/new', element: <SurveyBuilder /> },
      { path: '/surveys/:id/edit', element: <SurveyBuilder /> },
      { path: '/surveys/:id', element: <div>DETAIL PAGE</div> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('SurveyBuilder', () => {
  it('starts empty at 0% and updates progress as the survey is built', async () => {
    const user = userEvent.setup();
    renderBuilder('/surveys/new');
    expect(screen.getByText('No questions yet. Pick a question type below to add your first one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Survey title'), 'My survey');
    await user.type(screen.getByLabelText('Description'), 'About');
    await user.click(screen.getByRole('button', { name: /multiple choice/i }));
    // a fresh multiple-choice question has default options but no text yet
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeDisabled();
    await user.type(screen.getByLabelText('Question'), 'Which one?');
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeEnabled();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('saves a new draft, then navigates to the edit page', async () => {
    const user = userEvent.setup();
    surveyService.createSurvey.mockResolvedValue('newid');
    surveyService.getSurvey.mockResolvedValue({ id: 'newid', title: 'T', description: '', status: 'draft', questions: [] });
    const router = renderBuilder('/surveys/new');
    await user.type(screen.getByLabelText('Survey title'), 'T');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(surveyService.createSurvey).toHaveBeenCalled());
    expect(surveyService.createSurvey.mock.calls[0][0]).toBe('u1');
    expect(surveyService.createSurvey.mock.calls[0][1]).toMatchObject({ title: 'T', status: 'draft', questions: [] });
    await waitFor(() => expect(router.state.location.pathname).toBe('/surveys/newid/edit'));
  });

  it('refuses to save without a title', async () => {
    const user = userEvent.setup();
    renderBuilder('/surveys/new');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(toast.error).toHaveBeenCalled();
    expect(surveyService.createSurvey).not.toHaveBeenCalled();
  });

  it('loads the diagnostic template as 100% complete and can save it as complete', async () => {
    const user = userEvent.setup();
    surveyService.createSurvey.mockResolvedValue('tpl1');
    const router = renderBuilder('/surveys/new?template=owner-diagnostic');
    expect(screen.getByLabelText('Survey title')).toHaveValue(buildOwnerDiagnosticTemplate().title);
    expect(screen.getByText('(43)')).toBeInTheDocument();
    const complete = screen.getByRole('button', { name: /mark complete/i });
    expect(complete).toBeEnabled();
    await user.click(complete);
    await waitFor(() => expect(surveyService.createSurvey).toHaveBeenCalled());
    const payload = surveyService.createSurvey.mock.calls[0][1];
    expect(payload.status).toBe('complete');
    expect(payload.questions).toHaveLength(53); // 43 questions + 10 sections
    expect(JSON.stringify(payload)).not.toContain('undefined');
    await waitFor(() => expect(router.state.location.pathname).toBe('/surveys/tpl1'));
  });

  it('edits an existing survey: reorder, duplicate and delete', async () => {
    const user = userEvent.setup();
    const existing = sampleSurvey();
    surveyService.getSurvey.mockResolvedValue(existing);
    surveyService.updateSurvey.mockResolvedValue();
    renderBuilder('/surveys/s1/edit');
    await screen.findByDisplayValue('Customer survey');

    // 6 items: 5 real questions
    expect(screen.getByText('(5)')).toBeInTheDocument();
    const duplicateButtons = screen.getAllByRole('button', { name: 'Duplicate' });
    await user.click(duplicateButtons[1]); // [0] is the section heading
    expect(screen.getByText('(6)')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[1]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete question/i }));
    expect(screen.getByText('(5)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save as draft/i }));
    await waitFor(() => expect(surveyService.updateSurvey).toHaveBeenCalled());
    expect(surveyService.updateSurvey.mock.calls[0][0]).toBe('s1');
    expect(surveyService.updateSurvey.mock.calls[0][1].status).toBe('draft');
  });

  it('shows a not-found page for a survey the user cannot open', async () => {
    surveyService.getSurvey.mockResolvedValue(null);
    renderBuilder('/surveys/nope/edit');
    expect(await screen.findByText('Survey not found')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  it('lists surveys with status, counts and progress', async () => {
    const complete = sampleSurvey();
    const draft = { ...sampleSurvey(), id: 's2', title: 'Draft one', status: 'draft' };
    surveyService.listSurveys.mockResolvedValue([complete, draft]);
    surveyService.countResponses.mockImplementation(async (id) => (id === 's1' ? 7 : 0));
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Customer survey')).toBeInTheDocument();
    expect(screen.getByText('Draft one')).toBeInTheDocument();
    expect(screen.getByText(/7 responses/)).toBeInTheDocument();
    expect(screen.getAllByTestId('doughnut').length).toBeGreaterThan(0);
  });

  it('shows the empty state', async () => {
    surveyService.listSurveys.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Create your first survey')).toBeInTheDocument();
  });
});

describe('SurveyDetail', () => {
  const renderDetail = () =>
    render(
      <MemoryRouter initialEntries={['/surveys/s1']}>
        <Routes>
          <Route path="/surveys/:id" element={<SurveyDetail />} />
        </Routes>
      </MemoryRouter>,
    );

  it('creates a 24-hour link and lists active and expired links', async () => {
    const user = userEvent.setup();
    surveyService.getSurvey.mockResolvedValue(sampleSurvey());
    surveyService.countResponses.mockResolvedValue(3);
    const now = Date.now();
    shareService.listShares.mockResolvedValue([
      { id: 'live1', createdAt: now - 3600000, expiresAt: now + 23 * 3600000 },
      { id: 'old1', createdAt: now - 30 * 3600000, expiresAt: now - 6 * 3600000 },
    ]);
    shareService.createShare.mockResolvedValue('new1');
    renderDetail();
    expect(await screen.findByDisplayValue('https://example.test/s/live1')).toBeInTheDocument();
    expect(screen.getByText(/23h/)).toBeInTheDocument();
    expect(screen.getByText('Expired links')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create 24-hour link/i }));
    await waitFor(() => expect(shareService.createShare).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), 'u1', 'Me'));
  });

  it('blocks sharing while the survey is a draft', async () => {
    surveyService.getSurvey.mockResolvedValue({ ...sampleSurvey(), status: 'draft' });
    surveyService.countResponses.mockResolvedValue(0);
    shareService.listShares.mockResolvedValue([]);
    renderDetail();
    expect(await screen.findByText(/still a draft/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create 24-hour link/i })).toBeDisabled();
  });
});

describe('SurveyResults', () => {
  it('summarises responses and lists individual answers', async () => {
    const user = userEvent.setup();
    const s = sampleSurvey();
    surveyService.getSurvey.mockResolvedValue(s);
    responseService.listResponses.mockResolvedValue([
      { id: 'b', submittedAt: 2000, answers: { [s.questions[1].id]: 'Beta', [s.questions[2].id]: 'Blue', [s.questions[4].id]: 4 } },
      { id: 'a', submittedAt: 1000, answers: { [s.questions[1].id]: 'Alpha', [s.questions[2].id]: 'Red', [s.questions[3].id]: ['A', 'B'] } },
    ]);
    render(
      <MemoryRouter initialEntries={['/surveys/s1/results']}>
        <Routes>
          <Route path="/surveys/:id/results" element={<SurveyResults />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Your name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getAllByTestId('doughnut').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: /individual responses/i }));
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download results/i })).toBeEnabled();
  });

  it('shows an empty state with no responses', async () => {
    surveyService.getSurvey.mockResolvedValue(sampleSurvey());
    responseService.listResponses.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/surveys/s1/results']}>
        <Routes>
          <Route path="/surveys/:id/results" element={<SurveyResults />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('No responses yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download results/i })).toBeDisabled();
  });
});

describe('Login', () => {
  it('toggles between sign in and create account', async () => {
    const user = userEvent.setup();
    auth.user = null;
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    auth.user = { uid: 'u1', email: 'me@example.com', displayName: 'Me' };
  });
});

// ------------------------------------------------------------------------------------
// Team collaboration: every signed-in user can see and work on every survey.
// ------------------------------------------------------------------------------------
describe('Team collaboration', () => {
  const teammateSurvey = () => ({ ...sampleSurvey(), id: 's9', title: 'Wanjiku survey', ownerId: 'u2', ownerName: 'Wanjiku', updatedByName: 'Brian' });

  it('dashboard lists surveys created by teammates, says who made them, and only offers delete on your own', async () => {
    const user = userEvent.setup();
    const mine = sampleSurvey();
    surveyService.listSurveys.mockResolvedValue([mine, teammateSurvey()]);
    surveyService.countResponses.mockResolvedValue(0);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Wanjiku survey')).toBeInTheDocument();
    expect(screen.getByText('Customer survey')).toBeInTheDocument();
    expect(screen.getByText(/Created by Wanjiku/)).toBeInTheDocument();
    expect(screen.getByText(/last edited by Brian/)).toBeInTheDocument();
    expect(screen.getByText(/Created by you/)).toBeInTheDocument();
    // the listing is no longer filtered by user id
    expect(surveyService.listSurveys).toHaveBeenCalledWith();

    // Results / Edit / Duplicate are available on the teammate's survey, Delete is not
    expect(screen.getByRole('button', { name: 'Delete Customer survey' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Wanjiku survey' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate Wanjiku survey' })).toBeInTheDocument();

    // filter: created by me
    await user.click(screen.getByRole('button', { name: /created by me \(1\)/i }));
    expect(screen.queryByText('Wanjiku survey')).not.toBeInTheDocument();
    expect(screen.getByText('Customer survey')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /all surveys \(2\)/i }));
    expect(screen.getByText('Wanjiku survey')).toBeInTheDocument();
  });

  it('dashboard search also finds a survey by its creator', async () => {
    const user = userEvent.setup();
    surveyService.listSurveys.mockResolvedValue([sampleSurvey(), teammateSurvey()]);
    surveyService.countResponses.mockResolvedValue(0);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await screen.findByText('Wanjiku survey');
    await user.type(screen.getByLabelText('Search surveys'), 'wanjiku');
    expect(screen.getByText('Wanjiku survey')).toBeInTheDocument();
    expect(screen.queryByText('Customer survey')).not.toBeInTheDocument();
  });

  it('duplicating a teammate\'s survey makes a copy owned by you', async () => {
    const user = userEvent.setup();
    surveyService.listSurveys.mockResolvedValue([teammateSurvey()]);
    surveyService.countResponses.mockResolvedValue(0);
    surveyService.duplicateSurvey.mockResolvedValue('copy1');
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    await screen.findByText('Wanjiku survey');
    await user.click(screen.getByRole('button', { name: 'Duplicate Wanjiku survey' }));
    await waitFor(() => expect(surveyService.duplicateSurvey).toHaveBeenCalled());
    expect(surveyService.duplicateSurvey.mock.calls[0][0]).toBe('u1');
    expect(surveyService.duplicateSurvey.mock.calls[0][2]).toBe('Me');
  });

  it('a teammate can open the share page and results of a survey they did not create', async () => {
    const other = teammateSurvey();
    surveyService.getSurvey.mockResolvedValue(other);
    surveyService.countResponses.mockResolvedValue(4);
    shareService.listShares.mockResolvedValue([{ id: 'live9', createdAt: Date.now() - 1000, expiresAt: Date.now() + 3600000, createdByName: 'Brian' }]);
    const { unmount } = render(
      <MemoryRouter initialEntries={['/surveys/s9']}>
        <Routes>
          <Route path="/surveys/:id" element={<SurveyDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByDisplayValue('https://example.test/s/live9')).toBeInTheDocument();
    expect(screen.getByText(/Created by Wanjiku/)).toBeInTheDocument();
    expect(screen.getByText(/Created by Brian/)).toBeInTheDocument();
    expect(surveyService.getSurvey).toHaveBeenCalledWith('s9');
    expect(shareService.listShares).toHaveBeenCalledWith('s9');
    unmount();

    const s = other;
    responseService.listResponses.mockResolvedValue([{ id: 'a', submittedAt: 1000, answers: { [s.questions[1].id]: 'Alpha' } }]);
    render(
      <MemoryRouter initialEntries={['/surveys/s9/results']}>
        <Routes>
          <Route path="/surveys/:id/results" element={<SurveyResults />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(responseService.listResponses).toHaveBeenCalledWith('s9');
  });

  it('a teammate can edit a survey they did not create and their name is recorded', async () => {
    const user = userEvent.setup();
    surveyService.getSurvey.mockResolvedValue(teammateSurvey());
    surveyService.updateSurvey.mockResolvedValue();
    renderBuilder('/surveys/s9/edit');
    await screen.findByDisplayValue('Wanjiku survey');
    expect(screen.getByText(/Shared with your team/)).toBeInTheDocument();
    expect(screen.getByText(/Created by Wanjiku/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Description'), ' more');
    await user.click(screen.getByRole('button', { name: /save as draft/i }));
    await waitFor(() => expect(surveyService.updateSurvey).toHaveBeenCalled());
    expect(surveyService.updateSurvey.mock.calls[0][0]).toBe('s9');
    expect(surveyService.updateSurvey.mock.calls[0][1]).toMatchObject({ updatedByName: 'Me', status: 'draft' });
  });

  it('new surveys record who created them', async () => {
    const user = userEvent.setup();
    surveyService.createSurvey.mockResolvedValue('n1');
    surveyService.getSurvey.mockResolvedValue({ id: 'n1', title: 'T', description: '', status: 'draft', questions: [] });
    renderBuilder('/surveys/new');
    await user.type(screen.getByLabelText('Survey title'), 'T');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(surveyService.createSurvey).toHaveBeenCalled());
    expect(surveyService.createSurvey.mock.calls[0][1]).toMatchObject({ ownerName: 'Me' });
  });

  describe('overwrite protection', () => {
    const loadAndEdit = async (user) => {
      surveyService.getSurvey.mockResolvedValue({ ...teammateSurvey(), updatedAt: 1000 });
      surveyService.updateSurvey.mockResolvedValue();
      renderBuilder('/surveys/s9/edit');
      await screen.findByDisplayValue('Wanjiku survey');
      await user.type(screen.getByLabelText('Description'), ' my edit');
    };

    it('asks first when a teammate saved after the page was opened, and does not save yet', async () => {
      const user = userEvent.setup();
      await loadAndEdit(user);
      // a teammate saves while we are editing
      surveyService.getSurvey.mockResolvedValue({ ...teammateSurvey(), updatedAt: 5000, updatedByName: 'Brian' });
      await user.click(screen.getByRole('button', { name: /save as draft/i }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Brian saved changes/)).toBeInTheDocument();
      expect(surveyService.updateSurvey).not.toHaveBeenCalled();

      // "Keep editing" closes the dialog without saving
      await user.click(within(dialog).getByRole('button', { name: /keep editing/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(surveyService.updateSurvey).not.toHaveBeenCalled();
    });

    it('saves over the teammate\'s version only after explicit confirmation', async () => {
      const user = userEvent.setup();
      await loadAndEdit(user);
      surveyService.getSurvey.mockResolvedValue({ ...teammateSurvey(), updatedAt: 5000, updatedByName: 'Brian' });
      await user.click(screen.getByRole('button', { name: /save as draft/i }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /save and replace theirs/i }));
      await waitFor(() => expect(surveyService.updateSurvey).toHaveBeenCalledTimes(1));
      expect(surveyService.updateSurvey.mock.calls[0][1]).toMatchObject({ status: 'draft', updatedByName: 'Me' });
    });

    it('does not ask when nobody else saved (including after your own save)', async () => {
      const user = userEvent.setup();
      await loadAndEdit(user);
      // 1st save: the pre-save check sees the version we loaded (1000); after saving, the server timestamp is 7000
      surveyService.getSurvey
        .mockResolvedValueOnce({ ...teammateSurvey(), updatedAt: 1000 })
        .mockResolvedValueOnce({ ...teammateSurvey(), updatedAt: 7000, updatedByName: 'Me' })
        .mockResolvedValue({ ...teammateSurvey(), updatedAt: 7000, updatedByName: 'Me' });
      await user.click(screen.getByRole('button', { name: /save (as )?draft/i }));
      await waitFor(() => expect(surveyService.updateSurvey).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // 2nd save: our own earlier save moved the timestamp to 7000, which must NOT count as a teammate's change
      await user.type(screen.getByLabelText('Description'), '!');
      await user.click(screen.getByRole('button', { name: /save (as )?draft/i }));
      await waitFor(() => expect(surveyService.updateSurvey).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
