import { Color } from './variants';

export const PALETTE: Record<Color, { band: string; text: string; cell: string }> = {
  red: { band: '#D9232E', text: '#C8102E', cell: '#FDECEC' },
  yellow: { band: '#F2C200', text: '#C29400', cell: '#FFF8DC' },
  green: { band: '#2E9D48', text: '#1F8A3A', cell: '#E8F5EA' },
  blue: { band: '#1F5AA6', text: '#1F5AA6', cell: '#E6EEF8' },
};

export const UI = {
  background: '#F4F1EA',
  sheet: '#FFFFFF',
  ink: '#1D1D1F',
  muted: '#8A8A8E',
  grey: '#B9B9BE',
  penalty: '#6E6E73',
};
