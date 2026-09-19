import React, { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export const Toast = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      data-testid="toast"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#4b6b3a] text-[#f7efd8] px-4 py-2 shadow-lg text-sm animate-in fade-in"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 size={16} />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
