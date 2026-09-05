import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemeType } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';

export interface ClockTimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (timeStr: string, totalMinutes: number) => void;
  initialTime?: string; // "HH:mm"
  title?: string;
  theme: ThemeType;
}

type PickerMode = 'hours' | 'minutes';

const CLOCK_SIZE = 260;
const CENTER = CLOCK_SIZE / 2;
const OUTER_RADIUS = 94;
const INNER_RADIUS = 58;
const NUMBER_SIZE = 34;

const PRESETS = ['08:00', '10:00', '14:00', '19:00', '21:00'];

export const ClockTimePickerModal: React.FC<ClockTimePickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialTime = '08:00',
  title = 'Selecionar Horário',
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [mode, setMode] = useState<PickerMode>('hours');
  const [selectedHour, setSelectedHour] = useState<number>(8);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  // Initialize from initialTime
  useEffect(() => {
    if (visible && initialTime && initialTime.includes(':')) {
      const [h, m] = initialTime.split(':').map(Number);
      setSelectedHour(Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8);
      setSelectedMinute(Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0);
      setMode('hours');
    }
  }, [visible, initialTime]);

  const handleHourSelect = useCallback((hour: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHour(hour);
    // Auto-switch to minutes mode for seamless UX
    setTimeout(() => {
      setMode('minutes');
    }, 220);
  }, []);

  const handleMinuteSelect = useCallback((minute: number) => {
    Haptics.selectionAsync();
    setSelectedMinute(minute);
  }, []);

  const handlePresetSelect = useCallback((preset: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const [h, m] = preset.split(':').map(Number);
    setSelectedHour(h);
    setSelectedMinute(m);
  }, []);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hStr = selectedHour.toString().padStart(2, '0');
    const mStr = selectedMinute.toString().padStart(2, '0');
    const totalMinutes = selectedHour * 60 + selectedMinute;
    onConfirm(`${hStr}:${mStr}`, totalMinutes);
    onClose();
  }, [selectedHour, selectedMinute, onConfirm, onClose]);

  // Calculate pointer angle and length
  const pointerProps = useMemo(() => {
    if (mode === 'hours') {
      const isInner = selectedHour === 0 || selectedHour >= 13;
      const hour12 = selectedHour % 12;
      const angle = hour12 * 30; // 360 / 12 = 30 deg
      const length = isInner ? INNER_RADIUS : OUTER_RADIUS;
      return { angle, length };
    } else {
      const angle = selectedMinute * 6; // 360 / 60 = 6 deg
      return { angle, length: OUTER_RADIUS };
    }
  }, [mode, selectedHour, selectedMinute]);

  // Render hour numbers (Outer: 1..12, Inner: 13..23, 00)
  const renderHourNumbers = () => {
    const hours = [];

    // Outer circle: 1 to 12
    for (let h = 1; h <= 12; h++) {
      const angleRad = (h * 30 * Math.PI) / 180;
      const x = CENTER + OUTER_RADIUS * Math.sin(angleRad) - NUMBER_SIZE / 2;
      const y = CENTER - OUTER_RADIUS * Math.cos(angleRad) - NUMBER_SIZE / 2;
      const isSelected = selectedHour === h;

      hours.push(
        <TouchableOpacity
          key={`h-out-${h}`}
          style={[
            styles.numberButton,
            { left: x, top: y },
            isSelected && { backgroundColor: colors.primary }
          ]}
          onPress={() => handleHourSelect(h)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${h} horas`}
        >
          <Text
            style={[
              styles.numberText,
              { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
            ]}
          >
            {h}
          </Text>
        </TouchableOpacity>
      );
    }

    // Inner circle: 13 to 23, and 00
    for (let h = 13; h <= 24; h++) {
      const actualHour = h === 24 ? 0 : h;
      const angleRad = ((actualHour % 12) * 30 * Math.PI) / 180;
      const x = CENTER + INNER_RADIUS * Math.sin(angleRad) - NUMBER_SIZE / 2;
      const y = CENTER - INNER_RADIUS * Math.cos(angleRad) - NUMBER_SIZE / 2;
      const isSelected = selectedHour === actualHour;

      hours.push(
        <TouchableOpacity
          key={`h-in-${actualHour}`}
          style={[
            styles.numberButtonInner,
            { left: x, top: y },
            isSelected && { backgroundColor: colors.primary }
          ]}
          onPress={() => handleHourSelect(actualHour)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${actualHour} horas`}
        >
          <Text
            style={[
              styles.numberTextInner,
              { color: isSelected ? getContrastTextColor(colors.primary) : colors.textSecondary }
            ]}
          >
            {actualHour === 0 ? '00' : actualHour}
          </Text>
        </TouchableOpacity>
      );
    }

    return hours;
  };

  // Render minute numbers (every 5 minutes: 00, 05, 10, ..., 55)
  const renderMinuteNumbers = () => {
    const minutes = [];
    for (let m = 0; m < 60; m += 5) {
      const angleRad = (m * 6 * Math.PI) / 180;
      const x = CENTER + OUTER_RADIUS * Math.sin(angleRad) - NUMBER_SIZE / 2;
      const y = CENTER - OUTER_RADIUS * Math.cos(angleRad) - NUMBER_SIZE / 2;
      const isSelected = selectedMinute === m;

      minutes.push(
        <TouchableOpacity
          key={`m-${m}`}
          style={[
            styles.numberButton,
            { left: x, top: y },
            isSelected && { backgroundColor: colors.primary }
          ]}
          onPress={() => handleMinuteSelect(m)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${m} minutos`}
        >
          <Text
            style={[
              styles.numberText,
              { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
            ]}
          >
            {m.toString().padStart(2, '0')}
          </Text>
        </TouchableOpacity>
      );
    }
    return minutes;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Large Digital Display Header */}
          <View style={styles.digitalRow}>
            <TouchableOpacity
              style={[
                styles.digitBox,
                mode === 'hours'
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setMode('hours');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Configurar horas"
            >
              <Text
                style={[
                  styles.digitText,
                  {
                    color:
                      mode === 'hours'
                        ? getContrastTextColor(colors.primary)
                        : colors.text
                  }
                ]}
              >
                {selectedHour.toString().padStart(2, '0')}
              </Text>
              <Text
                style={[
                  styles.digitSub,
                  {
                    color:
                      mode === 'hours'
                        ? getContrastTextColor(colors.primary)
                        : colors.textSecondary
                  }
                ]}
              >
                HORAS
              </Text>
            </TouchableOpacity>

            <Text style={[styles.colonText, { color: colors.textSecondary }]}>:</Text>

            <TouchableOpacity
              style={[
                styles.digitBox,
                mode === 'minutes'
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setMode('minutes');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Configurar minutos"
            >
              <Text
                style={[
                  styles.digitText,
                  {
                    color:
                      mode === 'minutes'
                        ? getContrastTextColor(colors.primary)
                        : colors.text
                  }
                ]}
              >
                {selectedMinute.toString().padStart(2, '0')}
              </Text>
              <Text
                style={[
                  styles.digitSub,
                  {
                    color:
                      mode === 'minutes'
                        ? getContrastTextColor(colors.primary)
                        : colors.textSecondary
                  }
                ]}
              >
                MIN
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode Explanatory Subtitle */}
          <Text style={[styles.modeSubtitle, { color: colors.textSecondary }]}>
            {mode === 'hours' ? 'Toque no relógio para definir a hora' : 'Toque no relógio para definir os minutos'}
          </Text>

          {/* Interactive Radial Clock Face */}
          <View style={[styles.clockFace, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            {/* Center Hub Pivot */}
            <View style={[styles.centerHub, { backgroundColor: colors.primary }]} />

            {/* Rotating Pointer Hand */}
            <View
              style={[
                styles.pointerContainer,
                {
                  transform: [{ rotate: `${pointerProps.angle}deg` }],
                }
              ]}
            >
              {/* Pointer Needle */}
              <View
                style={[
                  styles.pointerNeedle,
                  {
                    height: pointerProps.length,
                    backgroundColor: colors.primary,
                  }
                ]}
              />
              {/* Target Endpoint Circle Indicator */}
              <View
                style={[
                  styles.pointerEndpoint,
                  {
                    bottom: pointerProps.length - 17,
                    backgroundColor: colors.primary,
                  }
                ]}
              />
            </View>

            {/* Numbers on the dial */}
            {mode === 'hours' ? renderHourNumbers() : renderMinuteNumbers()}
          </View>

          {/* Minute Micro-Adjuster Buttons when in minutes mode */}
          {mode === 'minutes' && (
            <View style={styles.minuteAdjustRow}>
              <TouchableOpacity
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedMinute(prev => (prev - 1 + 60) % 60);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: colors.text }]}>- 1 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedMinute(prev => (prev + 1) % 60);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: colors.text }]}>+ 1 min</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Presets Bar */}
          <View style={styles.presetsSection}>
            <Text style={[styles.presetsTitle, { color: colors.textSecondary }]}>Atalhos rápidos:</Text>
            <View style={styles.presetsRow}>
              {PRESETS.map(preset => {
                const currentFormatted = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
                const isSelected = currentFormatted === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                        borderColor: isSelected ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => handlePresetSelect(preset)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: isSelected ? getContrastTextColor(colors.primary) : colors.text }
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons: Cancelar / Confirmar */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancelar seleção de horário"
            >
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Confirmar horário"
            >
              <Text style={[styles.actionBtnText, { color: getContrastTextColor(colors.primary), fontWeight: '800' }]}>
                Confirmar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof getThemeColors>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 24,
      borderWidth: 1.5,
      padding: 18,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginBottom: 14,
    },
    digitalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    digitBox: {
      width: 72,
      height: 64,
      borderRadius: 14,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    digitText: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    digitSub: {
      fontSize: 9,
      fontWeight: '700',
      marginTop: 2,
    },
    colonText: {
      fontSize: 26,
      fontWeight: '800',
      marginHorizontal: 8,
    },
    modeSubtitle: {
      fontSize: 11.5,
      fontWeight: '600',
      marginBottom: 12,
    },
    clockFace: {
      width: CLOCK_SIZE,
      height: CLOCK_SIZE,
      borderRadius: CLOCK_SIZE / 2,
      borderWidth: 1.5,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerHub: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      zIndex: 10,
    },
    pointerContainer: {
      position: 'absolute',
      left: CENTER,
      top: CENTER,
      width: 0,
      height: 0,
      zIndex: 5,
    },
    pointerNeedle: {
      position: 'absolute',
      bottom: 0,
      left: -1,
      width: 2.5,
      borderRadius: 1.5,
    },
    pointerEndpoint: {
      position: 'absolute',
      left: -17,
      width: 34,
      height: 34,
      borderRadius: 17,
      opacity: 0.3,
    },
    numberButton: {
      position: 'absolute',
      width: NUMBER_SIZE,
      height: NUMBER_SIZE,
      borderRadius: NUMBER_SIZE / 2,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 8,
    },
    numberText: {
      fontSize: 14,
      fontWeight: '700',
    },
    numberButtonInner: {
      position: 'absolute',
      width: NUMBER_SIZE - 6,
      height: NUMBER_SIZE - 6,
      borderRadius: (NUMBER_SIZE - 6) / 2,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 8,
    },
    numberTextInner: {
      fontSize: 11,
      fontWeight: '600',
    },
    minuteAdjustRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 10,
    },
    adjustBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
    },
    adjustBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
    presetsSection: {
      width: '100%',
      marginTop: 14,
      marginBottom: 16,
    },
    presetsTitle: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
    },
    presetsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    presetChip: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetChipText: {
      fontSize: 11.5,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
