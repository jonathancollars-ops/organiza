import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { GradesScreen } from './GradesScreen';
import { SubjectDetailsModal } from '../components/SubjectDetailsModal';
import { Subject } from '../types';
import { generateId } from '../utils/id';

export const GradesScreenWrapper = () => {
  const navigation = useNavigation<any>();
  const { 
    subjects, 
    events, 
    attendances, 
    theme, 
    semesters, 
    archiveSubject,
    addOrUpdateSubject,
    updateAttendance
  } = useApp();

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
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
        await archiveSubject(id);
      }
    } catch (e) {
      console.warn('Erro ao arquivar matéria no GradesScreenWrapper:', e);
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

  return (
    <>
      <GradesScreen
        subjects={subjects}
        events={events}
        attendances={attendances}
        theme={theme}
        semesters={semesters}
        onSubjectPress={handleOpenDetails}
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
    </>
  );
};
