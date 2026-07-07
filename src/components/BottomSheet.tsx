"use client";

export function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        data-testid="sheet-backdrop"
        className="sheet-backdrop absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="sheet-panel absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[1.75rem] border-t-4 border-court bg-white px-5 pb-9 pt-3 shadow-[0_-12px_40px_-12px_rgba(20,83,45,0.25)]">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-gray-200" />
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-court">{title}</h2>
        {children}
      </div>
    </div>
  );
}
