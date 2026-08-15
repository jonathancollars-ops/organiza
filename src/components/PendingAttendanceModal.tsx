import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { AttendanceRecord, Subject, AppEvent, ThemeType } from '../types';
import { getThemeColors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  pendingAttendances: AttendanceRecord[];
  subjects: Subject[];
  events: AppEvent[];
  onUpdateStatus: (id: string, status: 'present' | 'absent' | 'cancelled') => void;
  theme: ThemeType;
}

export const PendingAttendanceModal: React.FC<Props> = ({ visible, onClose, pendingAttendances, subjects, events, onUpdateStatus, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Faltas Pendentes</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            Você tem aulas que já aconteceram mas não registrou presença. Por favor, atualize seu status:
          </Text>

          {pendingAttendances.map(att => {
            const subject = subjects.find(s => s.id === att.subjectId);
            const event = events.find(e => e.id === att.eventId);
            if (!subject || !event) return null;

            return (
              <View key={att.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ marginBottom: 15 }}>
                  <Text style={[styles.subjectName, { color: colors.text }]}>{subject.name}</Text>
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                    Dia {att.date.split('-').reverse().join('/')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    Horário: {event.startTime} - {event.endTime}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                    onPress={() => onUpdateStatus(att.id, 'present')}
                  >
                    <Text style={styles.btnText}>Presente</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                    onPress={() => onUpdateStatus(att.id, 'absent')}
                  >
                    <Text style={styles.btnText}>Faltei</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.border }]}
                    onPress={() => onUpdateStatus(att.id, 'cancelled')}
                  >
                    <Text style={[styles.btnText, { color: colors.text }]}>Cancelada</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  closeText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  card: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
