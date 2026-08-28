import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { AgendaScreen } from './AgendaScreen';
import { EventTypeModal } from '../components/EventTypeModal';
import { SubjectModal } from '../components/SubjectModal';
import { ExamModal } from '../components/ExamModal';
import { EventModal } from '../components/EventModal';
import { PendingAttendanceModal } from '../components/PendingAttendanceModal';
import { AppEvent, Subject } from '../types';
import { StorageService } from '../services/storage';

export const AgendaScreenWrapper = ({ onFabPress }: { onFabPress: () => void }) => {
  const { 
    events, setEvents, 
    subjects, setSubjects, 
    attendances, setAttendances, 
    tasks, setTasks, 
    theme, settings, gamification 
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Modals state moved from App.tsx
  const [eventTypeVisible, setEventTypeVisible] = useState(false);
  const [subjectVisible, setSubjectVisible] = useState(false);
  const [examVisible, setExamVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);

  // Re-creating condensed logic from App.tsx
  const handleSaveEvent = async (event: AppEvent) => {
    let newEvents = [...events];
    if (editingEvent) {
      newEvents = newEvents.map(e => e.id === event.id ? event : e);
    } else {
      newEvents.push(event);
    }
    setEvents(newEvents);
    setEventModalVisible(false);
    setExamVisible(false);
    setEditingEvent(null);
    await StorageService.saveEvents(newEvents);
  };

  return (
    <>
      <AgendaScreen
        events={events}
        subjects={subjects}
        attendances={attendances}
        tasks={tasks}
        theme={theme}
        settings={settings}
        gamification={gamification}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onToggleEventCompletion={() => {}}
        onToggleTaskCompletion={() => {}}
        onEditEvent={(event) => {
          setEditingEvent(event);
          setEventModalVisible(true);
        }}
        onOpenStudy={() => {}}
        onOpenAttendanceModal={() => setAttendanceModalVisible(true)}
        onOpenExamDetails={(examEvent) => {
          setEditingEvent(examEvent);
          setEventModalVisible(true);
        }}
        onAddNewEvent={() => {
          setEditingEvent(null);
          setEventModalVisible(true);
        }}
        onOpenScheduleGrid={() => {}}
      />
      
      {/* Move FAB here for simplicity in this wrapper */}
      <EventModal
        visible={eventModalVisible}
        onClose={() => {
          setEventModalVisible(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={() => {}}
        theme={theme}
        initialEvent={editingEvent}
        initialDate={selectedDate || undefined}
        isDateLocked={!!selectedDate}
      />
    </>
  );
};
