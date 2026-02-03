/**
 * InkWell Info Modal
 * Reusable modal for displaying educational content about features
 * 
 * Created 2026-01-29: Matches web info modals for Gratitude, InkBlot, etc.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { spacing, borderRadius, fontFamily, fontSize } from '../theme';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerText?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footerText,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContainer}>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>{title}</Text>
              {subtitle && (
                <Text style={styles.subtitle}>{subtitle}</Text>
              )}
              
              <View style={styles.contentContainer}>
                {children}
              </View>
              
              {footerText && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.footerText}>{footerText}</Text>
                </>
              )}
            </ScrollView>
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Subcomponents for structured content
export const InfoSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{
        fontSize: 16,
        fontWeight: '600',
        color: colors.brandPrimary,
        marginBottom: 8,
      }}>{title}</Text>
      {children}
    </View>
  );
};

export const InfoHighlightBox: React.FC<{
  title: string;
  emoji?: string;
  children: React.ReactNode;
}> = ({ title, emoji, children }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(42, 105, 114, 0.15)' : 'rgba(42, 105, 114, 0.08)',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    }}>
      <Text style={{
        fontSize: 15,
        fontWeight: '600',
        color: colors.brandPrimary,
        marginBottom: 4,
      }}>{emoji ? `${emoji} ` : ''}{title}</Text>
      <Text style={{
        fontSize: 14,
        color: colors.fontMain,
        lineHeight: 20,
      }}>{children}</Text>
    </View>
  );
};

export const InfoParagraph: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { colors } = useTheme();
  return (
    <Text style={{
      fontSize: 14,
      color: colors.fontMain,
      lineHeight: 21,
      marginVertical: 6,
    }}>{children}</Text>
  );
};

export const InfoDivider: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={{
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 16,
    }} />
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  scrollView: {
    maxHeight: '100%',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.fontSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
    color: colors.brandPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  closeButton: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.fontWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InfoModal;
