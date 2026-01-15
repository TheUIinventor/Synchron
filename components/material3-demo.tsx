"use client";

/**
 * Material 3 Expressive Demo Component
 * 
 * This demonstrates all Material Web components with expressive styling.
 * Use this as a reference or starting point for your own components.
 */

import React, { useState } from 'react';
import {
  MaterialButton,
  MaterialCard,
  MaterialCheckbox,
  MaterialTextField,
  MaterialDialog,
} from '@/components/material';
import { useTheme } from '@/contexts/ThemeContext';
import {
  M3_SHAPES,
  M3_DURATIONS,
  M3_EASING,
  createM3Transition,
} from '@/utils/material3-utils';

export function Material3Demo() {
  const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedColor, setSelectedColor] = useState(sourceColor);

  const colorOptions = [
    { name: 'Purple', hex: '#6750A4' },
    { name: 'Blue', hex: '#0066CC' },
    { name: 'Green', hex: '#2E8B57' },
    { name: 'Red', hex: '#DC3545' },
    { name: 'Pink', hex: '#E91E63' },
    { name: 'Teal', hex: '#008B8B' },
  ];

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        backgroundColor: 'var(--md-sys-color-surface)',
        color: 'var(--md-sys-color-on-surface)',
        minHeight: '100vh',
        transition: createM3Transition(M3_DURATIONS.MEDIUM2, M3_EASING.STANDARD),
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700' }}>
          Material 3 Expressive Demo
        </h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Explore all Material Web components with expressive design
        </p>
      </div>

      {/* Theme Controls */}
      <MaterialCard variant="elevated" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Theme Controls</h2>

          {/* Dark Mode Toggle */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span>Dark Mode:</span>
            <MaterialButton
              variant={isDark ? 'filled' : 'outlined'}
              label={isDark ? 'ON' : 'OFF'}
              onClick={() => setIsDark(!isDark)}
            />
          </div>

          {/* Color Selector */}
          <div style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 12px 0' }}>Primary Color:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {colorOptions.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => {
                    setSourceColor(color.hex);
                    setSelectedColor(color.hex);
                  }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: M3_SHAPES.MEDIUM,
                    backgroundColor: color.hex,
                    border: selectedColor === color.hex ? '3px solid var(--md-sys-color-on-surface)' : 'none',
                    cursor: 'pointer',
                    transition: createM3Transition(M3_DURATIONS.SHORT2),
                    transform: selectedColor === color.hex ? 'scale(1.1)' : 'scale(1)',
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Current Color Info */}
          <div style={{ opacity: 0.8, fontSize: '14px' }}>
            Current color: <code>{sourceColor}</code> ({isDark ? 'Dark' : 'Light'} mode)
          </div>
        </div>
      </MaterialCard>

      {/* Buttons Demo */}
      <MaterialCard variant="elevated" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Button Variants</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="filled" label="Filled" />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Default</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="outlined" label="Outlined" />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Secondary</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="text" label="Text" />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Tertiary</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="elevated" label="Elevated" />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>With elevation</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="tonal" label="Tonal" />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Container</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <MaterialButton variant="filled" label="Disabled" disabled />
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Disabled state</p>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: M3_SHAPES.MEDIUM }}>
            <p style={{ margin: 0, fontSize: '12px' }}>
              ✨ All buttons use <strong>16px corner radius</strong> (medium) for consistent expressive styling.
            </p>
          </div>
        </div>
      </MaterialCard>

      {/* Cards Demo */}
      <MaterialCard variant="elevated" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Card Variants</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <MaterialCard variant="elevated">
              <div style={{ padding: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>Elevated Card</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.8 }}>
                  Has elevation and uses the standard surface color.
                </p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>
                  Corner radius: <code>{M3_SHAPES.LARGE}</code>
                </p>
              </div>
            </MaterialCard>

            <MaterialCard variant="outlined">
              <div style={{ padding: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>Outlined Card</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.8 }}>
                  Has a visible border instead of shadow.
                </p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>
                  Corner radius: <code>{M3_SHAPES.LARGE}</code>
                </p>
              </div>
            </MaterialCard>

            <MaterialCard variant="filled">
              <div style={{ padding: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>Filled Card</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.8 }}>
                  Uses a filled surface container color.
                </p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>
                  Corner radius: <code>{M3_SHAPES.LARGE}</code>
                </p>
              </div>
            </MaterialCard>
          </div>
        </div>
      </MaterialCard>

      {/* Form Elements Demo */}
      <MaterialCard variant="elevated" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Form Elements</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MaterialTextField
              variant="filled"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail((e.target as any).value)}
            />

            <MaterialTextField
              variant="outlined"
              label="Password"
              type="password"
              supportingText="At least 8 characters"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MaterialCheckbox
                checked={checked}
                onChange={(e) => setChecked((e.target as any).checked)}
              />
              <label style={{ cursor: 'pointer' }}>I agree to the terms and conditions</label>
            </div>
          </div>
        </div>
      </MaterialCard>

      {/* Dialog Demo */}
      <MaterialCard variant="elevated" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Dialog Demo</h2>

          <MaterialButton
            variant="filled"
            label="Open Dialog"
            onClick={() => setShowDialog(true)}
          />

          <MaterialDialog open={showDialog} onClose={() => setShowDialog(false)}>
            <div style={{ padding: '24px', minWidth: '320px' }}>
              <h2 style={{ margin: '0 0 12px 0' }}>Dialog Title</h2>
              <p style={{ margin: '0 0 20px 0', opacity: 0.8 }}>
                This is a Material 3 Expressive dialog with <strong>{M3_SHAPES.EXTRA_LARGE}</strong> corner
                radius for maximum expressiveness.
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <MaterialButton
                  variant="text"
                  label="Cancel"
                  onClick={() => setShowDialog(false)}
                />
                <MaterialButton
                  variant="filled"
                  label="Confirm"
                  onClick={() => setShowDialog(false)}
                />
              </div>
            </div>
          </MaterialDialog>
        </div>
      </MaterialCard>

      {/* Design Tokens Reference */}
      <MaterialCard variant="outlined">
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Design Tokens Reference</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
            <div>
              <strong>Shapes (Expressive)</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                <li>Extra-large: {M3_SHAPES.EXTRA_LARGE}</li>
                <li>Large: {M3_SHAPES.LARGE}</li>
                <li>Medium: {M3_SHAPES.MEDIUM}</li>
                <li>Small: {M3_SHAPES.SMALL}</li>
              </ul>
            </div>

            <div>
              <strong>Motion Durations</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                <li>Short: {M3_DURATIONS.SHORT2}</li>
                <li>Medium: {M3_DURATIONS.MEDIUM2}</li>
                <li>Long: {M3_DURATIONS.LONG2}</li>
                <li>Extra-long: {M3_DURATIONS.EXTRA_LONG2}</li>
              </ul>
            </div>

            <div>
              <strong>Easing</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                <li>Emphasized</li>
                <li>Standard</li>
                <li>Decelerate</li>
                <li>Accelerate</li>
              </ul>
            </div>
          </div>
        </div>
      </MaterialCard>
    </div>
  );
}

export default Material3Demo;
