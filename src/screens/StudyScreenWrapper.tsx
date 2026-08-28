import React from 'react';
import { useApp } from '../contexts/AppContext';
import { StudyScreen } from './StudyScreen';

export const StudyScreenWrapper = () => {
  const { subjects, tasks, setTasks, studySessions, setStudySessions, theme, settings } = useApp();

  return (
    <StudyScreen
      subjects={subjects}
      tasks={tasks}
      onUpdateTasks={(updated) => setTasks(updated)}
      sessions={studySessions}
      onAddSession={(session) => setStudySessions([...studySessions, session])}
      theme={theme}
      focusMinutesDefault={settings.pomodoroFocusMin}
      breakMinutesDefault={settings.pomodoroBreakMin}
      onOpenAchievements={() => {}}
      onOpenAnalytics={() => {}}
    />
  );
};
