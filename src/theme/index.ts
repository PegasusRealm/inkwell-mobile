/**
 * InkWell Theme - Central Export
 * Import this file to access all theme values
 */

export { colors } from './colors';
export { 
  typography, 
  fontFamily, 
  fontSize, 
  lineHeight, 
  letterSpacing, 
  textStyles 
} from './typography';
export { spacing, borderRadius } from './spacing';

// Convenience combined export
export const theme = {
  colors: require('./colors').colors,
  typography: require('./typography').typography,
  fontFamily: require('./typography').fontFamily,
  fontSize: require('./typography').fontSize,
  textStyles: require('./typography').textStyles,
  spacing: require('./spacing').spacing,
  borderRadius: require('./spacing').borderRadius,
};
