import React from "react";
import { AlertTriangle } from "lucide-react";

export const ConfirmDialog = ({ open, title, message, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div
      data-testid="confirm-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-[#3b2411]/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-xl bg-[#fbf4e0] border border-[#d9c9a5] p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2d4c4] text-[#993a1c]">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <h3
              className="font-serif text-xl text-[#3b2411]"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              {title}
            </h3>
            <p className="mt-1 text-sm text-[#4a3620]">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            data-testid="btn-cancel-delete"
            onClick={onCancel}
            className="rounded-md bg-[#efe2c1] hover:bg-[#e2d09b] text-[#7a4b1c] px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="btn-confirm-delete"
            onClick={onConfirm}
            className="rounded-md bg-[#993a1c] hover:bg-[#7a2d13] text-[#fdf9ec] px-4 py-2 text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
