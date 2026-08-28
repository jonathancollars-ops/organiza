import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getThemeColors, getContrastTextColor } from '../theme';
import { ThemeType } from '../types';

interface XPNotificationProps {
  visible: boolean;
  xpAmount: number;
  message?: string;
  isLevelUp?: boolean;
  theme: ThemeType;
  onHide: () => void;
}

export const XPNotification: React.FC<XPNotificationProps> = ({
  visible,
  xpAmount,
  message = 'XP Recebido!',
  isLevelUp = false,
  theme,
  onHide
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const colors = getThemeColors(theme);

  useEffect(() => {
    if (visible) {
      // Trigger haptics when it appears
      if (isLevelUp) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Slide In
      Animated.spring(slideAnim, {
        toValue: 50, // 50px from top
        useNativeDriver: true,
        bounciness: 12,
        speed: 14,
      }).start();

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -150, // hide back top
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, slideAnim, isLevelUp, onHide]);

  if (!visible) return null;

  const bgColor = isLevelUp ? colors.warning : colors.primary;
  const textColor = getContrastTextColor(bgColor);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          transform: [{ translateY: slideAnim }],
          shadowColor: bgColor,
        }
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={{ fontSize: 24 }}>{isLevelUp ? '🎉' : '✨'}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: textColor }]}>
          {isLevelUp ? 'Nível Alcançado!' : message}
        </Text>
        <Text style={[styles.xpText, { color: textColor }]}>
          +{xpAmount} XP
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100, // Pill shape
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
    minWidth: 200,
  },
  iconWrap: {
    marginRight: 10,
  },
  textWrap: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  xpText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  }
});
