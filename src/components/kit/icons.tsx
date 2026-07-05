/**
 * Icons — the v2 icon set (react-native-svg, added 2026-07-04 per Adam's call).
 * Paths ported VERBATIM from the web tab buttons + runway leaf (app.html inline
 * SVGs). Stroke-based, theme-aware via the color prop — replaces emoji chrome.
 */
import React from 'react';
import Svg, {Path, Rect} from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** Journal — the pen (web journalTabButton) */
export const PenIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Goals — the star (web manifestTabButton) */
export const StarIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Entries — the calendar (web calendarTabButton) */
export const CalendarIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x={3}
      y={5}
      width={18}
      height={16}
      rx={2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8 3v4M16 3v4M3 10h18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** The leaf — WISH runway progress (web wishProgressEmoji SVG) */
export const LeafIcon: React.FC<IconProps> = ({size = 14, color, strokeWidth = 2.2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21V10"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 10C12 6 9 4 5 4c0 4 3 6 7 6z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
