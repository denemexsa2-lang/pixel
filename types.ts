import React from 'react';

export interface GameMode {
  id: string;
  name: string;
  type: string;
  map: string;
  players: number;
  maxPlayers: number;
  timeLeft: number; // in seconds
  imageUrl: string;
}

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}