import React from 'react';
import { useApp } from '../contexts/AppContext';
import { GradesScreen } from './GradesScreen';

export const GradesScreenWrapper = () => {
  const { subjects, events, attendances, theme, semesters } = useApp();

  return (
    <GradesScreen
      subjects={subjects}
      events={events}
      attendances={attendances}
      theme={theme}
      semesters={semesters}
      onSubjectPress={() => {}}
      onArchiveSubject={() => {}}
    />
  );
};
