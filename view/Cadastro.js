import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Cadastro({ navigation, route }) {
  const { tipoOperacao } = route.params || { tipoOperacao: 'despesa' };
  const isDespesa = tipoOperacao === 'despesa';

  const [nome, setNome] = useState('');
  const [valorTotal, setValorTotal] = useState('0,00'); 
  
  const hoje = new Date();
  const hojeFormatado = `${hoje.getDate().toString().padStart(2,'0')}/${(hoje.getMonth()+1).toString().padStart(2,'0')}/${hoje.getFullYear()}`;
  
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

  const finalizarSalvamento = async (registroFinal) => {
    try {
      const keyDb = isDespesa ? '@pacelo_db' : '@pacelo_ganhos';
      const dadosAntigos = await AsyncStorage.getItem(keyDb);
      const listaAntiga = dadosAntigos ? JSON.parse(dadosAntigos) : [];
      const novaLista = [...listaAntiga, registroFinal];
      
      await AsyncStorage.setItem(keyDb, JSON.stringify(novaLista));
      Alert.alert('Sucesso', 'Registro salvo!');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar no banco.');
    }
  };

  const salvar = async () => {
    // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ---
    if (!nome.trim()) {
      Alert.alert('Faltou o Nome', 'Por favor, digite uma descrição para o lançamento.');
      return;
    }
    if (valorTotal === '0,00') {
      Alert.alert('Valor Zerado', 'O valor não pode ser zero.');
      return;
    }

    if (isDespesa) {
        if (dataCompra.length < 10) {
            Alert.alert('Data Inválida', 'Preencha a Data da Compra corretamente (Dia/Mês/Ano).');
            return;
        }
        if (!diaVencimento) {
            Alert.alert('Dia do Vencimento', 'Informe o dia que a fatura vence (1 a 31).');
            return;
        }
        if (!qtdParcelas) {
            Alert.alert('Parcelas', 'Informe a quantidade de parcelas (mínimo 1).');
            return;
        }
    }
    // ----------------------------------------

    const valorLimpo = valorTotal.replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorLimpo);

    const partesData = dataCompra.split('/');
    const diaCompra = parseInt(partesData[0]);
    const mesCompra = parseInt(partesData[1]) - 1;
    const anoCompra = parseInt(partesData[2]);
    const objetoDataCompra = new Date(anoCompra, mesCompra, diaCompra);

    let parcelasInput = parseInt(qtdParcelas);
    if (isNaN(parcelasInput) || parcelasInput < 1) parcelasInput = 1;
    
    const numeroDeVezes = isDespesa ? parcelasInput : 1;
    const valorDaParcela = valorNum / numeroDeVezes;

    let diaVenc = parseInt(diaVencimento);
    let dataPrimeiraParcela = new Date(anoCompra, mesCompra, diaVenc);
    if (diaVenc <= diaCompra) {
        dataPrimeiraParcela.setMonth(dataPrimeiraParcela.getMonth() + 1);
    }

    let listaParcelas = [];
    let temParcelaVencida = false;
    const dataHoje = new Date();
    dataHoje.setHours(0,0,0,0); 

    for (let i = 0; i < numeroDeVezes; i++) {
      let dataVenc = new Date(dataPrimeiraParcela);
      dataVenc.setMonth(dataPrimeiraParcela.getMonth() + i);
      
      if (dataVenc < dataHoje) {
        temParcelaVencida = true;
      }

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
      dataCriacao: objetoDataCompra.toISOString()
    };

    if (isDespesa && temParcelaVencida) {
        Alert.alert(
            "Parcelas Passadas 📅",
            "Existem parcelas com data antiga. O que deseja fazer?",
            [
                { 
                    text: "Deixar em aberto", 
                    onPress: () => finalizarSalvamento(novoRegistro) 
                },
                { 
                    text: "Marcar como PAGAS", 
                    onPress: () => {
                        novoRegistro.parcelas.forEach(p => {
                            if (new Date(p.vencimento) < dataHoje) {
                                p.pago = true;
                            }
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
        placeholder={isDespesa ? "Ex: Mercado, Tênis, Luz..." : "Ex: Salário, Venda..."}
        placeholderTextColor="#94a3b8"
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Valor Total (R$)</Text>
      <TextInput 
        style={[styles.input, styles.inputValor, { color: corTema, width: 200 }]} 
        placeholder="0,00" 
        placeholderTextColor="#cbd5e1"
        keyboardType="numeric"
        value={valorTotal}
        onChangeText={handleValorChange}
      />

      {isDespesa && (
        <View style={styles.boxDespesa}>
            
            {/* Campo de Data Isolado para ter espaço */}
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

            {/* Linha com Parcelas e Vencimento Lado a Lado (Menores) */}
            <View style={styles.rowInputs}>
                <View style={{flex: 1, marginRight: 8}}>
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

                <View style={{flex: 1, marginLeft: 8}}>
                    <Text style={styles.label}>Dia Venc.</Text>
                    <TextInput 
                        style={styles.inputPequeno} 
                        placeholder="Ex: 10" 
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
      
      <View style={{height: 50}}/> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#f8fafc' },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  
  label: { fontSize: 14, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  helpText: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    padding: 15, fontSize: 16, marginBottom: 20, color: '#0f172a'
  },
  inputValor: { fontSize: 28, fontWeight: 'bold' },
  
  boxDespesa: { marginTop: 5 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  
  // Estilo novo para os campos menores lado a lado
  inputPequeno: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    padding: 15, fontSize: 16, textAlign: 'center', color: '#0f172a', fontWeight: 'bold'
  },

  botaoSalvar: { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 20, elevation: 3 },
  textoBotao: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  
  botaoVoltar: { padding: 15, alignItems: 'center', marginTop: 10 },
  textoVoltar: { color: '#64748b', fontSize: 16 }
});