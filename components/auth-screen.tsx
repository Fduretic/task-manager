'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Brand, Icon } from './icon';
import { api } from '@/lib/client';
export function AuthScreen({ join = false }: { join?: boolean }) {
  const [token, setToken] = useState('');
  const [invitation, setInvitation] = useState<{
    email: string;
    inviter: string;
    existing: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (join) {
      const t = location.hash.slice(1);
      setToken(t);
      if (!t) {
        setError('Open the complete invitation link from your email.');
        return;
      }
      api('auth/invitation', 'POST', { token: t })
        .then(setInvitation)
        .catch((e) => setError(e.message));
    }
  }, [join]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (join)
        await api('auth/join', 'POST', {
          token,
          ...(!invitation?.existing ? { name: f.get('name'), password: f.get('password') } : {}),
        });
      else await api('auth/login', 'POST', { email: f.get('email'), password: f.get('password') });
      const pending = sessionStorage.getItem('pendingInvitation');
      if (!join && pending && /^[a-f0-9]{64}$/.test(pending)) {
        sessionStorage.removeItem('pendingInvitation');
        location.assign(`/join#${pending}`);
      } else location.assign('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow">A LITTLE STRUCTURE. A LOT OF POSSIBILITY.</span>
          <h1>
            Make room
            <br />
            for your best work<span>.</span>
          </h1>
          <p>
            From the first idea to the final detail.
            <br />
            One calm place to keep your team moving.
          </p>
          <div className="abstract-board" aria-hidden="true">
            <div>
              <span />
              <i />
              <i />
            </div>
            <div>
              <span />
              <i />
              <i />
              <i />
            </div>
            <div>
              <span />
              <i />
            </div>
            <b>
              <Icon name="check" size={24} />
            </b>
          </div>
        </div>
        <span className="story-footer">Your work, at your pace.</span>
      </section>
      <section className="auth-form-wrap">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">YOUR FOCUS STARTS HERE</span>
          <h2>{join ? 'Better, together.' : 'Welcome back.'}</h2>
          <p className="muted">
            {join
              ? invitation
                ? `${invitation.inviter} invited you to collaborate.`
                : 'Let’s get your workspace ready.'
              : 'Sign in to pick up where you left off.'}
          </p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            {join ? (
              invitation && (
                <>
                  <div className="invite-address">
                    <Icon name="users" />
                    {invitation.email}
                  </div>
                  {invitation.existing ? (
                    <p>
                      Already have an account?{' '}
                      <a
                        href="/login"
                        onClick={() => sessionStorage.setItem('pendingInvitation', token)}
                      >
                        Sign in with this email
                      </a>
                      , then accept your invitation.
                    </p>
                  ) : (
                    <>
                      <label>
                        Your name
                        <input
                          name="name"
                          autoComplete="name"
                          maxLength={80}
                          required
                          placeholder="Alex Morgan"
                        />
                      </label>
                      <label>
                        Create a password
                        <input
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          placeholder="At least 12 characters"
                        />
                      </label>
                    </>
                  )}
                </>
              )
            ) : (
              <>
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="you@company.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    placeholder="Enter your password"
                  />
                </label>
              </>
            )}
            <button className="button primary full" disabled={busy || (join && !invitation)}>
              {busy ? 'Please wait…' : join ? 'Accept invitation' : 'Sign in'}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="auth-note">
            <Icon name="lock" size={15} />
            <span>
              {join
                ? 'Your tasks are private until you share them.'
                : 'An invite-only space. Ask a teammate for an invitation.'}
            </span>
          </div>
        </div>
        <div className="auth-bottom">Less noise. More progress.</div>
      </section>
    </main>
  );
}
