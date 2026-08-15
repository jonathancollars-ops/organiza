import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Subject, AppEvent, ThemeType } from '../types';
import { getThemeColors, CategoryColors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (subject: Subject, events: AppEvent[]) => void;
  theme: ThemeType;
}

const DAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

const ALERT_OPTIONS = [
  { label: 'Na hora', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
  { label: '1 semana antes', value: 10080 },
];

export const SubjectModal: React.FC<Props> = ({ visible, onClose, onSave, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [name, setName] = useState('');
  const [classDuration, setClassDuration] = useState(50);
  const [classCount, setClassCount] = useState(2);
  const [selectedDays, setSelectedDays] = useState<{ [dayId: number]: { h: number; m: number } }>({});
  
  const [alerts, setAlerts] = useState<number[]>([0]);
  const [customAlertVal, setCustomAlertVal] = useState('');
  const [customAlertUnit, setCustomAlertUnit] = useState<number>(1);
  const [passGrade, setPassGrade] = useState(7.0);

  const weeklyClasses = classCount * Object.keys(selectedDays).length;
  const maxAbsences = weeklyClasses * 5; // Assumindo semestre de 20 semanas (25% = 5)

  React.useEffect(() => {
    if (visible) {
      setName('');
      setClassDuration(50);
      setClassCount(2);
      setSelectedDays({});
      setAlerts([0]);
      setCustomAlertVal('');
      setCustomAlertUnit(1);
      setPassGrade(7.0);
    }
  }, [visible]);

  const toggleDay = (dayId: number) => {
    const newDays = { ...selectedDays };
    if (newDays[dayId] !== undefined) {
      delete newDays[dayId];
    } else {
      newDays[dayId] = { h: 8, m: 0 };
    }
    setSelectedDays(newDays);
  };

  const updateDayTime = (dayId: number, field: 'h' | 'm', value: number) => {
    setSelectedDays({
      ...selectedDays,
      [dayId]: { ...selectedDays[dayId], [field]: value }
    });
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
    if (!name.trim() || Object.keys(selectedDays).length === 0) return;

    // Generate random distinct color (HSL provides more vibrant/distinct results)
    const randomColor = `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;

    const subject: Subject = {
      id: Date.now().toString(),
      name,
      color: randomColor,
      passGrade,
      workloadHours: weeklyClasses,
      maxAbsences
    };

    const events: AppEvent[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    const totalDurationMinutes = classDuration * classCount;

    Object.entries(selectedDays).forEach(([dayStr, timeObj]) => {
      const dayId = parseInt(dayStr, 10);
      
      let dateCursor = new Date(today);
      while (dateCursor.getDay() !== dayId) {
        dateCursor.setDate(dateCursor.getDate() + 1);
      }
      const dateStr = dateCursor.toISOString().split('T')[0];

      const startMinutes = timeObj.h * 60 + timeObj.m;
      const endMinutes = startMinutes + totalDurationMinutes;

      const formatTime = (mins: number) => {
        const h = Math.floor((mins % 1440) / 60);
        const m = (mins % 1440) % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      events.push({
        id: Date.now().toString() + Math.random().toString(),
        title: name,
        category: 'Faculdade/Aulas',
        date: dateStr,
        startTime: formatTime(startMinutes),
        endTime: formatTime(endMinutes),
        recurrence: 'weekly',
        alerts: alerts,
        isCompleted: false,
        isImportant: false,
        isNotified: alerts.length > 0,
        subjectId: subject.id,
      });
    });

    onSave(subject, events);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nova Matéria / Aula</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.label}>Nome da Matéria</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Cálculo I"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Carga Horária (Semana)</Text>
              <View style={[styles.input, { paddingVertical: 0, justifyContent: 'center' }]}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                  {weeklyClasses} {weeklyClasses === 1 ? 'tempo' : 'tempos'}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: -10 }}>
                Máx. de faltas: {maxAbsences} (25%)
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Média para Passar</Text>
              <View style={[styles.input, { paddingVertical: 0, justifyContent: 'center' }]}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                  {passGrade.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={{ marginBottom: 20 }}>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={5}
              maximumValue={10}
              step={0.1}
              value={passGrade}
              onValueChange={setPassGrade}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Duração de cada tempo</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>
                {classDuration} min
              </Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={30}
              maximumValue={120}
              step={5}
              value={classDuration}
              onValueChange={setClassDuration}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>

          <View style={{ marginBottom: 20 }}>
            <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Quantidade de tempos</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>
                {classCount}
              </Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={6}
              step={1}
              value={classCount}
              onValueChange={setClassCount}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <Text style={{ color: colors.textSecondary, marginTop: 5, fontSize: 13 }}>
              Duração total da aula: {(classDuration * classCount) / 60 >= 1 ? `${Math.floor((classDuration * classCount) / 60)}h ` : ''}{(classDuration * classCount) % 60}m
            </Text>
          </View>

          <Text style={styles.label}>Dias da Semana</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {DAYS.map(day => {
              const isSelected = selectedDays[day.id] !== undefined;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.badge,
                    { 
                      backgroundColor: isSelected ? colors.primary : 'transparent', 
                      borderColor: colors.primary, 
                      borderWidth: 1 
                    }
                  ]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text style={{ color: isSelected ? '#000' : colors.text }}>{day.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {Object.entries(selectedDays).map(([dayStr, timeObj]) => {
            const dayId = parseInt(dayStr, 10);
            const dayLabel = DAYS.find(d => d.id === dayId)?.label;
            return (
              <View key={dayId} style={{ marginBottom: 20, padding: 15, backgroundColor: colors.surface, borderRadius: 12 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>
                  Horário ({dayLabel})
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: colors.text, width: 40 }}>Hora</Text>
                  <Slider
                    style={{ flex: 1, height: 40 }}
                    minimumValue={0}
                    maximumValue={23}
                    step={1}
                    value={timeObj.h}
                    onValueChange={(val) => updateDayTime(dayId, 'h', val)}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <Text style={{ color: colors.primary, fontWeight: 'bold', width: 40, textAlign: 'right' }}>
                    {timeObj.h.toString().padStart(2, '0')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, width: 40 }}>Min</Text>
                  <Slider
                    style={{ flex: 1, height: 40 }}
                    minimumValue={0}
                    maximumValue={59}
                    step={1}
                    value={timeObj.m}
                    onValueChange={(val) => updateDayTime(dayId, 'm', val)}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                  <Text style={{ color: colors.primary, fontWeight: 'bold', width: 40, textAlign: 'right' }}>
                    {timeObj.m.toString().padStart(2, '0')}
                  </Text>
                </View>
              </View>
            );
          })}

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
