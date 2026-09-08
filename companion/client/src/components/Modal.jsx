import { useEffect } from 'react';

export default function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {subtitle && (
          <p className="muted small" style={{ marginTop: 2, marginBottom: 16 }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
