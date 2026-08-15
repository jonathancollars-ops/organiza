import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { Calendar } from 'react-native-calendars';
import { AppEvent, ThemeType, Subject } from '../types';
import { getThemeColors, CategoryColors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (event: AppEvent) => void;
  subjects: Subject[];
  events: AppEvent[]; // Adicionado para buscar horários
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

  // Initialize values when opened
  useEffect(() => {
    if (visible) {
      if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].id);
      }
      setDate(initialDate || new Date().toISOString().split('T')[0]);
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
      const [h, m] = classEvent.startTime.split(':').map(Number);
      setStartMinutes(h * 60 + m);
      
      const [eh, em] = classEvent.endTime.split(':').map(Number);
      const diff = (eh * 60 + em) - (h * 60 + m);
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
    if (alerts.includes(val)) {
      setAlerts(alerts.filter(a => a !== val));
    } else {
      setAlerts([...alerts, val]);
    }
  };

  const addCustomAlert = () => {
    const val = parseInt(customAlertVal, 10);
    if (!isNaN(val) && val > 0) {
      const totalMin = val * customAlertUnit;
      if (!alerts.includes(totalMin)) {
        setAlerts([...alerts, totalMin]);
      }
    }
    setCustomAlertVal('');
  };

  const handleSave = () => {
    if (!selectedSubjectId || !date) return;

    // Validate if the selected date has a class
    const targetDay = new Date(date + 'T12:00:00').getDay();
    const hasClass = events.some(e => 
      e.subjectId === selectedSubjectId && 
      e.recurrence === 'weekly' && 
      new Date(e.date + 'T12:00:00').getDay() === targetDay
    );

    if (!hasClass) {
      Alert.alert('Dia Inválido', 'Esta matéria não possui aulas no dia da semana selecionado. Por favor, escolha um dia em que há aula.');
      return;
    }

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
      id: Date.now().toString(),
      title: autoTitle,
      category: 'Provas/Trabalhos',
      date,
      startTime: formatTime(startMinutes),
      endTime: formatTime(startMinutes + durationMinutes),
      recurrence: 'none',
      alerts: alerts,
      isCompleted: false,
      isImportant: true, // Exams are important by default
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nova Avaliação</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {subjects.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Você precisa cadastrar uma Matéria/Aula primeiro antes de adicionar provas.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Matéria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {subjects.map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.badge,
                      { 
                        backgroundColor: selectedSubjectId === sub.id ? colors.primary : 'transparent', 
                        borderColor: colors.primary, 
                        borderWidth: 1 
                      }
                    ]}
                    onPress={() => setSelectedSubjectId(sub.id)}
                  >
                    <Text style={{ color: selectedSubjectId === sub.id ? '#000' : colors.text }}>{sub.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Tipo de Avaliação</Text>
              <View style={[styles.row, { marginBottom: 20 }]}>
                {['Prova', 'Trabalho'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.badge,
                      { 
                        backgroundColor: examType === type ? colors.primary : 'transparent', 
                        borderColor: colors.primary, 
                        borderWidth: 1 
                      }
                    ]}
                    onPress={() => setExamType(type as any)}
                  >
                    <Text style={{ color: examType === type ? '#000' : colors.text }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Data</Text>
              {isDateLocked ? (
                <View style={[styles.input, { backgroundColor: colors.background, opacity: 0.7 }]}>
                  <Text style={{ color: colors.text }}>{date.split('-').reverse().join('/')} (Bloqueado nesta visão)</Text>
                </View>
              ) : (
                <View>
                  <TouchableOpacity 
                    style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                    onPress={() => setShowCalendar(!showCalendar)}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>{date.split('-').reverse().join('/')}</Text>
                    <Text style={{ color: colors.primary }}>📅 Escolher</Text>
                  </TouchableOpacity>
                  
                  {showCalendar && (
                    <View style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <Calendar
                        current={date}
                        onDayPress={(day: any) => {
                          const targetDay = new Date(day.dateString + 'T12:00:00').getDay();
                          const hasClass = events.some(e => 
                            e.subjectId === selectedSubjectId && 
                            e.recurrence === 'weekly' && 
                            new Date(e.date + 'T12:00:00').getDay() === targetDay
                          );
                          if (!hasClass) {
                            Alert.alert('Dia Inválido', 'Esta matéria não possui aulas neste dia da semana.');
                            return;
                          }
                          setDate(day.dateString);
                          setShowCalendar(false);
                        }}
                        markedDates={{
                          [date]: { selected: true, selectedColor: colors.primary, selectedTextColor: '#000' }
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
                style={{ marginBottom: 15, paddingVertical: 5 }} 
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                  {showAdvanced ? 'Ocultar Opções Avançadas' : '⚙️ Opções Avançadas de Notas'}
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>Peso</Text>
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
                      <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>Nota Máxima</Text>
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
                  
                  <View style={[styles.row, { alignItems: 'center', marginBottom: 20 }]}>
                    <Switch
                      value={isExtraPoint}
                      onValueChange={setIsExtraPoint}
                      trackColor={{ true: colors.primary }}
                      thumbColor={isExtraPoint ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={{ color: colors.text, marginLeft: 10, flex: 1 }}>É Ponto Extra? (Soma direto na média)</Text>
                  </View>
                </>
              )}

              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 20, padding: 15, backgroundColor: colors.surface, borderRadius: 12 }]}>
                <View>
                  <Text style={[styles.label, { marginBottom: 5, marginTop: 0 }]}>Horário Herdados</Text>
                  <Text style={{ color: colors.textSecondary }}>O horário será o mesmo da aula.</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>
                    {formatTime(startMinutes)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    Duração: {formatDuration(durationMinutes)}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Notificações</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.horizontalScroll, { marginBottom: 15 }]}>
                {ALERT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.badge,
                      { 
                        backgroundColor: alerts.includes(option.value) ? colors.primary : 'transparent', 
                        borderColor: colors.primary, 
                        borderWidth: 1 
                      }
                    ]}
                    onPress={() => toggleAlert(option.value)}
                  >
                    <Text style={{ color: alerts.includes(option.value) ? '#000' : colors.text }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13 }}>Personalizado:</Text>
              <View style={[styles.row, { marginBottom: 15, alignItems: 'center' }]}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10, color: colors.text, borderColor: colors.border }]}
                  placeholder="Ex: 5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={customAlertVal}
                  onChangeText={setCustomAlertVal}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 10 }}>
                  <TouchableOpacity 
                    style={[styles.badge, { backgroundColor: customAlertUnit === 1 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                    onPress={() => setCustomAlertUnit(1)}
                  >
                    <Text style={{ color: customAlertUnit === 1 ? '#000' : colors.text }}>Min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.badge, { backgroundColor: customAlertUnit === 60 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                    onPress={() => setCustomAlertUnit(60)}
                  >
                    <Text style={{ color: customAlertUnit === 60 ? '#000' : colors.text }}>Hora</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.badge, { backgroundColor: customAlertUnit === 1440 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                    onPress={() => setCustomAlertUnit(1440)}
                  >
                    <Text style={{ color: customAlertUnit === 1440 ? '#000' : colors.text }}>Dia</Text>
                  </TouchableOpacity>
                </ScrollView>
                <TouchableOpacity 
                  style={[styles.badge, { backgroundColor: colors.primary, justifyContent: 'center', height: 44, borderRadius: 8, marginRight: 0 }]} 
                  onPress={addCustomAlert}
                >
                  <Text style={{ color: '#000', fontWeight: 'bold' }}>+</Text>
                </TouchableOpacity>
              </View>

              {alerts.filter(a => !ALERT_OPTIONS.find(o => o.value === a)).length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {alerts.filter(a => !ALERT_OPTIONS.find(o => o.value === a)).map(val => {
                    let label = `${val} min`;
                    if (val % 1440 === 0) label = `${val/1440} dia(s)`;
                    else if (val % 60 === 0) label = `${val/60} hora(s)`;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.badge, { backgroundColor: colors.surface, borderColor: '#ef4444', borderWidth: 1, marginRight: 8, marginBottom: 8 }]}
                        onPress={() => toggleAlert(val)}
                      >
                        <Text style={{ color: '#ef4444' }}>{label} ✕</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ height: 40 }} />
            </>
          )}
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
    color: colors.text,
  },
  cancelText: {
    fontSize: 16,
    color: '#ef4444',
  },
  saveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 15,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  horizontalScroll: {
    flexDirection: 'row',
  }
});
