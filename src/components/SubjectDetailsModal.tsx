import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView } from 'react-native';
import { Subject, AttendanceRecord, AppEvent, ThemeType } from '../types';
import { getThemeColors } from '../theme';
import { GradeEngine } from './GradeEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
  subject: Subject | null;
  events: AppEvent[];
  attendances: AttendanceRecord[];
  onUpdateSubject: (updatedSubject: Subject) => void;
  theme: ThemeType;
}

export const SubjectDetailsModal: React.FC<Props> = ({ visible, onClose, subject, events, attendances, onUpdateSubject, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);
  
  const [activeTab, setActiveTab] = useState<'notas' | 'faltas'>('notas');

  if (!subject) return null;

  const subjectAttendances = attendances.filter(a => a.subjectId === subject.id);
  const totalAbsences = subjectAttendances.filter(a => a.status === 'absent').length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={{ fontSize: 24, color: colors.primary }}>‹</Text>
            <Text style={{ fontSize: 16, color: colors.primary, marginLeft: 5 }}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{subject.name}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'notas' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
            onPress={() => setActiveTab('notas')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'notas' ? colors.primary : colors.textSecondary }]}>Notas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'faltas' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
            onPress={() => setActiveTab('faltas')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'faltas' ? colors.primary : colors.textSecondary }]}>Faltas</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'notas' ? (
          <ScrollView style={{ flex: 1 }}>
            <GradeEngine 
              subject={subject} 
              onUpdateSubject={onUpdateSubject} 
              theme={theme} 
            />
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={styles.absencesHeader}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#ef4444' }}>{totalAbsences}</Text>
                <Text style={{ color: colors.textSecondary }}>Faltas Atuais</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.text }}>{subject.maxAbsences || 15}</Text>
                <Text style={{ color: colors.textSecondary }}>Limite (25%)</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico de Faltas</Text>
            
            {subjectAttendances.filter(a => a.status === 'absent').length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
                Nenhuma falta registrada! 🎉
              </Text>
            ) : (
              subjectAttendances.filter(a => a.status === 'absent').map(att => (
                <View key={att.id} style={[styles.absenceItem, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 16 }}>Dia {att.date.split('-').reverse().join('/')}</Text>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Falta</Text>
                </View>
              ))
            )}
            
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  absencesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  absenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
  }
});
