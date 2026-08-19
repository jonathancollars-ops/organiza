import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, ScrollView, Alert, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Subject, AttendanceRecord, AppEvent, ThemeType, Semester } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { GradeEngine } from './GradeEngine';
import { EditSubjectModal } from './EditSubjectModal';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  subject: Subject | null;
  events: AppEvent[];
  attendances: AttendanceRecord[];
  onUpdateSubject: (updatedSubject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onAddManualAttendance: (subjectId: string, date: string, status: 'present' | 'absent' | 'cancelled') => void;
  theme: ThemeType;
  semesters?: Semester[];
}

export const SubjectDetailsModal: React.FC<Props> = ({
  visible,
  onClose,
  subject,
  events,
  attendances,
  onUpdateSubject,
  onDeleteSubject,
  onAddManualAttendance,
  theme,
  semesters = []
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);
  
  const [activeTab, setActiveTab] = useState<'notas' | 'faltas'>('notas');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);

  if (!subject) return null;

  const subjectAttendances = attendances.filter(a => a.subjectId === subject.id);
  const totalAbsences = subjectAttendances.filter(a => a.status === 'absent').length;

  const handleManualAdd = (status: 'present' | 'absent' | 'cancelled') => {
    if (!manualDate) {
      Alert.alert('Erro', 'Selecione uma data no calendário.');
      return;
    }
    
    const existingIndex = attendances.findIndex(a => a.subjectId === subject.id && a.date === manualDate);
    if (existingIndex >= 0) {
      Alert.alert(
        'Atenção',
        'Já existe um registro para este dia. Deseja substituí-lo?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Substituir', onPress: () => saveManualAdd(status) }
        ]
      );
      return;
    }

    saveManualAdd(status);
  };

  const saveManualAdd = (status: 'present' | 'absent' | 'cancelled') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddManualAttendance(subject.id, manualDate, status);
    setShowManualAdd(false);
    setManualDate('');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 20, color: colors.primary, marginRight: 2 }}>‹</Text>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>Voltar</Text>
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <View style={[styles.subjectDot, { backgroundColor: subject.color || colors.primary }]} />
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{subject.name}</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.surfaceSubtle }]}
            onPress={() => {
              Haptics.selectionAsync();
              setEditModalVisible(true);
            }}
            accessibilityLabel="Editar Matéria"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {subject.notes && (
          <View style={[styles.notesBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>INFO / PROFESSOR:</Text>
            <Text style={{ color: colors.text, fontSize: 13 }}>{subject.notes}</Text>
          </View>
        )}

        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'notas' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} 
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('notas');
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'notas' ? colors.primary : colors.textSecondary, fontWeight: activeTab === 'notas' ? '800' : '600' }
            ]}>
              📊 Notas & Média
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'faltas' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} 
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('faltas');
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'faltas' ? colors.primary : colors.textSecondary, fontWeight: activeTab === 'faltas' ? '800' : '600' }
            ]}>
              📅 Faltas & Presenças
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'notas' ? (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <GradeEngine 
              subject={subject} 
              onUpdateSubject={onUpdateSubject} 
              theme={theme} 
            />
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, padding: 18 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.absencesHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: totalAbsences >= (subject.maxAbsences || 15) * 0.7 ? colors.danger : colors.success }}>
                  {totalAbsences}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Faltas Atuais</Text>
              </View>
              <View style={{ height: 40, width: 1, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text }}>{subject.maxAbsences || 15}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Limite (25%)</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico de Faltas</Text>

            <TouchableOpacity 
              style={[styles.manualAddBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowManualAdd(!showManualAdd)}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                {showManualAdd ? '✕ Cancelar Registro' : '+ Registrar aula passada avulsa'}
              </Text>
            </TouchableOpacity>

            {showManualAdd && (
              <View style={[styles.calendarBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={{ color: colors.text, marginBottom: 10, textAlign: 'center', fontWeight: '700' }}>
                  Selecione a data da aula:
                </Text>
                
                <Calendar
                  onDayPress={(day: any) => {
                    Haptics.selectionAsync();
                    setManualDate(day.dateString);
                  }}
                  markedDates={{
                    [manualDate]: { selected: true, selectedColor: colors.primary, selectedTextColor: getContrastTextColor(colors.primary) }
                  }}
                  theme={{
                    calendarBackground: colors.surface,
                    textSectionTitleColor: colors.textSecondary,
                    dayTextColor: colors.text,
                    todayTextColor: colors.primary,
                    monthTextColor: colors.text,
                    arrowColor: colors.primary,
                  }}
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 15 }}
                />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.attActionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}
                    onPress={() => handleManualAdd('present')}
                    activeOpacity={0.7}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      style={{ color: theme === 'light' ? colors.successDark : colors.success, fontWeight: '700', fontSize: 13 }}
                    >
                      ✓ Presente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attActionBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
                    onPress={() => handleManualAdd('absent')}
                    activeOpacity={0.7}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '700', fontSize: 13 }}
                    >
                      ✕ Falta
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attActionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                    onPress={() => handleManualAdd('cancelled')}
                    activeOpacity={0.7}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}
                    >
                      Cancelada
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {subjectAttendances.filter(a => a.status === 'absent').length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 24, padding: 20 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>
                  Nenhuma falta registrada nesta matéria!
                </Text>
              </View>
            ) : (
              subjectAttendances.filter(a => a.status === 'absent').map(att => (
                <View key={att.id} style={[styles.absenceItem, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                    📅 {att.date.split('-').reverse().join('/')}
                  </Text>
                  <View style={[styles.absenceBadge, { backgroundColor: colors.dangerLight }]}>
                    <Text style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '700', fontSize: 12 }}>Falta</Text>
                  </View>
                </View>
              ))
            )}
            
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        <EditSubjectModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          subject={subject}
          onSave={onUpdateSubject}
          onDelete={(id) => {
            onDeleteSubject(id);
            onClose();
          }}
          theme={theme}
          semesters={semesters}
        />
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 6 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 75,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  notesBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  absencesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  manualAddBtn: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15
  },
  calendarBox: {
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15
  },
  attActionBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  absenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  absenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  }
});

