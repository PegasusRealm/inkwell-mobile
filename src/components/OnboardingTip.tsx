/**
 * OnboardingTip - Simple modal tip component for progressive onboarding
 * 
 * Design principles:
 * - Non-blocking (always has dismiss option)
 * - Value-focused (short, benefit-oriented messages)
 * - Branded (uses InkWell theme colors)
 * - Accessible (proper contrast, readable sizes)
 */

import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

interface OnboardingTipProps {
  visible: boolean;
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onDismiss: () => void;
  onAction?: () => void;
}

const OnboardingTip: React.FC<OnboardingTipProps> = ({
  visible,
  icon,
  title,
  message,
  actionLabel = 'Got it!',
  onDismiss,
  onAction,
}) => {
  const {colors} = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          },
        ]}
      >
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={onDismiss}
        />
        
        <Animated.View
          style={[
            styles.modal,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.borderLight,
              transform: [{translateY: slideAnim}],
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Text style={[styles.closeIcon, {color: colors.fontMuted}]}>×</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconContainer, {backgroundColor: colors.bgMuted}]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, {color: colors.fontMain}]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, {color: colors.fontSecondary}]}>
            {message}
          </Text>

          {/* Action button */}
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.brandPrimary}]}
            onPress={handleAction}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const {width} = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    width: width - 48,
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 160,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingTip;
