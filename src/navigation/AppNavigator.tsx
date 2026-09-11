import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../contexts/AppContext';
import { getThemeColors, getContrastTextColor } from '../theme';
import { StorageService } from '../services/storage';
import { AppUpdateService } from '../services/AppUpdateService';
import { NotificationService } from '../services/notifications';
import { AppUpdateInfo } from '../types';
import { SwipeableTabContainer } from '../components/SwipeableTabContainer';

// Screens
import { AgendaScreenWrapper } from '../screens/AgendaScreenWrapper';
import { StudyScreenWrapper } from '../screens/StudyScreenWrapper';
import { AcademicPerformanceScreenWrapper } from '../screens/AcademicPerformanceScreenWrapper';
import { AttendanceScreenWrapper } from '../screens/AttendanceScreenWrapper';
import { GradesScreenWrapper } from '../screens/GradesScreenWrapper';

// Modals
import { SettingsModal } from '../components/SettingsModal';
import { AnalyticsAndAACCModal } from '../components/AnalyticsAndAACCModal';
import { AchievementsModal } from '../components/AchievementsModal';
import { GroupProjectsModal } from '../components/GroupProjectsModal';
import { AppUpdateModal } from '../components/AppUpdateModal';
import { OnboardingModal } from '../components/OnboardingModal';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const { theme, settings, setSettings, gamification, isInitializing, handleThemeToggle, events, subjects, studySessions, attendances, streak, semesters, setSemesters, refreshData, aiConfig, updateAIConfig } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  // Global Modals State
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [groupProjectsModalVisible, setGroupProjectsModalVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  
  // App Update State
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);

  const handleCloseUpdateModal = async () => {
    setUpdateModalVisible(false);
    try {
      await AppUpdateService.recordPromptDismissed();
    } catch {
      // Ignora falhas de persistência
    }
  };
  
  useEffect(() => {
    const check = async () => {
      try {
        // Cooldown de 24 horas: se o usuário já visualizou ou cancelou o modal hoje, não reabre automaticamente
        const shouldShow = await AppUpdateService.shouldShowAutomaticPrompt();
        if (!shouldShow) {
          return;
        }

        const info = await AppUpdateService.checkForUpdates(false);
        if (info && info.hasUpdate) {
          setUpdateInfo(info);
          setUpdateModalVisible(true);
          // Marca visualização para iniciar o cooldown mesmo se o app for encerrado
          await AppUpdateService.recordPromptDismissed();
        }
      } catch {
        // Falhas na verificação em segundo plano são tratadas silenciosamente
      }
    };
    check();
  }, []);

  useEffect(() => {
    const reconcileNotifications = async () => {
      try {
        if (!isInitializing) {
          await NotificationService.reconcileAndPurgeOrphanNotifications(events, subjects);
        }
      } catch (notifErr) {
        console.warn('Erro ao reconciliar notificações na inicialização do AppNavigator:', notifErr);
      }
    };
    reconcileNotifications();
  }, [isInitializing]);
  
  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const CustomHeader = () => (
    <View style={[
      styles.header, 
      { 
        borderBottomColor: colors.border, 
        backgroundColor: colors.surface,
        paddingTop: insets.top > 0 ? insets.top + (insets.top >= 54 ? 4 : 8) : (Platform.OS === 'ios' ? 48 : 36),
      }
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
        <View style={[styles.logoIconBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={{ fontSize: 16 }}>🎓</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Lumen</Text>
        {settings.examWeekMode && (
          <View style={[styles.examModeBadge, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
            <Text style={{ color: colors.danger, fontSize: 10, fontWeight: 'bold' }}>🎯 MODO PROVAS</Text>
          </View>
        )}
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity
          style={[styles.levelHeaderBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={() => {
            Haptics.selectionAsync();
            setAchievementsModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
            Nv. {gamification?.level || 1} 🎓
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          onPress={() => setGroupProjectsModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15 }}>👥</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          onPress={() => setAnalyticsModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15 }}>📈</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          onPress={() => setSettingsModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          onPress={handleThemeToggle}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>
            {theme === 'dark' ? '🌙' : theme === 'amoled' ? '🖤' : '☀️'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isDark = theme !== 'light';
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} backgroundColor="transparent" translucent />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenListeners={{
            tabPress: () => {
              Haptics.selectionAsync();
            }
          }}
          screenOptions={({ route }) => ({
            header: () => <CustomHeader />,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              position: 'absolute',
              bottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 14 : 12),
              left: 16,
              right: 16,
              height: 62,
              borderRadius: 26,
              backgroundColor: colors.glassBackground || (isDark ? 'rgba(24, 27, 32, 0.92)' : 'rgba(255, 255, 255, 0.94)'),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.specularBorder || (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.hairlineBorder || (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
              paddingBottom: Platform.OS === 'ios' ? 8 : 6,
              paddingTop: 8,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowRadius: 14,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.1,
              marginTop: 1,
            },
            tabBarIcon: ({ color, size, focused }) => {
              let icon = '';
              if (route.name === 'Agenda') icon = '📅';
              else if (route.name === 'Estudos') icon = '⏱️';
              else if (route.name === 'Desempenho') icon = '🎯';
              else if (route.name === 'Faltas') icon = '📊';
              else if (route.name === 'Notas') icon = '🎓';
              return <Text style={{ fontSize: focused ? 22 : 19, opacity: focused ? 1 : 0.8 }}>{icon}</Text>;
            }
          })}
        >
          <Tab.Screen name="Agenda" component={AgendaScreenWrapper} />
          <Tab.Screen name="Estudos" component={StudyScreenWrapper} />
          <Tab.Screen name="Desempenho" component={AcademicPerformanceScreenWrapper} />
          <Tab.Screen name="Faltas" component={AttendanceScreenWrapper} />
          <Tab.Screen name="Notas" component={GradesScreenWrapper} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* Global Modals */}
      <SettingsModal 
        visible={settingsModalVisible} 
        onClose={() => setSettingsModalVisible(false)} 
        theme={theme}
        onThemeChange={handleThemeToggle}
        settings={settings}
        onUpdateSettings={setSettings}
        semesters={semesters}
        onUpdateSemesters={setSemesters}
        aiConfig={aiConfig}
        onUpdateAIConfig={updateAIConfig}
        onOpenGuide={() => setOnboardingVisible(true)}
        onRestoreSuccess={() => refreshData()}
        onOpenUpdateModal={(info) => {
          setUpdateInfo(info);
          setUpdateModalVisible(true);
        }}
      />
      <OnboardingModal
        visible={onboardingVisible}
        onClose={() => setOnboardingVisible(false)}
        theme={theme}
      />
      <AnalyticsAndAACCModal 
        visible={analyticsModalVisible} 
        onClose={() => setAnalyticsModalVisible(false)} 
        theme={theme} 
        subjects={subjects}
        studySessions={studySessions}
        attendances={attendances}
      />
      <AchievementsModal 
        visible={achievementsModalVisible} 
        onClose={() => setAchievementsModalVisible(false)} 
        theme={theme}
        studySessions={studySessions}
        streak={streak}
        attendances={attendances}
      />
      <GroupProjectsModal 
        visible={groupProjectsModalVisible} 
        onClose={() => setGroupProjectsModalVisible(false)} 
        theme={theme} 
        subjects={subjects}
      />
      <AppUpdateModal 
        visible={updateModalVisible} 
        updateInfo={updateInfo} 
        theme={theme} 
        onClose={handleCloseUpdateModal} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  examModeBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelHeaderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
