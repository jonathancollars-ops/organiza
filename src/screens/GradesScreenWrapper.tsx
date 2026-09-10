import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { GradesScreen } from './GradesScreen';
import { SubjectDetailsModal } from '../components/SubjectDetailsModal';
import { SubjectModal } from '../components/SubjectModal';
import { Subject, AppEvent } from '../types';
import { generateId } from '../utils/id';
import { StorageService } from '../services/storage';
import { SwipeableTabContainer } from '../components/SwipeableTabContainer';

export const GradesScreenWrapper = () => {
  const navigation = useNavigation<any>();
  const { 
    subjects, 
    events, 
    setEvents,
    attendances, 
    theme, 
    semesters, 
    archiveSubject,
    deleteSubject,
    addOrUpdateSubject,
    updateAttendance
  } = useApp();

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const handleOpenDetails = (subjectId: string) => {
    const found = subjects.find(s => s && s.id === subjectId) || null;
    setSelectedSubject(found);
    setDetailsModalVisible(true);
  };

  const handleCloseDetails = () => {
    setDetailsModalVisible(false);
    setSelectedSubject(null);
  };

  const handleUpdateSubject = async (updatedSubject: Subject) => {
    try {
      if (updatedSubject) {
        await addOrUpdateSubject(updatedSubject);
        setSelectedSubject(updatedSubject);
      }
    } catch (e) {
      console.warn('Erro ao atualizar matéria no GradesScreenWrapper:', e);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      if (id) {
        await deleteSubject(id);
      }
    } catch (e) {
      console.warn('Erro ao excluir matéria no GradesScreenWrapper:', e);
    } finally {
      handleCloseDetails();
    }
  };

  const handleAddManualAttendance = async (subjectId: string, date: string, status: 'present' | 'absent' | 'cancelled') => {
    try {
      const existing = attendances.find(a => a && a.subjectId === subjectId && a.date === date);
      const record = existing 
        ? { ...existing, status }
        : { id: generateId('att'), subjectId, eventId: '', status, date };
      await updateAttendance(record);
    } catch (e) {
      console.warn('Erro ao registrar presença manual no GradesScreenWrapper:', e);
    }
  };

  const isAnyModalOpen = detailsModalVisible || subjectModalVisible;

  return (
    <SwipeableTabContainer
      currentTab="Notas"
      onNavigateTab={(nextTab) => navigation.navigate(nextTab)}
      disabled={isAnyModalOpen}
    >
      <GradesScreen
        subjects={subjects}
        events={events}
        attendances={attendances}
        theme={theme}
        semesters={semesters}
        onSubjectPress={handleOpenDetails}
        onAddNewSubject={() => setSubjectModalVisible(true)}
        onArchiveSubject={async (id) => {
          try {
            await archiveSubject(id);
          } catch (e) {
            console.warn('Erro ao arquivar matéria no GradesScreen:', e);
          }
        }}
      />

      <SubjectDetailsModal
        visible={detailsModalVisible && !!selectedSubject}
        onClose={handleCloseDetails}
        subject={selectedSubject}
        events={events}
        attendances={attendances}
        initialTab="notas"
        onUpdateSubject={handleUpdateSubject}
        onDeleteSubject={handleDeleteSubject}
        onAddManualAttendance={handleAddManualAttendance}
        theme={theme}
        semesters={semesters}
      />

      <SubjectModal
        visible={subjectModalVisible}
        onClose={() => setSubjectModalVisible(false)}
        onSave={async (newSubject, newEvents) => {
          try {
            if (newSubject) {
              await addOrUpdateSubject(newSubject);
              if (newEvents && newEvents.length > 0) {
                const updatedEvents = [...events, ...newEvents];
                setEvents(updatedEvents);
                await StorageService.saveEvents(updatedEvents);
              }
            }
          } catch (e) {
            console.warn('Erro ao salvar disciplina em GradesScreenWrapper:', e);
          } finally {
            setSubjectModalVisible(false);
          }
        }}
        theme={theme}
        semesters={semesters}
      />
    </SwipeableTabContainer>
  );
};
