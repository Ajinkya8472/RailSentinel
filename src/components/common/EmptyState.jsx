import React from 'react';

export default function EmptyState({ title, description, illustration, className }) {
  const imgSrc = illustration ? `/assets/illustrations/${illustration}.svg` : '/assets/illustrations/empty-state.svg';

  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center h-full w-full rounded-xl border border-dashed border-border-subtle bg-surface-elevated/50 ${className || ''}`}>
      <img src={imgSrc} alt="Empty state" className="w-40 h-40 mb-6 opacity-70 mix-blend-screen" />
      <h3 className="text-lg font-bold text-white mb-2">{title || 'No records found'}</h3>
      <p className="text-sm text-text-secondary max-w-sm">
        {description || 'There is no data to display in this view.'}
      </p>
    </div>
  );
}
