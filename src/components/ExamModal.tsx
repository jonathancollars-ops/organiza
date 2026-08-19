import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, Switch, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { AppEvent, ThemeType, Subject } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { generateId, getLocalDateString } from '../utils';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (event: AppEvent) => void;
  subjects: Subject[];
  events: AppEvent[];
  theme: ThemeType;
  initialDate?: string;
  isDateLocked?: boolean;
}

const ALERT_OPTIONS = [
  { label: 'Na hora', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
  { label: '1 semana antes', value: 10080 },
];

export const ExamModal: React.FC<Props> = ({ visible, onClose, onSave, subjects, events, theme, initialDate, isDateLocked }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [examType, setExamType] = useState<'Prova' | 'Trabalho'>('Prova');
  const [date, setDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [startMinutes, setStartMinutes] = useState(480);
  const [durationMinutes, setDurationMinutes] = useState(60);
  
  const [alerts, setAlerts] = useState<number[]>([1440, 10080]); // Default 1 day and 1 week before
  const [customAlertVal, setCustomAlertVal] = useState('');
  const [customAlertUnit, setCustomAlertUnit] = useState<number>(1);

  // Grade Engine
  const [weight, setWeight] = useState('1');
  const [maxGrade, setMaxGrade] = useState('10');
  const [isExtraPoint, setIsExtraPoint] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (visible) {
      if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].id);
      }
      setDate(initialDate || getLocalDateString());
      setStartMinutes(480);
      setDurationMinutes(60);
      setExamType('Prova');
      setAlerts([1440, 10080]);
      setCustomAlertVal('');
      setCustomAlertUnit(1);
      setShowCalendar(false);
      setWeight('1');
      setMaxGrade('10');
      setIsExtraPoint(false);
      setShowAdvanced(false);
    }
  }, [visible, initialDate, subjects]);

  // Herança de horário da matéria
  useEffect(() => {
    if (!visible || !date || !selectedSubjectId) return;
    
    const targetDay = new Date(date + 'T12:00:00').getDay();
    const classEvent = events.find(e => 
      e.subjectId === selectedSubjectId && 
      e.recurrence === 'weekly' && 
      new Date(e.date + 'T12:00:00').getDay() === targetDay
    );

    if (classEvent) {
      const [h, m] = (classEvent.startTime || '08:00').split(':').map(Number);
      setStartMinutes((h || 0) * 60 + (m || 0));
      
      const [eh, em] = (classEvent.endTime || '10:00').split(':').map(Number);
      const diff = ((eh || 0) * 60 + (em || 0)) - ((h || 0) * 60 + (m || 0));
      if (diff > 0) {
        setDurationMinutes(diff);
      }
    }
  }, [date, selectedSubjectId, visible, events]);

  const formatTime = (totalMinutes: number) => {
    const total = totalMinutes % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatDuration = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`;
    return `${m} minutos`;
  };

  const toggleAlert = (val: number) => {
    Haptics.selectionAsync();
    if (alerts.includes(val)) {
      setAlerts(alerts.filter(a => a !== val));
    } else {
      setAlerts([...alerts, val]);
    }
  };

  const handleSave = () => {
    if (!selectedSubjectId || !date) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const subject = subjects.find(s => s.id === selectedSubjectId);
    if (!subject) return;

    let nextNum = 1;
    const prefix = examType === 'Prova' ? 'P' : 'T';
    
    events.forEach(e => {
      if (e.subjectId === selectedSubjectId && e.category === 'Provas/Trabalhos') {
        const match = e.title.match(new RegExp(`^${prefix}(\\d+)`));
        if (match) {
          const num = parseInt(match[1]);
          if (num >= nextNum) nextNum = num + 1;
        }
      }
    });

    const autoTitle = `${prefix}${nextNum} - ${subject.name}`;

    const newEvent: AppEvent = {
      id: generateId('evt_eval'),
      title: autoTitle,
      category: 'Provas/Trabalhos',
      date,
      startTime: formatTime(startMinutes),
      endTime: formatTime(startMinutes + durationMinutes),
      recurrence: 'none',
      alerts: alerts,
      isCompleted: false,
      isImportant: true,
      isNotified: alerts.length > 0,
      subjectId: subject.id,
      weight: parseFloat(weight) || 1,
      maxGrade: parseFloat(maxGrade) || 10,
      isExtraPoint,
    };

    onSave(newEvent);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerActionBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nova Avaliação</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerActionBtn, { opacity: (!selectedSubjectId || !date) ? 0.4 : 1 }]}
            activeOpacity={0.7}
            disabled={!selectedSubjectId || !date}
          >
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {subjects.length === 0 ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>📚</Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
                Você precisa cadastrar uma Matéria/Aula primeiro antes de agendar provas ou trabalhos.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Matéria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                {subjects.map(sub => {
                  const isSelected = selectedSubjectId === sub.id;
                  const chipColor = sub.color || colors.primary;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.badge,
                        { 
                          backgroundColor: isSelected ? chipColor : colors.surfaceSubtle, 
                          borderColor: isSelected ? chipColor : colors.border, 
                          borderWidth: 1 
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSubjectId(sub.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isSelected ? getContrastTextColor(chipColor) : colors.text,
                        fontWeight: '700'
                      }}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.label}>Tipo de Avaliação</Text>
              <View style={[styles.row, { marginBottom: 18 }]}>
                {['Prova', 'Trabalho'].map(type => {
                  const isSelected = examType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.badge,
                        { 
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle, 
                          borderColor: isSelected ? colors.primary : colors.border, 
                          borderWidth: 1,
                          flex: 1,
                          alignItems: 'center'
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExamType(type as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isSelected ? getContrastTextColor(colors.primary) : colors.text,
                        fontWeight: '700'
                      }}>
                        {type === 'Prova' ? '📝 Prova' : '📁 Trabalho'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Data</Text>
              {isDateLocked ? (
                <View style={[styles.input, { backgroundColor: colors.surfaceSubtle, opacity: 0.8 }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{date.split('-').reverse().join('/')} (Bloqueado nesta visão)</Text>
                </View>
              ) : (
                <View>
                  <TouchableOpacity 
                    style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowCalendar(!showCalendar);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{date.split('-').reverse().join('/')}</Text>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>📅 Escolher</Text>
                  </TouchableOpacity>
                  
                  {showCalendar && (
                    <View style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <Calendar
                        current={date}
                        onDayPress={(day: any) => {
                          Haptics.selectionAsync();
                          setDate(day.dateString);
                          setShowCalendar(false);
                        }}
                        markedDates={{
                          [date]: { selected: true, selectedColor: colors.primary, selectedTextColor: getContrastTextColor(colors.primary) }
                        }}
                        theme={{
                          calendarBackground: colors.surface,
                          textSectionTitleColor: colors.textSecondary,
                          dayTextColor: colors.text,
                          monthTextColor: colors.text,
                          arrowColor: colors.primary,
                        }}
                      />
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity 
                style={{ marginBottom: 14, paddingVertical: 6 }} 
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowAdvanced(!showAdvanced);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                  {showAdvanced ? '▲ Ocultar Opções Avançadas' : '⚙️ Opções Avançadas de Notas'}
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <View style={[styles.advancedBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600', fontSize: 13 }}>Peso</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                        placeholder="1"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600', fontSize: 13 }}>Nota Máxima</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={maxGrade}
                        onChangeText={setMaxGrade}
                        placeholder="10"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  
                  <View style={[styles.row, { alignItems: 'center', marginTop: 6 }]}>
                    <Switch
                      value={isExtraPoint}
                      onValueChange={(val) => {
                        Haptics.selectionAsync();
                        setIsExtraPoint(val);
                      }}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={isExtraPoint ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={{ color: colors.text, marginLeft: 10, flex: 1, fontWeight: '700', fontSize: 13 }}>
                      Ponto Extra (Soma direto na média)
                    </Text>
                  </View>
                </View>
              )}

              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 18, padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.label, { marginBottom: 4, marginTop: 0 }]}>Horário Herdado</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Baseado no horário da matéria</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 17 }}>
                    {formatTime(startMinutes)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    Duração: {formatDuration(durationMinutes)}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Notificações & Lembretes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.horizontalScroll, { marginBottom: 15 }]}>
                {ALERT_OPTIONS.map(option => {
                  const isSelected = alerts.includes(option.value);
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.badge,
                        { 
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle, 
                          borderColor: isSelected ? colors.primary : colors.border, 
                          borderWidth: 1 
                        }
                      ]}
                      onPress={() => toggleAlert(option.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isSelected ? getContrastTextColor(colors.primary) : colors.text,
                        fontWeight: '700'
                      }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  cancelText: {
    fontSize: 15,
    color: colors.danger,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  content: {
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  horizontalScroll: {
    flexDirection: 'row',
  },
  advancedBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  }
});

