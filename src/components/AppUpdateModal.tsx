import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeType, AppUpdateInfo } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { AppUpdateService } from '../services/AppUpdateService';
import * as Haptics from 'expo-haptics';

interface AppUpdateModalProps {
  visible: boolean;
  updateInfo: AppUpdateInfo | null;
  theme?: ThemeType;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  visible,
  updateInfo,
  theme = 'dark',
  onClose
}) => {
  const colors = getThemeColors(theme);
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const handleDownload = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDownloading(true);
    try {
      await AppUpdateService.openDownloadUrl(updateInfo.downloadUrl);
    } finally {
      setIsDownloading(false);
      onClose();
    }
  };

  const handleRemindLater = async () => {
    Haptics.selectionAsync();
    await AppUpdateService.ignoreVersion(updateInfo.latestVersion);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.card}>
            {/* Header Icon & Title */}
            <View style={styles.headerContainer}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconEmoji}>🚀</Text>
              </View>
              <Text style={styles.title}>Nova Versão Disponível!</Text>
              <Text style={styles.subtitle}>
                Uma nova atualização do Lumen está pronta para você.
              </Text>
            </View>

            {/* Version Pills */}
            <View style={styles.versionRow}>
              <View style={styles.versionPill}>
                <Text style={styles.versionLabel}>Atual</Text>
                <Text style={styles.versionValue}>v{updateInfo.currentVersion}</Text>
              </View>
              <Text style={styles.arrowIcon}>➔</Text>
              <View style={[styles.versionPill, styles.newVersionPill]}>
                <Text style={styles.newVersionLabel}>Nova</Text>
                <Text style={styles.newVersionValue}>v{updateInfo.latestVersion}</Text>
              </View>
            </View>

            {/* Release Notes */}
            <Text style={styles.notesHeader}>O que há de novo:</Text>
            <View style={styles.notesContainer}>
              <ScrollView
                style={styles.notesScroll}
                showsVerticalScrollIndicator
                contentContainerStyle={{ padding: 12 }}
              >
                <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
              </ScrollView>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleDownload}
                disabled={isDownloading}
                activeOpacity={0.8}
              >
                {isDownloading ? (
                  <ActivityIndicator color={getContrastTextColor(colors.primary)} />
                ) : (
                  <Text style={styles.primaryButtonText}>📥 Baixar e Atualizar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRemindLater}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Lembrar Mais Tarde</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof getThemeColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16
    },
    safeArea: {
      width: '100%',
      maxWidth: 420,
      justifyContent: 'center'
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderColor: colors.border,
      borderWidth: 1,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: 16
    },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10
    },
    iconEmoji: {
      fontSize: 28
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center'
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 12
    },
    versionPill: {
      backgroundColor: colors.surfaceSubtle || colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignItems: 'center'
    },
    newVersionPill: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary
    },
    versionLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase'
    },
    versionValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text
    },
    newVersionLabel: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase'
    },
    newVersionValue: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary
    },
    arrowIcon: {
      fontSize: 16,
      color: colors.textMuted,
      marginHorizontal: 12
    },
    notesHeader: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6
    },
    notesContainer: {
      maxHeight: 140,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      marginBottom: 18
    },
    notesScroll: {
      maxHeight: 140
    },
    notesText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary
    },
    actionsContainer: {
      gap: 8
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center'
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '800',
      color: getContrastTextColor(colors.primary)
    },
    secondaryButton: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    }
  });
