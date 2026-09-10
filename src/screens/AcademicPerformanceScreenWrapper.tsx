import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { AcademicPerformanceScreen } from './AcademicPerformanceScreen';
import { SwipeableTabContainer } from '../components/SwipeableTabContainer';

export const AcademicPerformanceScreenWrapper = () => {
  const navigation = useNavigation<any>();
  const { subjects, theme } = useApp();

  return (
    <SwipeableTabContainer
      currentTab="Desempenho"
      onNavigateTab={(nextTab) => navigation.navigate(nextTab)}
    >
      <AcademicPerformanceScreen
        subjects={subjects}
        theme={theme}
      />
    </SwipeableTabContainer>
  );
};
