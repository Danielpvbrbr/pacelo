import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, Alert, ScrollView, StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { changeIcon } from 'react-native-change-icon';
import { version } from '../package.json';
import notifee, { TriggerType, AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { NotificationService } from '../services/NotificationService';

export default function Configuracao() {
  const navigation = useNavigation();
  const [nome, setNome] = useState('');
  const [notificacoes, setNotificacoes] = useState(true);
  const [sons, setSons] = useState(true);

  useEffect(() => {
    carregarPerfil();
  }, []);
  const carregarPerfil = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_perfil');
      if (json) {
        const perfil = JSON.parse(json);
        setNome(perfil.nome);
        // Carrega os estados salvos (usa true como padrão se não existir)
        setNotificacoes(perfil.notificacoes !== undefined ? perfil.notificacoes : true);
        setSons(perfil.sons !== undefined ? perfil.sons : true);
      }
    } catch (e) { }
  };

  const salvarNome = async () => {
    if (!nome.trim()) {
      Alert.alert("Ops", "O nome não pode ficar vazio.");
      return;
    }
    try {
      // Salva o nome mantendo as chaves de notificação e som
      const perfilCompleto = { nome, notificacoes, sons };
      await AsyncStorage.setItem('@pacelo_perfil', JSON.stringify(perfilCompleto));
      Alert.alert("Sucesso", "Nome atualizado! 🎉");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar.");
    }
  };

  const resetarApp = () => {
    Alert.alert(
      "Resetar Tudo?",
      "Isso vai apagar TODAS as suas dívidas e ganhos. Não tem volta!",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, apagar tudo",
          style: 'destructive',
          onPress: async () => {
            try {
              // Limpa todas as chaves do app
              await AsyncStorage.multiRemove(['@pacelo_db', '@pacelo_ganhos', '@pacelo_perfil']);

              // Reseta o ícone para o padrão verde
              changeIcon('MainActivityDefault');

              Alert.alert("App Resetado", "Começando do zero!");
              navigation.reset({
                index: 0,
                routes: [{ name: 'Dívidas' }],
              });
            } catch (e) {
              Alert.alert("Erro", "Falha ao limpar dados.");
            }
          }
        }
      ]
    );
  };

  const salvarPreferencias = async (novaNotif, novoSom) => {
    try {
      const perfilAtual = { nome, notificacoes: novaNotif, sons: novoSom };
      await AsyncStorage.setItem('@pacelo_perfil', JSON.stringify(perfilAtual));

      // Se o usuário desligou a chave geral, limpa os agendamentos pendentes
      if (!novaNotif) {
        await NotificationService.cancelarTodas();
        Alert.alert("Notificações desativadas", "Todos os lembretes pendentes foram removidos.");
      }
    } catch (e) { }
  };

  const testarNotificacaoAgora = async () => {
    // 1. Pedir permissão
    await notifee.requestPermission();

    // 2. Configurar para daqui a 3 segundos (mais rápido para teste)
    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + 3000,
    };

    // 3. Agendar via Service (Ele vai checar se 'sons' está ativo ou não)
    await NotificationService.schedule(
      {
        title: `<b>Teste do Sistema</b>`,
        body: `Olá ${nome || 'Campeão'}! Isso é um teste de som e alerta.`,
        subtitle: 'Configurações',
        android: {
          color: '#0f172a',
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
          pressAction: { id: 'default' },
          style: {
            type: AndroidStyle.BIGTEXT,
            text: `Se você ouviu som, a chave <b>Sons</b> está ativada.\n\nSe não ouviu, o app enviou pelo canal silencioso conforme sua configuração! 🔊`,
          },
        },
      },
      trigger,
    );

    Alert.alert("Teste Agendado", "Aguarde 3 segundos...");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* CABEÇALHO */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarTexto}>
            {nome ? nome.charAt(0).toUpperCase() : '👤'}
          </Text>
        </View>
        <Text style={styles.headerTitulo}>Meu Perfil</Text>
        <Text style={styles.headerSub}>Gerencie suas preferências</Text>
      </View>

      <ScrollView style={styles.body}>

        {/* SEÇÃO 1: IDENTIDADE */}
        <Text style={styles.sectionTitle}>IDENTIDADE</Text>
        <View style={styles.card}>
          <Text style={styles.labelInput}>Como prefere ser chamado?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity style={styles.btnSalvar} onPress={salvarNome}>
              <Text style={styles.txtSalvar}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEÇÃO 2: PREFERÊNCIAS */}
        <Text style={styles.sectionTitle}>PREFERÊNCIAS</Text>
        <View style={styles.card}>

          <View style={styles.rowOption}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                <Text>🔔</Text>
              </View>
              <Text style={styles.optionText}>Notificações</Text>
            </View>
            <Switch
              value={notificacoes}
              onValueChange={(val) => {
                setNotificacoes(val);
                salvarPreferencias(val, sons);
              }}
              trackColor={{ false: "#767577", true: "#0f172a" }}
              thumbColor={notificacoes ? "#fff" : "#f4f3f4"}
            />
          </View>

          <View style={styles.divisor} />

          <View style={styles.rowOption}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <Text>🔊</Text>
              </View>
              <Text style={styles.optionText}>Sons e Efeitos</Text>
            </View>
            <Switch
              value={sons}
              onValueChange={(val) => {
                setSons(val);
                salvarPreferencias(notificacoes, val);
              }}
              trackColor={{ false: "#767577", true: "#0f172a" }}
              thumbColor={sons ? "#fff" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* SEÇÃO 3: ZONA DE PERIGO */}
        <Text style={styles.sectionTitle}>ZONA DE PERIGO</Text>
        <TouchableOpacity style={[styles.card, styles.cardDanger]} onPress={resetarApp}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
              <Text>🗑️</Text>
            </View>
            <View>
              <Text style={styles.dangerTitle}>Resetar App</Text>
              <Text style={styles.dangerSub}>Apagar todos os dados e começar do zero</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onLongPress={testarNotificacaoAgora}>
          <Text style={styles.versionText}>Versão {version} | Desenvolvido por ToraSys</Text>
        </TouchableOpacity>
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // --- HEADER ---
  header: {
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)'
  },
  avatarTexto: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  headerTitulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 14, color: '#94a3b8', marginTop: 5 },

  // --- BODY ---
  body: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10, marginLeft: 5, letterSpacing: 1 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 25, elevation: 2, shadowColor: '#cbd5e1', shadowOpacity: 0.1, shadowRadius: 5 },

  // INPUT
  labelInput: { fontSize: 14, color: '#64748b', marginBottom: 10 },
  inputRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginRight: 10, color: '#0f172a', fontWeight: '500' },
  btnSalvar: { backgroundColor: '#0f172a', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 10 },
  txtSalvar: { color: '#fff', fontWeight: 'bold' },

  // OPÇÕES
  rowOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  optionText: { fontSize: 16, fontWeight: '500', color: '#1e293b' },
  divisor: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },

  // DANGER
  cardDanger: { borderWidth: 1, borderColor: '#fecaca' },
  dangerTitle: { fontSize: 16, fontWeight: 'bold', color: '#dc2626' },
  dangerSub: { fontSize: 12, color: '#ef4444', marginTop: 2 },

  versionText: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: -10 }
});