'use client';

import React, { useState } from 'react';

interface ReportModalProps {
  isOpen: boolean;
  questionText: string;
  kind?: 'MCQ' | 'Ratta';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function ReportModal({
  isOpen,
  questionText,
  kind = 'MCQ',
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setReason('');
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">Report Question Issue</h3>
        <p className="sub mb-3">Help us keep question content accurate and error-free.</p>

        <div className="p-3 bg-[var(--bg)] rounded-lg mb-3 border border-[var(--line)]">
          <span className="badge mb-1">{kind}</span>
          <div className="font-medium text-sm text-[var(--ink)] line-clamp-2">{questionText}</div>
        </div>

        {submitted ? (
          <div className="p-4 bg-[var(--pri2)] text-[var(--pri)] rounded-xl font-bold text-center">
            ✓ Report submitted to admins. Thank you!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--mut)] mb-1">
                Reason for report:
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Wrong answer marked in key, typo in option C, outdated syllabus..."
                className="w-full"
                required
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={onClose} className="b">
                Cancel
              </button>
              <button type="submit" className="b p">
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
