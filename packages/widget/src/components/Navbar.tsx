"use client";

import React, { useState } from 'react';
import Link from 'next/link';
// import { Logo } from './components/Logo/Logo';
import {
  NavbarContainer,
  LogoLinkWrapper,
} from './Navbar.style';
import { useWalletMenu } from '@lifi/wallet-management';
// import { useWalletMenu } from '@lifi/wallet-management';

/**
 * TempNavbar
 * A simplified, static-only navbar used for testing/design purposes.
 * - Renders a logo linking to `/`
 * - Shows static nav items
 * - Has a Connect button that toggles a mocked connected address
 */
export const TempNavbar: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const { openWalletMenu } = useWalletMenu();

  const navItems = [];

  return (
    <NavbarContainer enableColorOnDark hasBlurredNavigation={false}>
      <LogoLinkWrapper href="/" id="temp-jumper-logo">
        {/* <Logo variant="default" /> */}
        <div>Hello</div>
      </LogoLinkWrapper>

      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {navItems.map((it) => (
          <Link key={it.href} href={it.href} style={{ textDecoration: 'none' }}>
            <span style={{ opacity: 0.95 }}>{it.label}</span>
          </Link>
        ))}

        <button
          id="temp-connect-button"
          onClick={(event) => {
        event.stopPropagation();
        openWalletMenu();
      }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: connected ? 'rgba(255,255,255,0.06)' : 'transparent',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          {connected ? address ?? 'Connected' : 'Connect'}
        </button>
      </nav>
    </NavbarContainer>
  );
};

export default TempNavbar;
