import React, { useEffect } from 'react';
import { useT } from '../../i18n/LanguageContext';
import logoHeader from '../../media/logo-header.png';

/**
 * Eye-catching welcome overlay shown once right after login.
 * Brand gradient (blue → teal), animated entrance, brief intro to the
 * static / dynamic simulation modes, and a single call-to-action.
 */
export default function WelcomeOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="adinf-fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 30, 55, 0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="adinf-pop-in w-full overflow-hidden"
        style={{
          maxWidth: '560px',
          background: 'var(--color-surface)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header with logo */}
        <div
          className="px-8 py-9 text-center"
          style={{
            background:
              'linear-gradient(135deg, #1a539a 0%, #3581b9 55%, #5eb8d1 100%)',
          }}
        >
          <div className="adinf-float inline-flex bg-white rounded-xl px-5 py-3 shadow-lg">
            <img src={logoHeader} alt="AD-INFINITUM" style={{ height: '48px', width: 'auto' }} />
          </div>
          <h2 className="mt-5 text-3xl font-bold text-white tracking-wide">
            {t('welcome_title')}
          </h2>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          <p
            className="text-center text-base leading-relaxed"
            style={{ color: 'var(--color-text)' }}
          >
            {t('welcome_message')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <FeatureCard
              accent="var(--color-primary)"
              title={t('welcome_static_title')}
              desc={t('welcome_static_desc')}
              icon={
                <path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v2H4V5zm0 4h12v6a1 1 0 01-1 1H5a1 1 0 01-1-1V9z" />
              }
            />
            <FeatureCard
              accent="var(--color-accent)"
              title={t('welcome_dynamic_title')}
              desc={t('welcome_dynamic_desc')}
              icon={
                <path
                  fillRule="evenodd"
                  d="M3 10a1 1 0 011-1h2l2-4 3 8 2-5 2 2h2a1 1 0 110 2h-2.5l-2.8-2.8L11 16 8 8l-1.3 3H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              }
            />
          </div>

          <button
            className="btn btn-primary w-full justify-center mt-7"
            style={{ fontSize: '0.95rem', padding: '0.7rem' }}
            onClick={onClose}
            autoFocus
          >
            {t('welcome_cta')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  accent,
  title,
  desc,
  icon,
}: {
  accent: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-flex items-center justify-center rounded-md"
          style={{ width: '28px', height: '28px', background: accent }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="white"
          >
            {icon}
          </svg>
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </span>
      </div>
      <p className="text-xs leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
        {desc}
      </p>
    </div>
  );
}
