"use client";

import React from 'react';
import '@material/web/card/elevated-card';
import '@material/web/card/filled-card';
import '@material/web/card/outlined-card';

interface MaterialCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  children: React.ReactNode;
}

export const MaterialCard = React.forwardRef<HTMLDivElement, MaterialCardProps>(
  ({ variant = 'elevated', children, ...props }, ref) => {
    const Component = `md-${variant}-card` as any;

    return (
      <Component ref={ref} {...props}>
        {children}
      </Component>
    );
  }
);

MaterialCard.displayName = 'MaterialCard';
