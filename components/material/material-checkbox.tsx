"use client";

import React from 'react';
import '@material/web/checkbox/checkbox';

interface MaterialCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  indeterminate?: boolean;
}

export const MaterialCheckbox = React.forwardRef<HTMLDivElement, MaterialCheckboxProps>(
  ({ label, indeterminate, ...props }, ref) => {
    const checkboxRef = React.useRef<any>(null);

    React.useEffect(() => {
      if (checkboxRef.current && indeterminate !== undefined) {
        checkboxRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <div ref={ref}>
        <md-checkbox {...props} ref={checkboxRef} />
        {label && <label>{label}</label>}
      </div>
    );
  }
);

MaterialCheckbox.displayName = 'MaterialCheckbox';
