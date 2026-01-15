"use client";

import React from 'react';
import '@material/web/dialog/dialog';

interface MaterialDialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
}

export const MaterialDialog = React.forwardRef<HTMLDivElement, MaterialDialogProps>(
  ({ open = false, onClose, onCancel, children, ...props }, ref) => {
    const dialogRef = React.useRef<any>(null);

    React.useEffect(() => {
      if (dialogRef.current) {
        if (open) {
          dialogRef.current.show();
        } else {
          dialogRef.current.close();
        }
      }
    }, [open]);

    return (
      <md-dialog
        ref={dialogRef || ref}
        onCancel={onCancel}
        onClose={onClose}
        {...props}
      >
        {children}
      </md-dialog>
    );
  }
);

MaterialDialog.displayName = 'MaterialDialog';
