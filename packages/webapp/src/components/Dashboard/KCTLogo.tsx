import React from 'react';

/**
 * KCT Financials sidebar wordmark.
 * Renders on the navy sidebar background (#1B3A6B).
 */
export function KCTLogo() {
  return (
    <div className="sidebar__logo">
      <svg
        width="148"
        height="40"
        viewBox="0 0 148 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="KCT Financials"
      >
        {/* Amber diamond mark */}
        <polygon points="10,4 18,12 10,20 2,12" fill="#E8A020" />
        <polygon points="10,8 14,12 10,16 6,12" fill="#1B3A6B" />

        {/* KCT wordmark */}
        <text
          x="26"
          y="17"
          fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
          fontSize="16"
          fontWeight="700"
          letterSpacing="1.5"
          fill="#FFFFFF"
        >
          KCT
        </text>

        {/* Financials tagline */}
        <text
          x="27"
          y="30"
          fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
          fontSize="8"
          fontWeight="400"
          letterSpacing="2.5"
          fill="rgba(255,255,255,0.55)"
        >
          FINANCIALS
        </text>
      </svg>
    </div>
  );
}
