'use client';

import type { AppBarProps } from '@mui/material';
import { AppBar, Link } from '@mui/material';
import type { Breakpoint } from '@mui/material/styles';
import { styled } from '@mui/material/styles';

interface NavbarContainerProps extends AppBarProps {
  hasBlurredNavigation?: boolean;
}

export const NavbarContainer = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'hasBlurredNavigation',
})<NavbarContainerProps>(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  backdropFilter: 'blur(12px)',
  boxShadow: 'unset',
  background: 'transparent',
  alignItems: 'center',
  height: 48,
  padding: theme.spacing(1, 2),
  zIndex: 1300,
  [theme.breakpoints.up('sm' as Breakpoint)]: {
    height: 72,
    padding: theme.spacing(2, 3),
  },
  [theme.breakpoints.up('md' as Breakpoint)]: {
    padding: theme.spacing(3),
    height: 80,
  },
  variants: [
    {
      props: ({ hasBlurredNavigation }) => !hasBlurredNavigation,
      style: {
        backdropFilter: 'blur(12px)',
      },
    },
  ],
}));

export const LogoLinkWrapper = styled(Link)(() => ({
  cursor: 'pointer',
  display: 'flex',
  height: '32px',
  alignContent: 'center',
}));
