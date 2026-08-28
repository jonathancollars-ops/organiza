import React from 'react';
import { useApp } from '../contexts/AppContext';
import { AttendanceScreen } from './AttendanceScreen';

export const AttendanceScreenWrapper = () => {
  const { subjects, events, attendances, setAttendances, theme, semesters } = useApp();

  return (
    <AttendanceScreen
      subjects={subjects}
      events={events}
      attendances={attendances}
      theme={theme}
      semesters={semesters}
      onSubjectPress={() => {}}
      onUpdateAttendance={() => {}}
    />
  );
};
