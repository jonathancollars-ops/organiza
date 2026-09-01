import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { StudyScreen } from './StudyScreen';
import { AchievementsModal } from '../components/AchievementsModal';
import { AnalyticsAndAACCModal } from '../components/AnalyticsAndAACCModal';

export const StudyScreenWrapper = () => {
  const navigation = useNavigation<any>();
  const { 
    subjects, 
    tasks, 
    setTasks, 
    studySessions, 
    setStudySessions, 
    streak,
    attendances,
    theme, 
    settings 
  } = useApp();

  const [achievementsVisible, setAchievementsVisible] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);

  return (
    <>
      <StudyScreen
        subjects={subjects}
        tasks={tasks}
        onUpdateTasks={(updated) => setTasks(updated)}
        sessions={studySessions}
        onAddSession={(session) => setStudySessions([...studySessions, session])}
        theme={theme}
        focusMinutesDefault={settings.pomodoroFocusMin}
        breakMinutesDefault={settings.pomodoroBreakMin}
        onOpenAchievements={() => setAchievementsVisible(true)}
        onOpenAnalytics={() => setAnalyticsVisible(true)}
      />

      <AchievementsModal
        visible={achievementsVisible}
        onClose={() => setAchievementsVisible(false)}
        theme={theme}
        studySessions={studySessions}
        streak={streak}
        attendances={attendances}
      />

      <AnalyticsAndAACCModal
        visible={analyticsVisible}
        onClose={() => setAnalyticsVisible(false)}
        theme={theme}
        subjects={subjects}
        studySessions={studySessions}
        attendances={attendances}
      />
    </>
  );
};
