/** The green "email verified" tick shown beside a person's name. Renders nothing when not verified. */
export default function VerifiedTick({ verified, className = 'ms-1' }) {
  if (!verified) return null;
  return <i className={`bi bi-patch-check-fill sf-verified ${className}`} title="Email verified" role="img" aria-label="Email verified" />;
}
