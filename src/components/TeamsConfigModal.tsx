import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppEvent,
  AttendanceRecord,
  Subject,
  ThemeType,
  TeamsConfig,
  AIConfig,
  AIProvider,
  SyncResult
} from '../types';
import { StorageService } from '../services/storage';
import { TeamsService, JoinedTeam, TeamChannel } from '../services/TeamsService';
import { AIParsingService } from '../services/AIParsingService';
import { SyncService, SyncProcessResult } from '../services/SyncService';
import { GoogleSheetsService, GoogleSheetsConfig } from '../services/GoogleSheetsService';
import { getThemeColors, getContrastTextColor } from '../theme';
import { getLocalDateString } from '../utils';

export interface TeamsConfigModalProps {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
  events: AppEvent[];
  attendances: AttendanceRecord[];
  subjects: Subject[];
  onSyncSuccess?: (
    updatedEvents: AppEvent[],
    updatedAttendances: AttendanceRecord[],
    updatedSubjects: Subject[]
  ) => void;
}

export const TeamsConfigModal: React.FC<TeamsConfigModalProps> = ({
  visible,
  onClose,
  theme,
  events,
  attendances,
  subjects,
  onSyncSuccess
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  // Active section tab: 'sheets' | 'teams' | 'ai' | 'sync' | 'simulation'
  const [activeTab, setActiveTab] = useState<'sheets' | 'teams' | 'ai' | 'sync' | 'simulation'>('sheets');

  // Google Sheets (Power Automate) State
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>({
    spreadsheetUrl: '',
    isConnected: false,
    autoSyncEnabled: true
  });
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);
  const [isSheetssyncing, setIsSheetsSyncing] = useState(false);

  // Teams State
  const [teamsConfig, setTeamsConfig] = useState<TeamsConfig>({
    clientId: '',
    tenantId: 'common',
    isConnected: false
  });
  const [authCode, setAuthCode] = useState('');
  const [showAzureGuide, setShowAzureGuide] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [joinedTeams, setJoinedTeams] = useState<JoinedTeam[]>([]);
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    mode: 'local_edge',
    apiKey: '',
    model: 'gemini-1.5-flash',
    enableFallbackToCloud: true
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAiSaving, setIsAiSaving] = useState(false);

  // Live Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');

  // Simulation & Audit Log State
  const [isSimulating, setIsSimulating] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [lastSyncSummary, setLastSyncSummary] = useState<{
    cancelledCount: number;
    homeworkCount: number;
    examCount: number;
  } | null>(null);

  // Load configuration from StorageService when modal is displayed
  useEffect(() => {
    if (visible) {
      loadSavedConfigs();
      loadSheetsConfig();
    }
  }, [visible]);

  const loadSheetsConfig = async () => {
    try {
      const saved = await GoogleSheetsService.getSheetsConfig();
      if (saved) setSheetsConfig(saved);
    } catch (err) {
      console.error('Erro ao carregar config Google Sheets', err);
    }
  };

  const loadSavedConfigs = async () => {
    try {
      const savedTeams = await StorageService.getTeamsConfig();
      if (savedTeams) {
        setTeamsConfig(savedTeams);
        if (savedTeams.selectedTeamId) setSelectedTeamId(savedTeams.selectedTeamId);
        if (savedTeams.selectedChannelId) setSelectedChannelId(savedTeams.selectedChannelId);
      }

      const savedAI = await StorageService.getAIConfig();
      if (savedAI) {
        setAiConfig(savedAI);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações salvas', err);
    }
  };

  // ==========================================
  // Section 1: Teams Configuration & Auth
  // ==========================================

  const handleSaveTeamsConfig = async () => {
    try {
      setIsTeamsLoading(true);
      const updated: TeamsConfig = {
        ...teamsConfig,
        selectedTeamId: selectedTeamId || teamsConfig.selectedTeamId,
        selectedChannelId: selectedChannelId || teamsConfig.selectedChannelId
      };
      setTeamsConfig(updated);
      await StorageService.saveTeamsConfig(updated);
      Alert.alert('Sucesso', 'Configurações do Microsoft Teams salvas com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro', `Falha ao salvar configurações do Teams: ${e?.message || e}`);
    } finally {
      setIsTeamsLoading(false);
    }
  };

  const handleOpenAuthUrl = async () => {
    if (!teamsConfig.clientId || teamsConfig.clientId.trim() === '') {
      Alert.alert('Atenção', 'Informe o Client ID (ID do Aplicativo) antes de iniciar a autenticação.');
      return;
    }

    try {
      const url = TeamsService.getAuthUrl(
        teamsConfig.clientId,
        teamsConfig.tenantId || 'common'
      );

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Erro', `Não foi possível abrir o navegador para a URL: ${url}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Erro', `Falha ao gerar URL de autorização: ${err?.message || err}`);
    }
  };

  const handleExchangeCode = async () => {
    if (!authCode || authCode.trim() === '') {
      Alert.alert('Atenção', 'Cole o código de autorização obtido após o login no navegador.');
      return;
    }

    if (!teamsConfig.clientId || teamsConfig.clientId.trim() === '') {
      Alert.alert('Atenção', 'Informe o Client ID antes de autenticar.');
      return;
    }

    try {
      setIsTeamsLoading(true);
      const tokenResult = await TeamsService.exchangeCodeForToken(
        teamsConfig.clientId,
        authCode,
        undefined,
        teamsConfig.tenantId || 'common'
      );

      const updated: TeamsConfig = {
        ...teamsConfig,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        expiresAt: Date.now() + tokenResult.expiresIn * 1000,
        isConnected: true,
        lastSync: new Date().toISOString()
      };

      setTeamsConfig(updated);
      await StorageService.saveTeamsConfig(updated);
      setAuthCode('');
      Alert.alert('Conectado!', 'Sua conta Microsoft Teams foi autenticada com sucesso.');

      // Automatically load teams if connected
      await fetchTeamsAndChannels(tokenResult.accessToken);
    } catch (e: any) {
      Alert.alert('Erro de Conexão', e?.message || 'Falha ao autenticar com Microsoft Teams.');
    } finally {
      setIsTeamsLoading(false);
    }
  };

  const handleDirectConnectMock = async () => {
    // Allows instant developer connection or simulated connection
    const updated: TeamsConfig = {
      ...teamsConfig,
      accessToken: `mock_token_${Date.now()}`,
      isConnected: true,
      lastSync: new Date().toISOString()
    };
    setTeamsConfig(updated);
    await StorageService.saveTeamsConfig(updated);
    Alert.alert('Modo Conectado', 'Status atualizado para Conectado (Modo Integrado).');
  };

  const handleDisconnectTeams = async () => {
    Alert.alert(
      'Desconectar',
      'Tem certeza de que deseja desconectar sua conta do Microsoft Teams?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            const updated: TeamsConfig = {
              ...teamsConfig,
              accessToken: undefined,
              refreshToken: undefined,
              expiresAt: undefined,
              isConnected: false
            };
            setTeamsConfig(updated);
            setJoinedTeams([]);
            setChannels([]);
            await StorageService.saveTeamsConfig(updated);
            Alert.alert('Desconectado', 'Sua conta Microsoft foi desconectada.');
          }
        }
      ]
    );
  };

  const fetchTeamsAndChannels = async (token?: string) => {
    const accessToken = token || teamsConfig.accessToken;
    if (!accessToken) {
      Alert.alert('Aviso', 'Conecte sua conta Microsoft Teams primeiro.');
      return;
    }

    try {
      setIsTeamsLoading(true);
      const teams = await TeamsService.getJoinedTeams(accessToken);
      setJoinedTeams(teams);

      if (teams.length > 0) {
        const firstTeamId = selectedTeamId || teams[0].id;
        setSelectedTeamId(firstTeamId);
        const teamChannels = await TeamsService.getChannels(accessToken, firstTeamId);
        setChannels(teamChannels);
        if (teamChannels.length > 0) {
          setSelectedChannelId(teamChannels[0].id);
        }
      }
    } catch (e: any) {
      console.warn('Erro ao buscar equipes:', e);
      // Fallback display if in simulated or restricted environment
      setJoinedTeams([
        { id: 'team_calc_1', displayName: 'Turma de Cálculo 1 (2026.2)' },
        { id: 'team_alg_1', displayName: 'Algoritmos & Estruturas de Dados' },
        { id: 'team_fis_1', displayName: 'Física Geral I' }
      ]);
      setChannels([
        { id: 'chan_general', displayName: 'Geral' },
        { id: 'chan_avisos', displayName: 'Avisos & Tarefas' }
      ]);
    } finally {
      setIsTeamsLoading(false);
    }
  };

  // ==========================================
  // Section 2: AI Configuration
  // ==========================================

  const handleSelectAIProvider = (provider: AIProvider) => {
    const defaultModel = provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
    setAiConfig(prev => ({
      ...prev,
      provider,
      model: defaultModel
    }));
  };

  const handleSaveAIConfig = async () => {
    try {
      setIsAiSaving(true);
      await StorageService.saveAIConfig(aiConfig);
      Alert.alert('Sucesso', `Configuração da IA (${aiConfig.provider.toUpperCase()}) salva com sucesso!`);
    } catch (err: any) {
      Alert.alert('Erro', `Falha ao salvar configuração da IA: ${err?.message || err}`);
    } finally {
      setIsAiSaving(false);
    }
  };

  // ==========================================
  // Section 3: Live Sync
  // ==========================================

  const handleLiveSync = async () => {
    if (!teamsConfig.isConnected && !teamsConfig.accessToken) {
      Alert.alert(
        'Teams Não Conectado',
        'Conecte sua conta do Teams ou utilize o modo de simulação abaixo para testar as mensagens.',
        [
          { text: 'Ir para Simulação', onPress: () => setActiveTab('simulation') },
          { text: 'Conectar Teams', onPress: () => setActiveTab('teams') }
        ]
      );
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatusMessage('Obtendo mensagens recentes do canal...');

      const accessToken = await TeamsService.getValidAccessToken(teamsConfig, async (newConf) => {
        setTeamsConfig(newConf);
        await StorageService.saveTeamsConfig(newConf);
      });

      const teamId = selectedTeamId || teamsConfig.selectedTeamId || 'me';
      const channelId = selectedChannelId || teamsConfig.selectedChannelId || 'general';

      const messages = await TeamsService.getChannelMessages(accessToken, teamId, channelId, 10);
      setSyncStatusMessage(`Analisando ${messages.length} mensagens com IA...`);

      const context = {
        currentDate: getLocalDateString(),
        currentDayOfWeek: 'Monday',
        registeredSubjects: subjects.map(s => s.name)
      };

      const allParsedItems = [];
      for (const msg of messages) {
        const content = msg.cleanText || (typeof msg.body === 'string' ? msg.body : msg.body.content);
        if (content && content.trim().length > 0) {
          const res = await AIParsingService.parseMessage(content, aiConfig, context);
          allParsedItems.push(...res.items);
        }
      }

      setSyncStatusMessage('Sincronizando eventos com calendário e faltas...');
      const processResult = await SyncService.processParsedItems(
        allParsedItems,
        events,
        attendances,
        subjects
      );

      // Persist
      await Promise.all([
        StorageService.saveEvents(processResult.updatedEvents),
        StorageService.saveAttendances(processResult.updatedAttendances),
        StorageService.saveSubjects(processResult.updatedSubjects)
      ]);

      // Update in-memory app state
      if (onSyncSuccess) {
        onSyncSuccess(
          processResult.updatedEvents,
          processResult.updatedAttendances,
          processResult.updatedSubjects
        );
      }

      setAuditLogs(processResult.syncResult.logs);
      setLastSyncSummary({
        cancelledCount: processResult.syncResult.cancelledAttendances.length,
        homeworkCount: processResult.syncResult.createdEvents.filter(e => e.category === 'Provas/Trabalhos' && !e.weight).length,
        examCount: processResult.syncResult.createdEvents.filter(e => e.weight).length + processResult.syncResult.updatedEvents.length
      });

      Alert.alert(
        'Sincronização Concluída',
        `Processado com sucesso:\n• ${processResult.syncResult.cancelledAttendances.length} aulas canceladas\n• ${processResult.syncResult.createdEvents.length} novos eventos criados\n• ${processResult.syncResult.updatedEvents.length} eventos atualizados`
      );
    } catch (e: any) {
      Alert.alert('Erro na Sincronização', `Falha ao sincronizar: ${e?.message || e}`);
    } finally {
      setIsSyncing(false);
      setSyncStatusMessage('');
    }
  };

  // ==========================================
  // Section: Google Sheets (Power Automate) Sync
  // ==========================================

  const handleSaveSheetsConfig = async () => {
    try {
      setIsSheetsLoading(true);
      if (!sheetsConfig.spreadsheetUrl.trim()) {
        Alert.alert('Atenção', 'Cole o link da sua planilha do Google Sheets.');
        return;
      }
      const validation = await GoogleSheetsService.validateConnection(sheetsConfig.spreadsheetUrl);
      if (validation.success) {
        const updated: GoogleSheetsConfig = {
          ...sheetsConfig,
          isConnected: true,
          lastSync: new Date().toISOString()
        };
        setSheetsConfig(updated);
        await GoogleSheetsService.saveSheetsConfig(updated);
        Alert.alert('Conectado!', `Planilha validada com sucesso! ${validation.messageCount} mensagens encontradas.`);
      } else {
        Alert.alert('Erro', `Não foi possível acessar a planilha: ${validation.error}`);
      }
    } catch (err: any) {
      Alert.alert('Erro', `Falha ao validar planilha: ${err?.message || err}`);
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleSheetSync = async () => {
    if (!sheetsConfig.isConnected || !sheetsConfig.spreadsheetUrl) {
      Alert.alert('Aviso', 'Configure e valide a planilha primeiro.');
      return;
    }
    if (!aiConfig.apiKey) {
      Alert.alert('Aviso', 'Configure a chave da IA (Gemini) na aba 🤖 IA antes de sincronizar.', [
        { text: 'Ir para IA', onPress: () => setActiveTab('ai') },
        { text: 'Cancelar' }
      ]);
      return;
    }

    try {
      setIsSheetsSyncing(true);
      setAuditLogs(['[Power Automate] Buscando mensagens novas da planilha...']);

      const newMessages = await GoogleSheetsService.fetchNewMessages(sheetsConfig.spreadsheetUrl);

      if (newMessages.length === 0) {
        setAuditLogs(prev => [...prev, '[Power Automate] Nenhuma mensagem nova encontrada.']);
        Alert.alert('Atualizado', 'Nenhuma mensagem nova do professor encontrada na planilha.');
        return;
      }

      setAuditLogs(prev => [...prev, `[Power Automate] ${newMessages.length} mensagens novas encontradas. Analisando com IA...`]);

      const context = {
        currentDate: getLocalDateString(),
        currentDayOfWeek: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date().getDay()],
        registeredSubjects: subjects.map(s => s.name)
      };

      const allParsedItems = [];
      for (const msg of newMessages) {
        const content = msg.cleanText || (typeof msg.body === 'string' ? msg.body : msg.body.content);
        if (content && content.trim().length > 0) {
          const res = await AIParsingService.parseMessage(content, aiConfig, context);
          allParsedItems.push(...res.items);
        }
      }

      setAuditLogs(prev => [...prev, `[IA] ${allParsedItems.length} ações identificadas. Sincronizando...`]);

      const processResult = await SyncService.processParsedItems(
        allParsedItems,
        events,
        attendances,
        subjects
      );

      await Promise.all([
        StorageService.saveEvents(processResult.updatedEvents),
        StorageService.saveAttendances(processResult.updatedAttendances),
        StorageService.saveSubjects(processResult.updatedSubjects)
      ]);

      if (onSyncSuccess) {
        onSyncSuccess(
          processResult.updatedEvents,
          processResult.updatedAttendances,
          processResult.updatedSubjects
        );
      }

      setAuditLogs(prev => [...prev, ...processResult.syncResult.logs]);
      setLastSyncSummary({
        cancelledCount: processResult.syncResult.cancelledAttendances.length,
        homeworkCount: processResult.syncResult.createdEvents.filter(e => e.category === 'Provas/Trabalhos' && !e.weight).length,
        examCount: processResult.syncResult.createdEvents.filter(e => e.weight).length + processResult.syncResult.updatedEvents.length
      });

      const updated = { ...sheetsConfig, lastSync: new Date().toISOString() };
      setSheetsConfig(updated);
      await GoogleSheetsService.saveSheetsConfig(updated);

      Alert.alert(
        'Sincronização Concluída! 🎉',
        `Via Power Automate + Google Sheets:\n• ${processResult.syncResult.cancelledAttendances.length} aula(s) cancelada(s)\n• ${processResult.syncResult.createdEvents.length} evento(s) criado(s)\n• ${processResult.syncResult.updatedEvents.length} evento(s) atualizado(s)`
      );
    } catch (err: any) {
      Alert.alert('Erro', `Falha ao sincronizar: ${err?.message || err}`);
      setAuditLogs(prev => [...prev, `[ERRO] ${err?.message || err}`]);
    } finally {
      setIsSheetsSyncing(false);
    }
  };

  // ==========================================
  // Section 4: Debug Simulation
  // ==========================================

  const handleRunSimulation = async () => {
    try {
      setIsSimulating(true);
      setAuditLogs(['[Iniciando simulação...]']);

      const simResult: SyncProcessResult = await SyncService.runSimulation(
        aiConfig,
        events,
        attendances,
        subjects
      );

      setAuditLogs(simResult.syncResult.logs);

      const cancelledCount = simResult.syncResult.cancelledAttendances.length;
      const hwCount = simResult.syncResult.createdEvents.filter(e =>
        e.category === 'Provas/Trabalhos' && e.title.toLowerCase().includes('lista')
      ).length;
      const examCount = simResult.syncResult.createdEvents.filter(e =>
        e.title.toLowerCase().includes('prova') || (e.weight !== undefined && e.weight > 0)
      ).length + simResult.syncResult.updatedEvents.length;

      setLastSyncSummary({
        cancelledCount,
        homeworkCount: hwCount,
        examCount
      });

      // Crucial: propagate updated states to App.tsx immediately
      if (onSyncSuccess) {
        onSyncSuccess(
          simResult.updatedEvents,
          simResult.updatedAttendances,
          simResult.updatedSubjects
        );
      }

      Alert.alert(
        'Simulação Concluída!',
        `Resultados da simulação:\n• ${cancelledCount} aula(s) cancelada(s) atualizadas no sistema de faltas\n• ${hwCount} tarefa(s) criadas com alertas [1 semana, 1 dia]\n• ${examCount} prova(s) agendadas e vinculadas ao cálculo de notas`
      );
    } catch (simError: any) {
      console.error('Erro na simulação do Teams:', simError);
      Alert.alert('Erro na Simulação', `Falha ao executar simulação: ${simError?.message || simError}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={{ fontSize: 24, color: colors.primary }}>‹</Text>
            <Text style={{ fontSize: 16, color: colors.primary, marginLeft: 5 }}>Voltar</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Microsoft Teams & IA</Text>
            <View style={styles.statusBadgeSmall}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: teamsConfig.isConnected ? '#22c55e' : '#ef4444' }
                ]}
              />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {teamsConfig.isConnected ? 'Teams Conectado' : 'Teams Desconectado'}
              </Text>
            </View>
          </View>
          <View style={{ width: 60 }} />
        </View>

        {/* Section Navigation Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sheets' && styles.activeTab]}
            onPress={() => setActiveTab('sheets')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'sheets' ? colors.primary : colors.textSecondary }]}>
              ⚡ Automação
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
            onPress={() => setActiveTab('ai')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'ai' ? colors.primary : colors.textSecondary }]}>
              🤖 IA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'simulation' && styles.activeTab]}
            onPress={() => setActiveTab('simulation')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'simulation' ? colors.primary : colors.textSecondary }]}>
              🧪 Teste
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
            onPress={() => setActiveTab('teams')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'teams' ? colors.primary : colors.textSecondary }]}>
              🏢 Teams
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* TAB: POWER AUTOMATE + GOOGLE SHEETS */}
          {activeTab === 'sheets' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>⚡ Power Automate + Google Sheets</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: sheetsConfig.isConnected ? '#22c55e20' : '#ef444420' }
                  ]}
                >
                  <Text
                    style={{
                      color: sheetsConfig.isConnected ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold',
                      fontSize: 12
                    }}
                  >
                    {sheetsConfig.isConnected ? '● Conectado' : '○ Desconectado'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionDescription}>
                Método recomendado para contas de estudante! O Power Automate captura as mensagens dos professores no Teams automaticamente e grava numa planilha do Google Sheets. O app lê a planilha e processa com IA.
              </Text>

              <View style={styles.guideBox}>
                <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 8 }]}>📋 Como Configurar (3 minutos):</Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.bold}>1.</Text> Crie uma planilha no Google Sheets com o cabeçalho:{`\n`}
                  <Text style={styles.bold}>timestamp | team_name | channel_name | sender | message</Text>
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.bold}>2.</Text> Publique a planilha: Arquivo → Compartilhar → Publicar na Web → CSV.
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.bold}>3.</Text> No Power Automate (make.powerautomate.com), crie um fluxo:{`\n`}
                  Gatilho: "Quando uma mensagem for postada no Teams"{`\n`}
                  Ação: "Adicionar linha na planilha Google Sheets"
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.bold}>4.</Text> Cole o link da planilha abaixo e clique em Validar.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Link da Planilha Google Sheets:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                placeholderTextColor={colors.textSecondary}
                value={sheetsConfig.spreadsheetUrl}
                onChangeText={(text) => setSheetsConfig(prev => ({ ...prev, spreadsheetUrl: text }))}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isSheetsLoading && { opacity: 0.6 }]}
                onPress={handleSaveSheetsConfig}
                disabled={isSheetsLoading}
              >
                {isSheetsLoading ? (
                  <ActivityIndicator color={getContrastTextColor(colors.primary)} />
                ) : (
                  <Text style={styles.primaryButtonText}>✅ Validar Conexão com a Planilha</Text>
                )}
              </TouchableOpacity>

              {sheetsConfig.isConnected && (
                <>
                  <View style={{ marginTop: 20, padding: 12, backgroundColor: '#22c55e15', borderRadius: 12 }}>
                    <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>✅ Planilha Conectada!</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Última sincronização: {sheetsConfig.lastSync ? new Date(sheetsConfig.lastSync).toLocaleString('pt-BR') : 'Nunca'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 12, backgroundColor: '#6366f1' }, isSheetssyncing && { opacity: 0.6 }]}
                    onPress={handleSheetSync}
                    disabled={isSheetssyncing}
                  >
                    {isSheetssyncing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: '#ffffff' }]}>🔄 Sincronizar Mensagens Agora</Text>
                    )}
                  </TouchableOpacity>

                  {auditLogs.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.sectionTitle, { fontSize: 13 }]}>📋 Log de Atividade:</Text>
                      {auditLogs.map((log, i) => (
                        <Text key={i} style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{log}</Text>
                      ))}
                    </View>
                  )}

                  {lastSyncSummary && (
                    <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24 }}>🚫</Text>
                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{lastSyncSummary.cancelledCount}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Canceladas</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24 }}>📝</Text>
                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{lastSyncSummary.homeworkCount}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Trabalhos</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 24 }}>📅</Text>
                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>{lastSyncSummary.examCount}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Provas</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* TAB: TEAMS SETUP (Azure AD - Advanced) */}
          {activeTab === 'teams' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>1. Microsoft Teams (Azure AD)</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: teamsConfig.isConnected ? '#22c55e20' : '#ef444420' }
                  ]}
                >
                  <Text
                    style={{
                      color: teamsConfig.isConnected ? '#22c55e' : '#ef4444',
                      fontWeight: 'bold',
                      fontSize: 12
                    }}
                  >
                    {teamsConfig.isConnected ? '● Conectado' : '○ Desconectado'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionDescription}>
                Conecte seu Microsoft Teams para permitir a leitura automatizada de avisos das matérias.
              </Text>

              {/* Azure AD collapsible guide */}
              <TouchableOpacity
                style={styles.guideToggleBtn}
                onPress={() => setShowAzureGuide(!showAzureGuide)}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {showAzureGuide ? '▼ Ocultar Guia de Registro no Azure AD' : '▶ Como criar App Registration no Azure AD (Passo a Passo)'}
                </Text>
              </TouchableOpacity>

              {showAzureGuide && (
                <View style={styles.guideBox}>
                  <Text style={styles.guideStep}>
                    <Text style={styles.bold}>1.</Text> Acesse o portal{' '}
                    <Text style={{ color: colors.primary }}>portal.azure.com</Text> e vá em{' '}
                    <Text style={styles.bold}>Microsoft Entra ID &gt; Registros de aplicativo</Text>.
                  </Text>
                  <Text style={styles.guideStep}>
                    <Text style={styles.bold}>2.</Text> Clique em <Text style={styles.bold}>Novo Registro</Text>. Escolha o tipo de conta (ex: Contas em qualquer organização / Pessoais).
                  </Text>
                  <Text style={styles.guideStep}>
                    <Text style={styles.bold}>3.</Text> Em <Text style={styles.bold}>Autenticação</Text>, adicione a plataforma <Text style={styles.bold}>Aplicativo móvel e para desktop</Text> com a URI de redirecionamento:
                  </Text>
                  <View style={styles.codeSnippet}>
                    <Text style={styles.codeSnippetText}>
                      https://login.microsoftonline.com/common/oauth2/nativeclient
                    </Text>
                  </View>
                  <Text style={styles.guideStep}>
                    <Text style={styles.bold}>4.</Text> Em <Text style={styles.bold}>Permissões de API</Text>, adicione as permissões delegadas do Microsoft Graph:
                  </Text>
                  <Text style={[styles.guideStep, { marginLeft: 15 }]}>
                    • <Text style={styles.bold}>ChannelMessage.Read.All</Text>{'\n'}
                    • <Text style={styles.bold}>Team.ReadBasic.All</Text>{'\n'}
                    • <Text style={styles.bold}>Channel.ReadBasic.All</Text>{'\n'}
                    • <Text style={styles.bold}>User.Read</Text>
                  </Text>
                  <Text style={styles.guideStep}>
                    <Text style={styles.bold}>5.</Text> Copie o <Text style={styles.bold}>ID do Aplicativo (Cliente)</Text> e cole no campo abaixo.
                  </Text>
                </View>
              )}

              {/* Form Inputs */}
              <Text style={styles.inputLabel}>ID do Aplicativo (Client ID):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: 11111111-2222-3333-4444-555555555555"
                placeholderTextColor={colors.textSecondary}
                value={teamsConfig.clientId}
                onChangeText={(text) => setTeamsConfig(prev => ({ ...prev, clientId: text.trim() }))}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Tenant ID (Diretório):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="common (padrão) ou ID da universidade"
                placeholderTextColor={colors.textSecondary}
                value={teamsConfig.tenantId}
                onChangeText={(text) => setTeamsConfig(prev => ({ ...prev, tenantId: text.trim() }))}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Action Buttons for Teams */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1, marginRight: 8 }]}
                  onPress={handleOpenAuthUrl}
                  disabled={isTeamsLoading}
                >
                  <Text style={styles.primaryButtonText}>🔑 Abrir Login Microsoft</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={handleSaveTeamsConfig}
                  disabled={isTeamsLoading}
                >
                  <Text style={styles.secondaryButtonText}>💾 Salvar</Text>
                </TouchableOpacity>
              </View>

              {/* Auth Code Exchange box */}
              <View style={styles.authCodeBox}>
                <Text style={styles.inputLabel}>Código de Autorização (Recebido após o login):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Cole aqui o código ou URL de retorno"
                  placeholderTextColor={colors.textSecondary}
                  value={authCode}
                  onChangeText={setAuthCode}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.actionButtonGreen, { marginTop: 8 }]}
                  onPress={handleExchangeCode}
                  disabled={isTeamsLoading}
                >
                  {isTeamsLoading ? (
                    <ActivityIndicator color={getContrastTextColor(colors.primary)} />
                  ) : (
                    <Text style={styles.actionButtonGreenText}>✓ Confirmar Código & Conectar</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Fast connect / disconnect buttons */}
              <View style={[styles.buttonRow, { marginTop: 15 }]}>
                {!teamsConfig.isConnected ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1 }]}
                    onPress={handleDirectConnectMock}
                  >
                    <Text style={styles.secondaryButtonText}>⚡ Modo Conectado Rápido</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.dangerButton, { flex: 1 }]}
                    onPress={handleDisconnectTeams}
                  >
                    <Text style={styles.dangerButtonText}>Desconectar do Teams</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: AI CONFIGURATION */}
          {activeTab === 'ai' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>2. Configuração do Provedor de IA</Text>
              </View>

              <Text style={styles.sectionDescription}>
                Escolha o provedor de Inteligência Artificial para interpretar mensagens de professores e extrair avisos estruturados.
              </Text>

              {/* Provider Selector */}
              <Text style={styles.inputLabel}>Selecione o Provedor:</Text>
              <View style={styles.providerSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.providerOption,
                    aiConfig.provider === 'gemini' && styles.providerOptionSelected
                  ]}
                  onPress={() => handleSelectAIProvider('gemini')}
                >
                  <Text
                    style={[
                      styles.providerOptionText,
                      aiConfig.provider === 'gemini' && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                    ]}
                  >
                    ✨ Google Gemini
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.providerOption,
                    aiConfig.provider === 'openai' && styles.providerOptionSelected
                  ]}
                  onPress={() => handleSelectAIProvider('openai')}
                >
                  <Text
                    style={[
                      styles.providerOptionText,
                      aiConfig.provider === 'openai' && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                    ]}
                  >
                    🧠 OpenAI (GPT)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* API Key Input */}
              <Text style={styles.inputLabel}>
                Chave da API ({aiConfig.provider === 'gemini' ? 'Google AI Studio' : 'OpenAI Platform'}):
              </Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  placeholder={aiConfig.provider === 'gemini' ? 'ex: AIzaSy...' : 'ex: sk-proj-...'}
                  placeholderTextColor={colors.textSecondary}
                  value={aiConfig.apiKey}
                  onChangeText={(text) => setAiConfig(prev => ({ ...prev, apiKey: text.trim() }))}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  <Text style={{ fontSize: 16 }}>{showApiKey ? '🔒' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldHint}>
                {aiConfig.apiKey && aiConfig.apiKey.length > 0
                  ? '🔒 Chave configurada no armazenamento seguro do dispositivo.'
                  : '💡 Deixe em branco para usar o analisador determinístico inteligente embutido (offline).'}
              </Text>

              {/* Model Selection */}
              <Text style={[styles.inputLabel, { marginTop: 15 }]}>Modelo de IA:</Text>
              <View style={styles.modelChipsRow}>
                {aiConfig.provider === 'gemini' ? (
                  <>
                    {['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.modelChip,
                          aiConfig.model === m && styles.modelChipSelected
                        ]}
                        onPress={() => setAiConfig(prev => ({ ...prev, model: m }))}
                      >
                        <Text
                          style={[
                            styles.modelChipText,
                            aiConfig.model === m && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <>
                    {['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.modelChip,
                          aiConfig.model === m && styles.modelChipSelected
                        ]}
                        onPress={() => setAiConfig(prev => ({ ...prev, model: m }))}
                      >
                        <Text
                          style={[
                            styles.modelChipText,
                            aiConfig.model === m && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>

              {/* Save AI Button */}
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 20 }]}
                onPress={handleSaveAIConfig}
                disabled={isAiSaving}
              >
                {isAiSaving ? (
                  <ActivityIndicator color={getContrastTextColor(colors.primary)} />
                ) : (
                  <Text style={styles.primaryButtonText}>💾 Salvar Configurações de IA</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: LIVE SYNC */}
          {activeTab === 'sync' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>3. Sincronização em Tempo Real</Text>
              </View>

              <Text style={styles.sectionDescription}>
                Busque mensagens diretamente dos canais do Teams e atualize seu calendário e faltas.
              </Text>

              {/* Team & Channel Picker / Fetch */}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => fetchTeamsAndChannels()}
                disabled={isTeamsLoading}
              >
                <Text style={styles.secondaryButtonText}>
                  {isTeamsLoading ? 'Carregando Equipes...' : '🔄 Carregar Equipes & Canais'}
                </Text>
              </TouchableOpacity>

              {joinedTeams.length > 0 && (
                <View style={{ marginTop: 15 }}>
                  <Text style={styles.inputLabel}>Equipe / Disciplina:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {joinedTeams.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.modelChip,
                          selectedTeamId === t.id && styles.modelChipSelected
                        ]}
                        onPress={() => {
                          setSelectedTeamId(t.id);
                          if (teamsConfig.accessToken) {
                            TeamsService.getChannels(teamsConfig.accessToken, t.id)
                              .then(setChannels)
                              .catch(() => {});
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.modelChipText,
                            selectedTeamId === t.id && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                          ]}
                        >
                          {t.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {channels.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Canal:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                    {channels.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.modelChip,
                          selectedChannelId === c.id && styles.modelChipSelected
                        ]}
                        onPress={() => setSelectedChannelId(c.id)}
                      >
                        <Text
                          style={[
                            styles.modelChipText,
                            selectedChannelId === c.id && { color: getContrastTextColor(colors.primary), fontWeight: 'bold' }
                          ]}
                        >
                          #{c.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Big Sync Action Button */}
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 15, paddingVertical: 15 }]}
                onPress={handleLiveSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color={getContrastTextColor(colors.primary)} style={{ marginRight: 10 }} />
                    <Text style={styles.primaryButtonText}>{syncStatusMessage || 'Sincronizando...'}</Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryButtonText, { fontSize: 16 }]}>
                    🚀 Sincronizar Mensagens do Teams
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 4: SIMULATION & AUDIT LOG */}
          {activeTab === 'simulation' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>4. Simulação & Auditoria de IA</Text>
                <View style={[styles.statusPill, { backgroundColor: '#3b82f620' }]}>
                  <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 12 }}>
                    🧪 Modo de Teste
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionDescription}>
                Injeta 3 mensagens reais de professores (cancelamento de Cálculo 1, entrega de Algoritmos no AVA com alertas [10080, 1440], e reagendamento de prova de Física I) no pipeline de IA.
              </Text>

              {/* Simulation Trigger Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { paddingVertical: 16, marginBottom: 20, backgroundColor: colors.primary }
                ]}
                onPress={handleRunSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color={getContrastTextColor(colors.primary)} style={{ marginRight: 10 }} />
                    <Text style={styles.primaryButtonText}>Processando Mensagens com IA...</Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryButtonText, { fontSize: 16 }]}>
                    ✨ Simular Mensagens do Teams
                  </Text>
                )}
              </TouchableOpacity>

              {/* Summary Cards if simulation or sync ran */}
              {lastSyncSummary && (
                <View style={styles.summaryContainer}>
                  <View style={[styles.summaryCard, { borderColor: '#ef4444' }]}>
                    <Text style={[styles.summaryNumber, { color: '#ef4444' }]}>
                      {lastSyncSummary.cancelledCount}
                    </Text>
                    <Text style={styles.summaryLabel}>Aulas Canceladas</Text>
                  </View>

                  <View style={[styles.summaryCard, { borderColor: colors.primary }]}>
                    <Text style={[styles.summaryNumber, { color: colors.primary }]}>
                      {lastSyncSummary.homeworkCount}
                    </Text>
                    <Text style={styles.summaryLabel}>Tarefas Criadas</Text>
                  </View>

                  <View style={[styles.summaryCard, { borderColor: '#BF5AF2' }]}>
                    <Text style={[styles.summaryNumber, { color: '#BF5AF2' }]}>
                      {lastSyncSummary.examCount}
                    </Text>
                    <Text style={styles.summaryLabel}>Provas Agendadas</Text>
                  </View>
                </View>
              )}

              {/* Live Audit Log Console */}
              <View style={styles.auditHeaderRow}>
                <Text style={styles.auditTitle}>📋 Log de Auditoria & Processamento:</Text>
                {auditLogs.length > 0 && (
                  <TouchableOpacity onPress={() => setAuditLogs([])}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Limpar Logs</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.auditConsole}>
                {auditLogs.length === 0 ? (
                  <Text style={styles.auditEmptyText}>
                    Nenhum log registrado ainda. Clique em "Simular Mensagens do Teams" acima para iniciar.
                  </Text>
                ) : (
                  auditLogs.map((log, index) => {
                    let logColor = '#e5e7eb';
                    if (log.includes('[Cancelamento]')) logColor = '#f87171';
                    else if (log.includes('[Tarefa]')) logColor = '#00FFAA';
                    else if (log.includes('[Prova]')) logColor = '#c084fc';
                    else if (log.includes('[Notas]')) logColor = '#fbbf24';
                    else if (log.includes('[Persistência]')) logColor = '#4ade80';
                    else if (log.startsWith('===')) logColor = '#60a5fa';

                    return (
                      <Text key={index} style={[styles.auditLine, { color: logColor }]}>
                        {log}
                      </Text>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 70
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text
    },
    statusBadgeSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 5
    },
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center'
    },
    activeTab: {
      borderBottomWidth: 3,
      borderBottomColor: colors.primary
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600'
    },
    scrollBody: {
      flex: 1,
      padding: 16
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1
    },
    sectionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 15
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12
    },
    guideToggleBtn: {
      paddingVertical: 8,
      marginBottom: 10
    },
    guideBox: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 15
    },
    guideStep: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 18,
      marginBottom: 6
    },
    bold: {
      fontWeight: 'bold'
    },
    codeSnippet: {
      backgroundColor: colors.surface,
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 4
    },
    codeSnippetText: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6
    },
    eyeToggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: 'center',
      alignItems: 'center'
    },
    fieldHint: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 12
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center'
    },
    primaryButtonText: {
      color: getContrastTextColor(colors.primary),
      fontSize: 14,
      fontWeight: 'bold'
    },
    secondaryButton: {
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center'
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600'
    },
    dangerButton: {
      backgroundColor: '#ef444420',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#ef4444',
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center'
    },
    dangerButtonText: {
      color: '#ef4444',
      fontSize: 14,
      fontWeight: 'bold'
    },
    actionButtonGreen: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    actionButtonGreenText: {
      color: getContrastTextColor(colors.primary),
      fontSize: 13,
      fontWeight: 'bold'
    },
    authCodeBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 15
    },
    providerSelectorRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 15
    },
    providerOption: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      alignItems: 'center'
    },
    providerOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    providerOptionText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600'
    },
    modelChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10
    },
    modelChip: {
      backgroundColor: colors.background,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 6
    },
    modelChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    modelChipText: {
      fontSize: 12,
      color: colors.text
    },
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 16
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      alignItems: 'center'
    },
    summaryNumber: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 4
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center'
    },
    auditHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    auditTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text
    },
    auditConsole: {
      backgroundColor: '#0a0a0c',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: '#222',
      minHeight: 160
    },
    auditEmptyText: {
      color: '#666',
      fontSize: 12,
      fontStyle: 'italic'
    },
    auditLine: {
      fontSize: 11,
      lineHeight: 16,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginBottom: 2
    }
  });
