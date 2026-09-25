import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDialog.css';

function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel
}) {
    const cancelButtonRef = useRef(null);
    const onCancelRef = useRef(onCancel);

    useEffect(() => {
        onCancelRef.current = onCancel;
    });

    useEffect(() => {
        if (!open) return undefined;

        cancelButtonRef.current?.focus();

        const handleKey = (e) => {
            if (e.key === 'Escape') onCancelRef.current();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div className="cd-backdrop" onClick={onCancel}>
            <div
                className="cd-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="cd-title"
                aria-describedby={message ? 'cd-message' : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="cd-title" className="cd-title">{title}</h2>
                {message && <p id="cd-message" className="cd-message">{message}</p>}

                <div className="cd-actions">
                    <button ref={cancelButtonRef} type="button" className="cd-btn" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`cd-btn cd-btn-primary${danger ? ' is-danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmDialog;