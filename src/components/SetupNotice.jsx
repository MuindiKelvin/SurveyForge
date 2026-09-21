export default function SetupNotice() {
  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <div className="card border-warning shadow-sm">
        <div className="card-body p-4">
          <h1 className="h4 d-flex align-items-center gap-2">
            <i className="bi bi-gear-wide-connected text-warning" aria-hidden="true" />
            Connect your Firebase project
          </h1>
          <p>
            SurveyForge is running, but it does not have your Firebase settings yet. Do this once:
          </p>
          <ol className="mb-3">
            <li>
              Copy <code>.env.example</code> to <code>.env</code> in the project folder.
            </li>
            <li>
              Open <strong>Firebase console &rarr; Project settings &rarr; Your apps &rarr; Web app</strong> and copy the
              config values into <code>.env</code>.
            </li>
            <li>
              Stop the dev server and start it again with <code>npm run dev</code>.
            </li>
          </ol>
          <p className="text-secondary mb-0">The README has the full step-by-step guide, including enabling sign-in and the database.</p>
        </div>
      </div>
    </div>
  );
}
