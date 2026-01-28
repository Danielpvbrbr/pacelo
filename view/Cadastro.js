import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TimestampTrigger, TriggerType, AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { NotificationService } from '../services/NotificationService';

export default function Cadastro({ navigation, route }) {
  const { tipoOperacao } = route.params || { tipoOperacao: 'despesa' };
  const isDespesa = tipoOperacao === 'despesa';

  const [nome, setNome] = useState('');
  const [valorTotal, setValorTotal] = useState('0,00');

  const hoje = new Date();
  const hojeFormatado = `${hoje.getDate().toString().padStart(2, '0')}/${(hoje.getMonth() + 1).toString().padStart(2, '0')}/${hoje.getFullYear()}`;

  const [dataCompra, setDataCompra] = useState(hojeFormatado);
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [diaVencimento, setDiaVencimento] = useState('');

  const corTema = isDespesa ? '#ef4444' : '#22c55e';

  const handleValorChange = (texto) => {
    let v = texto.replace(/\D/g, '');
    v = (Number(v) / 100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setValorTotal(v);
  };

  const handleDataChange = (texto) => {
    let v = texto.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 4) {
      v = `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    } else if (v.length > 2) {
      v = `${v.substring(0, 2)}/${v.substring(2)}`;
    }
    setDataCompra(v);
  };

  const agendarNotificacoesLocais = async (registro) => {
    if (!isDespesa) return;

    try {
      let nomeUsuario = 'Campeão';
      const perfilJson = await AsyncStorage.getItem('@pacelo_perfil');
      if (perfilJson) {
        const perfil = JSON.parse(perfilJson);
        if (perfil.nome) nomeUsuario = perfil.nome;
      }

      // Pedir permissão continua sendo importante
      await notifee.requestPermission();

      const agora = new Date();

      for (const parcela of registro.parcelas) {
        const dataVenc = new Date(parcela.vencimento);
        dataVenc.setHours(9, 0, 0, 0); // Notificar às 09:00 da manhã

        if (dataVenc > agora) {
          const trigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: dataVenc.getTime(),
            alarmManager: true, // Garante que o Android desperte o app
          };

          // USANDO O SERVICE INTELIGENTE AQUI
          await NotificationService.schedule(
            {
              title: `<b>Vencimento: ${registro.nome}</b>`,
              body: `Sua parcela ${parcela.numero} vence hoje.`,
              subtitle: 'Fatura Disponível',
              android: {
                // O channelId será inserido automaticamente pelo NotificationService (com ou sem som)
                color: '#ef4444',
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                pressAction: { id: 'default' },

                style: {
                  type: AndroidStyle.BIGTEXT,
                  text: `Olá <b>${nomeUsuario}</b>! 👋\n\nParcela <b>${parcela.numero}</b> de <b>${registro.nome}</b> vence hoje.\n💰 Valor: <b>R$ ${parcela.valor.toFixed(2).replace('.', ',')}</b>\n\nBora pagar logo pra não se enrolar! 💸`,
                },

                actions: [
                  {
                    title: '📱 Abrir App',
                    pressAction: { id: 'default' },
                  }
                ]
              },
            },
            trigger
          );
          console.log(`Agendado via Service para ${nomeUsuario}: ${dataVenc.toLocaleDateString()}`);
        }
      }
    } catch (e) {
      console.log("Erro ao agendar via Service:", e);
    }
  };
  
  const finalizarSalvamento = async (registroFinal) => {
    try {
      const keyDb = isDespesa ? '@pacelo_db' : '@pacelo_ganhos';
      const dadosAntigos = await AsyncStorage.getItem(keyDb);
      const listaAntiga = dadosAntigos ? JSON.parse(dadosAntigos) : [];
      const novaLista = [...listaAntiga, registroFinal];

      await AsyncStorage.setItem(keyDb, JSON.stringify(novaLista));

      // AGENDA O DESPERTADOR AQUI 
      await agendarNotificacoesLocais(registroFinal);

      Alert.alert('Sucesso', isDespesa ? 'Dívida salva e lembretes criados!' : 'Ganho adicionado!');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar no banco.');
    }
  };

  const salvar = async () => {
    // 1. Validações
    if (!nome.trim()) { Alert.alert('Faltou o Nome', 'Por favor, digite uma descrição.'); return; }
    if (valorTotal === '0,00') { Alert.alert('Valor Zerado', 'O valor não pode ser zero.'); return; }

    if (isDespesa) {
      if (dataCompra.length < 10) { Alert.alert('Data Inválida', 'Preencha a Data da Compra corretamente.'); return; }
      if (!diaVencimento) { Alert.alert('Dia do Vencimento', 'Informe o dia que a fatura vence.'); return; }
    }

    // 2. Preparar Dados
    const valorLimpo = valorTotal.replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorLimpo);

    const dataRefStr = isDespesa ? dataCompra : hojeFormatado;
    const partesData = dataRefStr.split('/');
    if (partesData.length < 3) return;

    const diaRef = parseInt(partesData[0]);
    const mesRef = parseInt(partesData[1]) - 1;
    const anoRef = parseInt(partesData[2]);
    const objetoDataRef = new Date(anoRef, mesRef, diaRef);

    let parcelasInput = parseInt(qtdParcelas);
    if (isNaN(parcelasInput) || parcelasInput < 1) parcelasInput = 1;
    const numeroDeVezes = isDespesa ? parcelasInput : 1;
    const valorDaParcela = valorNum / numeroDeVezes;

    // 3. Gerar Parcelas
    let listaParcelas = [];
    let temParcelaVencida = false;
    const dataHoje = new Date();
    dataHoje.setHours(0, 0, 0, 0);

    let diaVenc = isDespesa ? parseInt(diaVencimento) : diaRef;
    let dataBase = new Date(anoRef, mesRef, diaVenc);

    // Ajuste de mês: Se comprou dia 20 e vence dia 10, joga pro mês seguinte
    if (isDespesa && diaVenc <= diaRef) {
      dataBase.setMonth(dataBase.getMonth() + 1);
    }

    for (let i = 0; i < numeroDeVezes; i++) {
      let dataVenc = new Date(dataBase);

      if (isDespesa) dataVenc.setMonth(dataBase.getMonth() + i);

      // Verifica se já venceu
      if (isDespesa && dataVenc < dataHoje) temParcelaVencida = true;

      listaParcelas.push({
        numero: i + 1,
        valor: valorDaParcela,
        vencimento: dataVenc.toISOString(),
        pago: false
      });
    }

    const novoRegistro = {
      id: Date.now().toString(),
      nome,
      categoria: isDespesa ? (numeroDeVezes > 1 ? 'Parcelado' : 'Fixa') : 'Entrada',
      frequencia: isDespesa ? (numeroDeVezes > 1 ? 'Mensal' : 'Única') : 'Única',
      valorTotal: valorNum,
      parcelas: listaParcelas,
      tipo: tipoOperacao,
      arquivado: false,
      autoPay: false,
      dataCriacao: objetoDataRef.toISOString()
    };

    // 4. Decisão de Salvar (Verifica antigas)
    if (isDespesa && temParcelaVencida) {
      Alert.alert(
        "Parcelas Antigas",
        "Existem parcelas com data passada. Marcar como pagas?",
        [
          { text: "Não (Deixar Vencidas)", onPress: () => finalizarSalvamento(novoRegistro) },
          {
            text: "Sim (Baixar)",
            onPress: () => {
              novoRegistro.parcelas.forEach(p => {
                if (new Date(p.vencimento) < dataHoje) p.pago = true;
              });
              finalizarSalvamento(novoRegistro);
            }
          }
        ]
      );
    } else {
      finalizarSalvamento(novoRegistro);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.titulo, { color: corTema }]}>
        {isDespesa ? 'Nova Dívida' : 'Entrada'}
      </Text>

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={styles.input}
        placeholder={isDespesa ? "Ex: Mercado, Luz..." : "Ex: Salário, Venda..."}
        placeholderTextColor="#94a3b8"
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Valor Total (R$)</Text>
      <TextInput
        style={[styles.input, styles.inputValor, { color: corTema }]}
        placeholder="0,00"
        placeholderTextColor="#cbd5e1"
        keyboardType="numeric"
        value={valorTotal}
        onChangeText={handleValorChange}
      />

      {isDespesa && (
        <View style={styles.boxDespesa}>
          <Text style={styles.label}>Data da Compra</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            maxLength={10}
            value={dataCompra}
            onChangeText={handleDataChange}
          />

          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Parcelas</Text>
              <TextInput
                style={styles.inputPequeno}
                placeholder="1"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={qtdParcelas}
                onChangeText={setQtdParcelas}
              />
              <Text style={styles.helpText}>Vazio = À vista</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Dia Venc.</Text>
              <TextInput
                style={styles.inputPequeno}
                placeholder="Dia"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                maxLength={2}
                value={diaVencimento}
                onChangeText={setDiaVencimento}
              />
              <Text style={styles.helpText}>Dia do Mês</Text>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity style={[styles.botaoSalvar, { backgroundColor: corTema }]} onPress={salvar}>
        <Text style={styles.textoBotao}>
          {isDespesa ? 'Salvar Dívida' : 'Salvar Entrada'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation.goBack()}>
        <Text style={styles.textoVoltar}>Cancelar</Text>
      </TouchableOpacity>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#f8fafc' },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  label: { fontSize: 14, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  helpText: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, color: '#0f172a' },
  inputValor: { fontSize: 28, fontWeight: 'bold' },
  boxDespesa: { marginTop: 5 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputPequeno: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, textAlign: 'center', color: '#0f172a', fontWeight: 'bold' },
  botaoSalvar: { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 20, elevation: 3 },
  textoBotao: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  botaoVoltar: { padding: 15, alignItems: 'center', marginTop: 10 },
  textoVoltar: { color: '#64748b', fontSize: 16 }
});