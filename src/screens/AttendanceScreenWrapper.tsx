import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { AttendanceScreen } from './AttendanceScreen';
import { SubjectDetailsModal } from '../components/SubjectDetailsModal';
import { SubjectModal } from '../components/SubjectModal';
import { Subject, AppEvent } from '../types';
import { generateId } from '../utils/id';
import { StorageService } from '../services/storage';

export const AttendanceScreenWrapper = () => {
  const navigation = useNavigation<any>();
  const { 
    subjects, 
    events, 
    setEvents,
    attendances, 
    setAttendances, 
    theme, 
    semesters, 
    updateAttendance,
    addOrUpdateSubject,
    archiveSubject,
    deleteSubject
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
      console.warn('Erro ao atualizar matéria no AttendanceScreenWrapper:', e);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      if (id) {
        await deleteSubject(id);
      }
    } catch (e) {
      console.warn('Erro ao excluir matéria no AttendanceScreenWrapper:', e);
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
      console.warn('Erro ao registrar presença manual no AttendanceScreenWrapper:', e);
    }
  };

  return (
    <>
      <AttendanceScreen
        subjects={subjects}
        events={events}
        attendances={attendances}
        theme={theme}
        semesters={semesters}
        onSubjectPress={handleOpenDetails}
        onAddNewSubject={() => setSubjectModalVisible(true)}
        onUpdateAttendance={async (subjectId, eventId, status, dateStr) => {
          try {
            const existing = attendances.find(a => a && a.subjectId === subjectId && a.eventId === eventId && a.date === dateStr);
            const record = existing 
              ? { ...existing, status }
              : { id: generateId('att'), subjectId, eventId, status, date: dateStr };
            await updateAttendance(record);
          } catch (e) {
            console.warn('Erro ao atualizar presença em AttendanceScreenWrapper:', e);
          }
        }}
      />

      <SubjectDetailsModal
        visible={detailsModalVisible && !!selectedSubject}
        onClose={handleCloseDetails}
        subject={selectedSubject}
        events={events}
        attendances={attendances}
        initialTab="faltas"
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
            console.warn('Erro ao salvar disciplina em AttendanceScreenWrapper:', e);
          } finally {
            setSubjectModalVisible(false);
          }
        }}
        theme={theme}
        semesters={semesters}
      />
    </>
  );
};
