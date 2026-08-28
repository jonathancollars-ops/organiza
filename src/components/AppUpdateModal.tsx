import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeType, AppUpdateInfo } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { AppUpdateService } from '../services/AppUpdateService';
import * as Haptics from 'expo-haptics';

export type UpdateModalStatus = 'idle' | 'downloading' | 'ready_to_install' | 'error';

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
  const styles = React.useMemo(() => createStyles(colors, theme), [colors, theme]);

  const [status, setStatus] = useState<UpdateModalStatus>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [downloadedFileUri, setDownloadedFileUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens or updateInfo changes
  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setProgressPercent(0);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setDownloadedFileUri(null);
      setErrorMessage(null);
      animatedProgress.setValue(0);
    }
  }, [visible, updateInfo]);

  // Animate progress smoothly
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progressPercent,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const formatBytesToMB = (bytes: number): string => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0.0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleStartDownload = async () => {
    if (!updateInfo.downloadUrl) {
      setStatus('error');
      setErrorMessage('O link para download do APK não foi encontrado nesta versão.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('downloading');
    setProgressPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setErrorMessage(null);

    try {
      const result = await AppUpdateService.downloadUpdateApk(
        updateInfo.downloadUrl,
        (progress, total, downloaded) => {
          const rawPercent = (total && total > 0) ? (downloaded / total) * 100 : (progress || 0) * 100;
          const safePercent = Math.min(Math.max(Math.round(rawPercent || 0), 0), 100);
          setProgressPercent(safePercent);
          setDownloadedBytes(downloaded || 0);
          setTotalBytes(total || 0);
        }
      );

      if (result.success && result.fileUri) {
        setDownloadedFileUri(result.fileUri);
        setProgressPercent(100);
        setStatus('ready_to_install');

        // Success Haptic Feedback
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Automatically trigger package installer
        try {
          await AppUpdateService.installApk(result.fileUri);
        } catch (installErr) {
          console.warn('Falha na instalação automática:', installErr);
        }
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Erro de conexão durante o download do pacote.');
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Falha inesperada ao transferir atualização.');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  const handleCancelDownload = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AppUpdateService.cancelDownload();
    setStatus('idle');
    setProgressPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
  };

  const handleInstall = async () => {
    if (!downloadedFileUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await AppUpdateService.installApk(downloadedFileUri);
    if (!res.success) {
      setStatus('error');
      setErrorMessage(res.error || 'Não foi possível iniciar o instalador de pacotes.');
    }
  };

  const handleOpenBrowser = async () => {
    Haptics.selectionAsync();
    if (updateInfo.downloadUrl) {
      await AppUpdateService.openDownloadUrl(updateInfo.downloadUrl);
    }
    onClose();
  };

  const handleRemindLater = async () => {
    Haptics.selectionAsync();
    if (status === 'downloading') {
      await AppUpdateService.cancelDownload();
    }
    await AppUpdateService.ignoreVersion(updateInfo.latestVersion);
    onClose();
  };

  const handleClose = async () => {
    if (status === 'downloading') {
      await AppUpdateService.cancelDownload();
    }
    onClose();
  };

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp'
  });

  const contrastPrimaryText = getContrastTextColor(colors.primary);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.card}>
            {/* Header Icon & Title */}
            <View style={styles.headerContainer}>
              <View
                style={[
                  styles.iconBadge,
                  status === 'error' && { backgroundColor: colors.dangerLight },
                  status === 'ready_to_install' && { backgroundColor: colors.successLight }
                ]}
              >
                <Text style={styles.iconEmoji}>
                  {status === 'downloading'
                    ? '⏳'
                    : status === 'ready_to_install'
                    ? '📦'
                    : status === 'error'
                    ? '⚠️'
                    : '🚀'}
                </Text>
              </View>

              <Text style={styles.title}>
                {status === 'downloading'
                  ? 'Baixando Atualização...'
                  : status === 'ready_to_install'
                  ? 'Atualização Pronta!'
                  : status === 'error'
                  ? 'Falha no Download'
                  : 'Nova Versão Disponível!'}
              </Text>

              <Text style={styles.subtitle}>
                {status === 'downloading'
                  ? 'Transferindo pacote de instalação do Lumen.'
                  : status === 'ready_to_install'
                  ? 'O pacote foi baixado com sucesso no dispositivo.'
                  : status === 'error'
                  ? 'Não foi possível concluir o download do instalador.'
                  : 'Uma nova versão do Lumen está pronta para você.'}
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

            {/* Dynamic Content Body based on Status */}
            {status === 'idle' && (
              <>
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
              </>
            )}

            {status === 'downloading' && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressStatusLabel}>Progresso do Download</Text>
                  <View style={[styles.percentBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.percentBadgeText, { color: colors.primary }]}>
                      {progressPercent}%
                    </Text>
                  </View>
                </View>

                {/* Animated Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressWidth,
                        backgroundColor: colors.primary
                      }
                    ]}
                  />
                </View>

                {/* Megabytes Counter & Speed / Hint */}
                <View style={styles.progressDetailsRow}>
                  <Text style={styles.progressMbText}>
                    {formatBytesToMB(downloadedBytes)} / {totalBytes > 0 ? formatBytesToMB(totalBytes) : 'Calculando...'}
                  </Text>
                  <Text style={styles.progressHintText}>Mantenha o app aberto</Text>
                </View>
              </View>
            )}

            {status === 'ready_to_install' && (
              <View style={[styles.statusBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                <Text style={styles.statusBoxIcon}>✅</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.statusBoxTitle, { color: theme === 'light' ? colors.successDark : colors.success }]}>
                    Pronto para Instalação
                  </Text>
                  <Text style={styles.statusBoxDesc}>
                    Toque no botão abaixo para abrir o instalador do Android e concluir o processo.
                  </Text>
                </View>
              </View>
            )}

            {status === 'error' && (
              <View style={[styles.statusBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                <Text style={styles.statusBoxIcon}>⚠️</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.statusBoxTitle, { color: colors.danger }]}>
                    Problema de Conexão
                  </Text>
                  <Text style={styles.statusBoxDesc}>
                    {errorMessage || 'Ocorreu um erro ao transferir o arquivo. Verifique sua conexão e tente novamente.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Actions Section */}
            <View style={styles.actionsContainer}>
              {status === 'idle' && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={handleStartDownload}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.primaryButtonText, { color: contrastPrimaryText }]}>
                      📥 Baixar e Atualizar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleRemindLater}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                      Lembrar Mais Tarde
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {status === 'downloading' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}
                  onPress={handleCancelDownload}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.danger }]}>
                    ✕ Cancelar Download
                  </Text>
                </TouchableOpacity>
              )}

              {status === 'ready_to_install' && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={handleInstall}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.primaryButtonText, { color: contrastPrimaryText }]}>
                      📲 Instalar Atualização
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleClose}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                      Fechar
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {status === 'error' && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={handleStartDownload}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.primaryButtonText, { color: contrastPrimaryText }]}>
                      🔄 Tentar Novamente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.browserButton, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}
                    onPress={handleOpenBrowser}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.browserButtonText, { color: colors.text }]}>
                      🌐 Baixar pelo Navegador
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleClose}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof getThemeColors>, theme: ThemeType) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      borderRadius: 24,
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
      marginBottom: 12
    },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryLight,
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
      textAlign: 'center',
      letterSpacing: -0.3
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18,
      paddingHorizontal: 8
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
      backgroundColor: colors.primaryLight,
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
      maxHeight: 120,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      marginBottom: 16
    },
    notesScroll: {
      maxHeight: 120
    },
    notesText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary
    },
    progressSection: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 16
    },
    progressHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    progressStatusLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text
    },
    percentBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8
    },
    percentBadgeText: {
      fontSize: 12,
      fontWeight: '800'
    },
    progressBarTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceSubtle,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 5
    },
    progressDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8
    },
    progressMbText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    progressHintText: {
      fontSize: 11,
      color: colors.textMuted
    },
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      marginBottom: 16
    },
    statusBoxIcon: {
      fontSize: 22
    },
    statusBoxTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 2
    },
    statusBoxDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15
    },
    actionsContainer: {
      gap: 8
    },
    primaryButton: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.2
    },
    cancelButton: {
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '700'
    },
    browserButton: {
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1
    },
    browserButtonText: {
      fontSize: 14,
      fontWeight: '700'
    },
    secondaryButton: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '600'
    }
  });
