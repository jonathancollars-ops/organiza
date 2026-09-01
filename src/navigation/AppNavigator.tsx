import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../contexts/AppContext';
import { getThemeColors, getContrastTextColor } from '../theme';
import { StorageService } from '../services/storage';
import { AppUpdateService } from '../services/AppUpdateService';
import { AppUpdateInfo } from '../types';

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
  const { theme, settings, setSettings, gamification, isInitializing, handleThemeToggle, subjects, studySessions, attendances, streak, semesters, setSemesters, refreshData } = useApp();
  const colors = getThemeColors(theme);

  // Global Modals State
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [groupProjectsModalVisible, setGroupProjectsModalVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  
  // App Update State
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  
  useEffect(() => {
    const check = async () => {
      const info = await AppUpdateService.checkForUpdates(false);
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        setUpdateModalVisible(true);
      }
    };
    check();
  }, []);
  
  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const CustomHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
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
          screenOptions={({ route }) => ({
            header: () => <CustomHeader />,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
            tabBarIcon: ({ color, size, focused }) => {
              let icon = '';
              if (route.name === 'Agenda') icon = '📅';
              else if (route.name === 'Estudos') icon = '⏱️';
              else if (route.name === 'Desempenho') icon = '🎯';
              else if (route.name === 'Faltas') icon = '📊';
              else if (route.name === 'Notas') icon = '🎓';
              return <Text style={{ fontSize: focused ? 24 : 20 }}>{icon}</Text>;
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
        onClose={() => setUpdateModalVisible(false)} 
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
    borderBottomWidth: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  examModeBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  levelHeaderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
