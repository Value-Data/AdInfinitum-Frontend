import React from 'react';

/**
 * Small info icon with a native-title tooltip. Customer-facing help text.
 * Shared by the static and dynamic config editors.
 */
export default function Tip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 cursor-help select-none align-middle"
      style={{ color: 'var(--color-text-secondary)', fontSize: '0.75em' }}
      title={text}
      aria-label={text}
    >
      &#9432;
    </span>
  );
}
