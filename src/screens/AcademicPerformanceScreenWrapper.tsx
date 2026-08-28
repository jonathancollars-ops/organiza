import React from 'react';
import { useApp } from '../contexts/AppContext';
import { AcademicPerformanceScreen } from './AcademicPerformanceScreen';

export const AcademicPerformanceScreenWrapper = () => {
  const { subjects, theme } = useApp();

  return (
    <AcademicPerformanceScreen
      subjects={subjects}
      theme={theme}
    />
  );
};
