export default function Loader({ label = 'Loading...', fullPage = false }) {
  return (
    <div className={`d-flex flex-column align-items-center justify-content-center text-secondary gap-2 ${fullPage ? 'min-vh-100' : 'py-5'}`}>
      <div className="spinner-border text-primary" role="status" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
