/**
 * Type definitions for Material Web components
 * This file provides TypeScript support for @material/web custom elements
 */

declare namespace JSX {
  interface IntrinsicElements {
    'md-filled-button': MaterialButtonProps;
    'md-outlined-button': MaterialButtonProps;
    'md-text-button': MaterialButtonProps;
    'md-elevated-button': MaterialButtonProps;
    'md-tonal-button': MaterialButtonProps;
    'md-fab': MaterialFabProps;
    
    'md-elevated-card': MaterialCardProps;
    'md-filled-card': MaterialCardProps;
    'md-outlined-card': MaterialCardProps;
    
    'md-checkbox': MaterialCheckboxElementProps;
    'md-radio': MaterialRadioProps;
    'md-switch': MaterialSwitchProps;
    
    'md-filled-text-field': MaterialTextFieldProps;
    'md-outlined-text-field': MaterialTextFieldProps;
    
    'md-dialog': MaterialDialogProps;
    'md-menu': MaterialMenuProps;
    'md-menu-item': MaterialMenuItemProps;
  }

  interface MaterialButtonProps extends React.HTMLAttributes<HTMLElement> {
    disabled?: boolean;
    type?: 'submit' | 'button' | 'reset';
    trailingIcon?: boolean;
  }

  interface MaterialFabProps extends React.HTMLAttributes<HTMLElement> {
    variant?: 'surface' | 'primary' | 'secondary' | 'tertiary';
    size?: 'small' | 'normal' | 'large';
    lowered?: boolean;
  }

  interface MaterialCardProps extends React.HTMLAttributes<HTMLElement> {}

  interface MaterialCheckboxElementProps extends React.InputHTMLAttributes<HTMLElement> {
    indeterminate?: boolean;
    checked?: boolean;
  }

  interface MaterialRadioProps extends React.InputHTMLAttributes<HTMLElement> {
    checked?: boolean;
  }

  interface MaterialSwitchProps extends React.InputHTMLAttributes<HTMLElement> {
    selected?: boolean;
    icons?: boolean;
    showOnlySelectedIcon?: boolean;
  }

  interface MaterialTextFieldProps extends React.InputHTMLAttributes<HTMLElement> {
    label?: string;
    error?: boolean;
    required?: boolean;
    readonly?: boolean;
    maxLength?: number;
    type?: string;
    pattern?: string;
    inputMode?: 'decimal' | 'email' | 'none' | 'numeric' | 'search' | 'tel' | 'text' | 'url';
  }

  interface MaterialDialogProps extends React.HTMLAttributes<HTMLElement> {
    open?: boolean;
    returnValue?: string;
  }

  interface MaterialMenuProps extends React.HTMLAttributes<HTMLElement> {
    open?: boolean;
    positioning?: 'absolute' | 'fixed' | 'popover';
    anchor?: string | HTMLElement | null;
  }

  interface MaterialMenuItemProps extends React.HTMLAttributes<HTMLElement> {
    disabled?: boolean;
    selected?: boolean;
    type?: 'option' | 'checkbox' | 'radio';
  }
}

/**
 * Material Web component event handlers
 */
export interface MaterialButtonElement extends HTMLElement {
  disabled: boolean;
  type: 'button' | 'submit' | 'reset';
}

export interface MaterialCheckboxElement extends HTMLElement {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
}

export interface MaterialTextFieldElement extends HTMLElement {
  value: string;
  error: boolean;
  disabled: boolean;
  readonly: boolean;
}

export interface MaterialSelectElement extends HTMLElement {
  value: string;
  selectedIndex: number;
  disabled: boolean;
}

export interface MaterialDialogElement extends HTMLElement {
  open: boolean;
  returnValue: string;
  show(): void;
  close(returnValue?: string): void;
}

export interface MaterialMenuElement extends HTMLElement {
  open: boolean;
  show(): void;
  close(): void;
  anchor?: string | HTMLElement | null;
}

/**
 * Helper type for Material Web component event map
 */
export type MaterialWebEventMap = {
  'opening': CustomEvent;
  'opened': CustomEvent;
  'closing': CustomEvent;
  'closed': CustomEvent;
  'change': Event;
  'input': Event;
} & HTMLElementEventMap;
