"use client";

import React from 'react';
import '@material/web/button/filled-button';
import '@material/web/button/outlined-button';
import '@material/web/button/text-button';
import '@material/web/button/elevated-button';
import '@material/web/button/tonal-button';

interface MaterialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal';
  label: string;
  icon?: React.ReactNode;
  trailingIcon?: boolean;
  disabled?: boolean;
}

export const MaterialButton = React.forwardRef<HTMLButtonElement, MaterialButtonProps>(
  ({ 
    variant = 'filled', 
    label, 
    icon,
    trailingIcon,
    disabled,
    children,
    ...props 
  }, ref) => {
    const Component = `md-${variant}-button` as any;

    return (
      <Component
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {icon && !trailingIcon && icon}
        {label || children}
        {trailingIcon && icon}
      </Component>
    );
  }
);

MaterialButton.displayName = 'MaterialButton';
