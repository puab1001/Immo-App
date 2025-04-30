// src/hooks/useConfirmation.ts
import { useState, useCallback } from 'react';

interface UseConfirmationOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export function useConfirmation(options: UseConfirmationOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setIsOpen(true);
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef) {
      resolveRef(true);
      setIsOpen(false);
      setResolveRef(null);
    }
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    if (resolveRef) {
      resolveRef(false);
      setIsOpen(false);
      setResolveRef(null);
    }
  }, [resolveRef]);

  return {
    isOpen,
    confirm,
    handleConfirm,
    handleCancel,
    options,
  };
}