import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Cadastro({ navigation, route }) {
  // Recebe o tipo (despesa ou ganho) vindo da tela anterior
  const { tipoOperacao } = route.params || { tipoOperacao: 'despesa' };
  
  const [nome, setNome] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [tipo, setTipo] = useState('fixa'); 
  const [frequencia, setFrequencia] = useState('Mensal');
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [diaVencimento, setDiaVencimento] = useState(new Date().getDate().toString());

  const corTema = tipoOperacao === 'despesa' ? '#ef4444' : '#22c55e'; // Vermelho ou Verde

  const salvar = async () => {
    if (!nome || !valorTotal || !diaVencimento) {
      Alert.alert('Atenção', 'Preencha os campos obrigatórios.');
      return;
    }

    const valorNum = parseFloat(valorTotal.replace(',', '.'));
    const parcelasNum = tipo === 'parcelada' ? parseInt(qtdParcelas) : 1;
    const valorParcela = valorNum / parcelasNum;

    // Gerar parcelas
    let listaParcelas = [];
    let hoje = new Date();
    let dataBase = new Date(hoje.getFullYear(), hoje.getMonth(), parseInt(diaVencimento));
    
    if (dataBase < hoje) {
      dataBase.setMonth(dataBase.getMonth() + 1);
    }

    for (let i = 0; i < parcelasNum; i++) {
      let dataVenc = new Date(dataBase);
      // Removemos diário e semanal. Ficou simples.
      if (frequencia === 'Mensal') dataVenc.setMonth(dataBase.getMonth() + i);
      if (frequencia === 'Anual') dataVenc.setFullYear(dataBase.getFullYear() + i);
      if (frequencia === 'Única') { /* Não muda data */ }

      listaParcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: dataVenc.toISOString(),
        pago: false
      });
    }

    const novoRegistro = {
      id: Date.now().toString(),
      nome,
      categoria: tipo === 'fixa' ? (tipoOperacao === 'despesa' ? 'Fixa' : 'Salário') : 'Parcelado',
      frequencia,
      valorTotal: valorNum,
      parcelas: listaParcelas,
      tipo: tipoOperacao // 'despesa' ou 'ganho'
    };

    try {
      // Define qual banco usar
      const keyDb = tipoOperacao === 'despesa' ? '@pacelo_db' : '@pacelo_ganhos';
      
      const dadosAntigos = await AsyncStorage.getItem(keyDb);
      const listaAntiga = dadosAntigos ? JSON.parse(dadosAntigos) : [];
      const novaLista = [...listaAntiga, novoRegistro];
      
      await AsyncStorage.setItem(keyDb, JSON.stringify(novaLista));
      Alert.alert('Sucesso', `${tipoOperacao === 'despesa' ? 'Dívida' : 'Ganho'} salvo com sucesso!`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.titulo, { color: corTema }]}>
        {tipoOperacao === 'despesa' ? 'Nova Dívida 💸' : 'Novo Ganho 💰'}
      </Text>
      
      <Text style={styles.label}>Descrição</Text>
      <TextInput 
        style={styles.input} 
        placeholder={tipoOperacao === 'despesa' ? "Ex: Aluguel, Carro..." : "Ex: Salário, Freela..."}
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Valor Total (R$)</Text>
      <TextInput 
        style={styles.input} 
        placeholder="0.00" 
        keyboardType="numeric"
        value={valorTotal}
        onChangeText={setValorTotal}
      />

      <View style={styles.row}>
        <Text style={styles.labelSwitch}>É Parcelado?</Text>
        <Switch 
          value={tipo === 'parcelada'} 
          onValueChange={(val) => setTipo(val ? 'parcelada' : 'fixa')}
          trackColor={{ false: "#767577", true: corTema }}
        />
      </View>

      {tipo === 'parcelada' && (
        <>
          <Text style={styles.label}>Quantidade de Vezes</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ex: 12" 
            keyboardType="numeric"
            value={qtdParcelas}
            onChangeText={setQtdParcelas}
          />
        </>
      )}

      <Text style={styles.label}>Frequência</Text>
      <View style={styles.botoesFreq}>
        {/* OPÇÕES LIMPAS AGORA */}
        {['Mensal', 'Única', 'Anual'].map((f) => (
          <TouchableOpacity 
            key={f} 
            style={[styles.btnFreq, frequencia === f && { backgroundColor: corTema, borderColor: corTema }]}
            onPress={() => setFrequencia(f)}
          >
            <Text style={[styles.txtFreq, frequencia === f && styles.txtFreqAtivo]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Dia do {tipoOperacao === 'despesa' ? 'Vencimento' : 'Recebimento'}</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Dia (1-31)" 
        keyboardType="numeric"
        maxLength={2}
        value={diaVencimento}
        onChangeText={setDiaVencimento}
      />

      <TouchableOpacity style={[styles.botaoSalvar, { backgroundColor: corTema }]} onPress={salvar}>
        <Text style={styles.textoBotao}>Salvar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation.goBack()}>
        <Text style={styles.textoVoltar}>Cancelar</Text>
      </TouchableOpacity>
      
      <View style={{height: 50}}/> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, color: '#64748b', marginBottom: 5, fontWeight: '600' },
  labelSwitch: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 15, color: '#0f172a'
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  botoesFreq: { flexDirection: 'row', marginBottom: 15 },
  btnFreq: { padding: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, marginRight: 10 },
  txtFreq: { color: '#64748b' },
  txtFreqAtivo: { color: '#fff', fontWeight: 'bold' },
  botaoSalvar: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  botaoVoltar: { padding: 15, alignItems: 'center', marginTop: 5 },
  textoBotao: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  textoVoltar: { color: '#64748b' }
});