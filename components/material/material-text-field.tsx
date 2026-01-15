"use client";

import React from 'react';
import '@material/web/textfield/filled-text-field';
import '@material/web/textfield/outlined-text-field';

interface MaterialTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'filled' | 'outlined';
  label?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
}

export const MaterialTextField = React.forwardRef<HTMLDivElement, MaterialTextFieldProps>(
  ({ 
    variant = 'filled', 
    label, 
    leadingIcon,
    trailingIcon,
    supportingText,
    error,
    errorText,
    ...props 
  }, ref) => {
    const Component = `md-${variant}-text-field` as any;

    return (
      <Component
        ref={ref}
        label={label}
        error={error}
        {...props}
      >
        {leadingIcon && <div slot="leading-icon">{leadingIcon}</div>}
        {trailingIcon && <div slot="trailing-icon">{trailingIcon}</div>}
        {(supportingText || errorText) && (
          <div slot="supporting-text">
            {errorText || supportingText}
          </div>
        )}
      </Component>
    );
  }
);

MaterialTextField.displayName = 'MaterialTextField';
