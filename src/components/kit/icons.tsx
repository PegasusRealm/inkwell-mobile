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

// ─── v2.0 (2026-10-01) phone UI icons: same stroke family as above ───
const S = (color: string, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

/** Entries tab: an open book */
export const BookIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5c3.5-2 6.5-2 9-1V19c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1V5.5z" {...S(color, strokeWidth)} />
    <Path d="M12 6.5V20" {...S(color, strokeWidth)} />
  </Svg>
);

/** Goals tab: a flag */
export const FlagIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 21V4M5 4h11l-2.2 4 2.2 4H5" {...S(color, strokeWidth)} />
  </Svg>
);

/** You tab: a person */
export const PersonIcon: React.FC<IconProps> = ({size = 22, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 12.3a3.8 3.8 0 100-7.6 3.8 3.8 0 000 7.6z" {...S(color, strokeWidth)} />
    <Path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" {...S(color, strokeWidth)} />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({size = 18, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" {...S(color, strokeWidth)} />
  </Svg>
);

export const MicIcon: React.FC<IconProps> = ({size = 20, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={3} width={6} height={11} rx={3} {...S(color, strokeWidth)} />
    <Path d="M5 11a7 7 0 0014 0M12 18v3" {...S(color, strokeWidth)} />
  </Svg>
);

export const TagIcon: React.FC<IconProps> = ({size = 20, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 12V4h8l10 10-8 8L3 12z" {...S(color, strokeWidth)} />
    <Path d="M7.5 8.8a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6z" {...S(color, strokeWidth)} />
  </Svg>
);

export const PhotoIcon: React.FC<IconProps> = ({size = 20, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={5} width={18} height={14} rx={2.5} {...S(color, strokeWidth)} />
    <Path d="M9 11.8a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM21 16l-5-5-9 8" {...S(color, strokeWidth)} />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({size = 16, color, strokeWidth = 2.6}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" {...S(color, strokeWidth)} />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({size = 18, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 6l6 6-6 6" {...S(color, strokeWidth)} />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({size = 18, color, strokeWidth = 2}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 6l-6 6 6 6" {...S(color, strokeWidth)} />
  </Svg>
);

/** Timed write (Sprint folded into the page, 2026-10-01) */
export const TimerIcon: React.FC<IconProps> = ({size = 20, color, strokeWidth = 1.9}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 13.5a8 8 0 11-16 0 8 8 0 0116 0z" {...S(color, strokeWidth)} />
    <Path d="M12 9.5v4l2.5 2M9.5 2.5h5" {...S(color, strokeWidth)} />
  </Svg>
);
