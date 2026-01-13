import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Home({ navigation }) {
  const [dados, setDados] = useState([]);
  const [nomeUsuario, setNomeUsuario] = useState('Cabra');
  
  const [financeiro, setFinanceiro] = useState({
    totalGanhos: 0,
    totalPago: 0,
    saldoAtual: 0
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [menuAddAberto, setMenuAddAberto] = useState(false);

  // Carrega e Processa tudo
  const carregarDados = async () => {
    try {
      // 1. Perfil
      const perfilJson = await AsyncStorage.getItem('@pacelo_perfil');
      if (perfilJson) setNomeUsuario(JSON.parse(perfilJson).nome);

      // 2. Dados Brutos
      const dividasJson = await AsyncStorage.getItem('@pacelo_db');
      let listaDividas = dividasJson ? JSON.parse(dividasJson) : [];

      const ganhosJson = await AsyncStorage.getItem('@pacelo_ganhos');
      const listaGanhos = ganhosJson ? JSON.parse(ganhosJson) : [];

      // 3. EXECUTA AUTOMAÇÃO (O Robô)
      const { dividasAtualizadas, pagouAlgo } = verificarAutomacao(listaDividas);
      
      // Se o robô pagou algo, salva a lista atualizada
      if (pagouAlgo) {
        listaDividas = dividasAtualizadas;
        await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaDividas));
        Alert.alert("🤖 Pacelo Automático", "Algumas contas vencidas foram debitadas automaticamente do seu saldo.");
      }

      setDados(listaDividas);
      calcularFluxoCaixa(listaDividas, listaGanhos);

    } catch (e) {
      console.log('Erro ao ler dados', e);
    }
  };

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  // Função do Robô: Procura contas autoPay vencidas e não pagas
  const verificarAutomacao = (dividas) => {
    let pagouAlgo = false;
    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Zera hora pra comparar só data

    dividas.forEach(item => {
        if (item.autoPay) { // Se o usuário marcou "Automático"
            item.parcelas.forEach(p => {
                const dataVenc = new Date(p.vencimento);
                // Se venceu hoje ou antes E não está pago
                if (!p.pago && dataVenc <= hoje) {
                    p.pago = true;
                    pagouAlgo = true;
                }
            });
        }
    });

    return { dividasAtualizadas: dividas, pagouAlgo };
  };

  const calcularFluxoCaixa = (dividas, ganhos) => {
    const hoje = new Date();
    
    // --- LÓGICA DE GANHO RECORRENTE ---
    // Só soma o ganho se a data dele já passou ou é hoje.
    // Ex: Salário de Dezembro não entra no saldo de Janeiro.
    let totalEntradas = 0;
    
    ganhos.forEach(item => {
        item.parcelas.forEach(p => {
            const dataRecebimento = new Date(p.vencimento);
            // Se a data do ganho já chegou, considera como dinheiro em caixa
            if (dataRecebimento <= hoje) {
                totalEntradas += p.valor;
            }
        });
    });

    // --- LÓGICA DE DÍVIDAS ---
    let totalSaidas = 0;
    dividas.forEach(item => {
      const valorPagoNessaDivida = item.parcelas
        .filter(p => p.pago) // Só conta o que tá marcado como PAGO
        .reduce((acc, p) => acc + p.valor, 0);
      totalSaidas += valorPagoNessaDivida;
    });

    setFinanceiro({
      totalGanhos: totalEntradas,
      totalPago: totalSaidas,
      saldoAtual: totalEntradas - totalSaidas
    });
  };

  const pagarProximaParcela = async (itemIndex) => {
    const novaLista = [...dados];
    const item = novaLista[itemIndex];
    const parcelaIndex = item.parcelas.findIndex(p => !p.pago);

    if (parcelaIndex === -1) return;

    const valorDaParcela = item.parcelas[parcelaIndex].valor;

    if (financeiro.saldoAtual < valorDaParcela) {
        Alert.alert("Saldo Insuficiente", "O caixa tá zerado! Cadastre um ganho ou espere cair o salário.");
        return;
    }

    item.parcelas[parcelaIndex].pago = true;
    await AsyncStorage.setItem('@pacelo_db', JSON.stringify(novaLista));
    
    // Recarrega tudo para atualizar saldos
    carregarDados();
    
    if (itemSelecionado && itemSelecionado.id === item.id) setItemSelecionado(item);
  };

  const abrirDetalhes = (item) => {
    setItemSelecionado(item);
    setModalVisible(true);
  };

  const irParaCadastro = (tipo) => {
    setMenuAddAberto(false);
    navigation.navigate('Cadastro', { tipoOperacao: tipo });
  };

  const formatarData = (isoDate) => {
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth()+1).toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item, index }) => {
    const proxima = item.parcelas.find(p => !p.pago);
    const pagasQtd = item.parcelas.filter(p => p.pago).length;
    const totalQtd = item.parcelas.length;
    const progresso = pagasQtd / totalQtd;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => abrirDetalhes(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitulo}>{item.nome}</Text>
          <View style={{alignItems: 'flex-end'}}>
             <Text style={styles.cardValorTotal}>Total: R$ {item.valorTotal.toFixed(2)}</Text>
             {item.autoPay && <Text style={styles.badgeAuto}>Automático ⚡</Text>}
          </View>
        </View>
        
        <View style={styles.barraFundo}>
          <View style={[styles.barraPreenchida, { width: `${progresso * 100}%` }]} />
        </View>

        {proxima ? (
          <View style={styles.areaAcao}>
            <View>
              <Text style={styles.labelVencimento}>Vence {formatarData(proxima.vencimento)}</Text>
              <Text style={styles.valorParcela}>R$ {proxima.valor.toFixed(2)}</Text>
            </View>
            
            {/* Se for automático, mostra aviso ao invés do botão pagar, ou deixa ambos */}
            {item.autoPay ? (
                <View style={styles.boxAuto}>
                    <Text style={styles.txtAuto}>Débito Auto.</Text>
                </View>
            ) : (
                <TouchableOpacity style={styles.btnPagar} onPress={() => pagarProximaParcela(index)}>
                    <Text style={styles.txtBtnPagar}>PAGAR</Text>
                </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.quitado}><Text style={styles.txtQuitado}>QUITADO 🎉</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
            <Text style={styles.saudacao}>Fala, {nomeUsuario}!</Text>
            <Text style={styles.appNome}>PACELO</Text>
        </View>
      </View>

      <View style={styles.painelFinanceiro}>
        <View style={styles.painelLinha}>
            <Text style={styles.painelLabel}>Entradas (Até Hoje)</Text>
            <Text style={styles.painelValorVerde}>R$ {financeiro.totalGanhos.toFixed(2)}</Text>
        </View>
        <View style={styles.painelLinha}>
            <Text style={styles.painelLabel}>Saídas Realizadas</Text>
            <Text style={styles.painelValorVermelho}>- R$ {financeiro.totalPago.toFixed(2)}</Text>
        </View>
        <View style={styles.divisor} />
        <View style={styles.painelLinha}>
            <Text style={styles.saldoLabel}>SALDO ATUAL</Text>
            <Text style={[styles.saldoValor, { color: financeiro.saldoAtual >= 0 ? '#22c55e' : '#ef4444' }]}>
                R$ {financeiro.saldoAtual.toFixed(2)}
            </Text>
        </View>
      </View>

      <Text style={styles.tituloLista}>Minhas Dívidas</Text>

      <FlatList 
        data={dados}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
      />

      {menuAddAberto && (
        <View style={styles.menuAddContainer}>
          <TouchableOpacity style={[styles.menuOpcao, {backgroundColor: '#22c55e'}]} onPress={() => irParaCadastro('ganho')}>
            <Text style={styles.menuTexto}>💰 Ganho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuOpcao, {backgroundColor: '#ef4444'}]} onPress={() => irParaCadastro('despesa')}>
            <Text style={styles.menuTexto}>💸 Dívida</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.fab, menuAddAberto ? {backgroundColor: '#475569'} : {}]}
        onPress={() => setMenuAddAberto(!menuAddAberto)}
      >
        <Text style={styles.fabTexto}>{menuAddAberto ? 'X' : '+'}</Text>
      </TouchableOpacity>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitulo}>{itemSelecionado?.nome}</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.modalFechar}>X</Text></TouchableOpacity>
                </View>
                <ScrollView style={styles.modalLista}>
                    {itemSelecionado?.parcelas.map((p, index) => (
                        <View key={index} style={[styles.linhaParcela, p.pago ? styles.linhaPaga : null]}>
                            <Text style={styles.txtNumero}>#{p.numero}</Text>
                            <Text style={styles.txtData}>{formatarData(p.vencimento)}</Text>
                            <Text style={[styles.txtValor, p.pago && styles.txtValorPago]}>R$ {p.valor.toFixed(2)}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#fff', padding: 20, elevation: 2 },
  appNome: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  saudacao: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  
  painelFinanceiro: {
    backgroundColor: '#0f172a', margin: 20, borderRadius: 16, padding: 20, elevation: 8,
  },
  painelLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  painelLabel: { color: '#94a3b8', fontSize: 14 },
  painelValorVerde: { color: '#4ade80', fontWeight: 'bold', fontSize: 14 },
  painelValorVermelho: { color: '#f87171', fontWeight: 'bold', fontSize: 14 },
  divisor: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
  saldoLabel: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  saldoValor: { fontSize: 24, fontWeight: 'bold' },

  tituloLista: { marginLeft: 20, marginBottom: 10, fontSize: 18, fontWeight: 'bold', color: '#334155' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  cardValorTotal: { fontSize: 12, color: '#64748b' },
  badgeAuto: { fontSize: 10, color: '#eab308', fontWeight: 'bold' },
  
  barraFundo: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 15, overflow: 'hidden' },
  barraPreenchida: { height: '100%', backgroundColor: '#22c55e' },
  
  areaAcao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  labelVencimento: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  valorParcela: { fontSize: 18, color: '#1e293b', fontWeight: 'bold' },
  btnPagar: { backgroundColor: '#0f172a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  txtBtnPagar: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  boxAuto: { backgroundColor: '#fef9c3', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  txtAuto: { color: '#854d0e', fontWeight: 'bold', fontSize: 12 },

  quitado: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#dcfce7', borderRadius: 8 },
  txtQuitado: { color: '#166534', fontWeight: 'bold' },
  
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabTexto: { color: '#fff', fontSize: 30, marginTop: -3 },
  menuAddContainer: { position: 'absolute', bottom: 100, right: 20, alignItems: 'flex-end' },
  menuOpcao: { flexDirection: 'row', padding: 10, borderRadius: 8, marginBottom: 10, elevation: 5 },
  menuTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  modalFechar: { fontSize: 20, color: '#94a3b8' },
  linhaParcela: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  linhaPaga: { opacity: 0.5 },
  txtNumero: { fontWeight: 'bold', color: '#334155' },
  txtData: { color: '#94a3b8' },
  txtValor: { fontWeight: 'bold', color: '#ef4444' },
  txtValorPago: { color: '#22c55e', textDecorationLine: 'line-through' }
});