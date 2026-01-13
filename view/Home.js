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

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const carregarDados = async () => {
    try {
      const perfilJson = await AsyncStorage.getItem('@pacelo_perfil');
      if (perfilJson) setNomeUsuario(JSON.parse(perfilJson).nome);

      const dividasJson = await AsyncStorage.getItem('@pacelo_db');
      let listaDividas = dividasJson ? JSON.parse(dividasJson) : [];

      const ganhosJson = await AsyncStorage.getItem('@pacelo_ganhos');
      const listaGanhos = ganhosJson ? JSON.parse(ganhosJson) : [];

      // --- AUTOMAÇÃO ---
      const { dividasAtualizadas, pagouAlgo } = verificarAutomacao(listaDividas);
      if (pagouAlgo) {
        listaDividas = dividasAtualizadas;
        await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaDividas));
        Alert.alert("🤖 Pacelo Automático", "Algumas contas vencidas foram debitadas automaticamente.");
      }

      // --- FILTRO DE ARQUIVADOS (NOVO) ---
      // Só mostra na tela e conta no saldo o que NÃO estiver arquivado
      const listaAtiva = listaDividas.filter(item => !item.arquivado);

      setDados(listaAtiva);
      calcularFluxoCaixa(listaAtiva, listaGanhos);

    } catch (e) {
      console.log('Erro ao ler dados', e);
    }
  };

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  // --- FUNÇÕES DE ARQUIVAMENTO (NOVO) ---
  const confirmarArquivamento = (item) => {
    Alert.alert(
      "Ignorar Compra?",
      `Deseja arquivar "${item.nome}"? Ela vai sumir da sua lista e do cálculo de saldo, mas não será apagada do banco.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sim, Arquivar", 
          onPress: () => arquivarItem(item.id),
          style: 'destructive'
        }
      ]
    );
  };

  const arquivarItem = async (id) => {
    try {
      const dividasJson = await AsyncStorage.getItem('@pacelo_db');
      let lista = dividasJson ? JSON.parse(dividasJson) : [];

      // Encontra o item e marca como arquivado
      const novaLista = lista.map(item => {
        if (item.id === id) {
          return { ...item, arquivado: true };
        }
        return item;
      });

      await AsyncStorage.setItem('@pacelo_db', JSON.stringify(novaLista));
      carregarDados(); // Recarrega a tela (o item vai sumir)
      
    } catch (e) {
      Alert.alert("Erro", "Não foi possível arquivar.");
    }
  };
  // --------------------------------------

  const verificarAutomacao = (dividas) => {
    let pagouAlgo = false;
    const hoje = new Date();
    hoje.setHours(0,0,0,0); 

    dividas.forEach(item => {
        // Se estiver arquivado, o robô ignora também
        if (item.autoPay && !item.arquivado) { 
            item.parcelas.forEach(p => {
                const dataVenc = new Date(p.vencimento);
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
    
    let totalEntradas = 0;
    ganhos.forEach(item => {
        item.parcelas.forEach(p => {
            const dataRecebimento = new Date(p.vencimento);
            if (dataRecebimento <= hoje) {
                totalEntradas += p.valor;
            }
        });
    });

    let totalSaidas = 0;
    dividas.forEach(item => {
      // Itens arquivados já foram filtrados antes de chegar aqui
      const valorPagoNessaDivida = item.parcelas
        .filter(p => p.pago)
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
    // Atenção: 'dados' aqui já é a lista filtrada (sem arquivados)
    // Precisamos achar o item no banco original pelo ID para salvar corretamente
    const itemTela = dados[itemIndex];

    const dividasJson = await AsyncStorage.getItem('@pacelo_db');
    let listaCompleta = dividasJson ? JSON.parse(dividasJson) : [];
    
    // Acha o índice real no banco completo
    const indexReal = listaCompleta.findIndex(i => i.id === itemTela.id);
    if (indexReal === -1) return;

    const item = listaCompleta[indexReal];
    const parcelaIndex = item.parcelas.findIndex(p => !p.pago);

    if (parcelaIndex === -1) return;

    const valorDaParcela = item.parcelas[parcelaIndex].valor;

    if (financeiro.saldoAtual < valorDaParcela) {
        Alert.alert("Saldo Insuficiente", "O caixa tá zerado! Cadastre um ganho ou espere cair o salário.");
        return;
    }

    item.parcelas[parcelaIndex].pago = true;
    listaCompleta[indexReal] = item; // Atualiza na lista completa

    await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaCompleta));
    
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
    const restantesQtd = totalQtd - pagasQtd;
    
    const valorPagoAcumulado = item.parcelas.filter(p => p.pago).reduce((acc, p) => acc + p.valor, 0);
    const valorRestantePagar = item.valorTotal - valorPagoAcumulado;
    
    const progresso = pagasQtd / totalQtd;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9} 
        onPress={() => abrirDetalhes(item)}
        onLongPress={() => confirmarArquivamento(item)} // <--- A MÁGICA AQUI
        delayLongPress={800} // Precisa segurar por 0.8s
      >
        
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitulo}>{item.nome}</Text>
          {item.autoPay && <Text style={styles.badgeAuto}>Automático ⚡</Text>}
        </View>
        
        <View style={styles.barraFundo}>
          <View style={[styles.barraPreenchida, { width: `${progresso * 100}%` }]} />
        </View>

        <View style={styles.statsContainer}>
            <View style={styles.colunaStat}>
                <Text style={styles.labelStat}>Total</Text>
                <Text style={styles.valorStat}>{formatarMoeda(item.valorTotal)}</Text>
            </View>
            <View style={styles.separadorVertical} />
            <View style={styles.colunaStat}>
                <Text style={styles.labelStat}>Pago</Text>
                <Text style={[styles.valorStat, {color: '#22c55e'}]}>{formatarMoeda(valorPagoAcumulado)}</Text>
            </View>
            <View style={styles.separadorVertical} />
            <View style={styles.colunaStat}>
                <Text style={styles.labelStat}>Falta</Text>
                <Text style={[styles.valorStat, {color: '#ef4444'}]}>{formatarMoeda(valorRestantePagar)}</Text>
            </View>
        </View>
        
        <View style={styles.infoParcelasRow}>
            <Text style={styles.txtInfoParcelas}>
                {pagasQtd} Pagas • Restam {restantesQtd}
            </Text>
            <Text style={styles.txtInfoParcelasTotal}>
                {pagasQtd}/{totalQtd}
            </Text>
        </View>

        {proxima ? (
          <View style={styles.areaAcao}>
            <View>
              <Text style={styles.labelVencimento}>Vence {formatarData(proxima.vencimento)}</Text>
              <Text style={styles.valorParcela}>{formatarMoeda(proxima.valor)}</Text>
            </View>
            
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
          <View style={styles.quitado}><Text style={styles.txtQuitado}>DÍVIDA QUITADA 🎉</Text></View>
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
            <Text style={styles.painelValorVerde}>{formatarMoeda(financeiro.totalGanhos)}</Text>
        </View>
        <View style={styles.painelLinha}>
            <Text style={styles.painelLabel}>Saídas Realizadas</Text>
            <Text style={styles.painelValorVermelho}>- {formatarMoeda(financeiro.totalPago)}</Text>
        </View>
        <View style={styles.divisor} />
        <View style={styles.painelLinha}>
            <Text style={styles.saldoLabel}>SALDO ATUAL</Text>
            <Text style={[styles.saldoValor, { color: financeiro.saldoAtual >= 0 ? '#22c55e' : '#ef4444' }]}>
                {formatarMoeda(financeiro.saldoAtual)}
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
            <Text style={styles.menuTexto}>Ganho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuOpcao, {backgroundColor: '#ef4444'}]} onPress={() => irParaCadastro('despesa')}>
            <Text style={styles.menuTexto}>Dívida</Text>
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
                <View style={styles.resumoModal}>
                     <Text style={styles.txtResumoModal}>Total: {itemSelecionado && formatarMoeda(itemSelecionado.valorTotal)}</Text>
                </View>
                <ScrollView style={styles.modalLista}>
                    {itemSelecionado?.parcelas.map((p, index) => (
                        <View key={index} style={[styles.linhaParcela, p.pago ? styles.linhaPaga : null]}>
                            <Text style={styles.txtNumero}>#{p.numero}</Text>
                            <Text style={styles.txtData}>{formatarData(p.vencimento)}</Text>
                            <Text style={[styles.txtValor, p.pago && styles.txtValorPago]}>{formatarMoeda(p.valor)}</Text>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  cardTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  badgeAuto: { fontSize: 10, color: '#eab308', fontWeight: 'bold' },
  
  barraFundo: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 3, marginVertical: 10, overflow: 'hidden' },
  barraPreenchida: { height: '100%', backgroundColor: '#22c55e' },
  
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 10 },
  colunaStat: { alignItems: 'center', flex: 1 },
  separadorVertical: { width: 1, backgroundColor: '#cbd5e1' },
  labelStat: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  valorStat: { fontSize: 12, fontWeight: 'bold', color: '#334155' },

  infoParcelasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  txtInfoParcelas: { fontSize: 12, color: '#64748b' },
  txtInfoParcelasTotal: { fontSize: 12, fontWeight: 'bold', color: '#334155' },

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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  modalFechar: { fontSize: 20, color: '#94a3b8' },
  resumoModal: { marginBottom: 10 },
  txtResumoModal: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  linhaParcela: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  linhaPaga: { opacity: 0.5 },
  txtNumero: { fontWeight: 'bold', color: '#334155' },
  txtData: { color: '#94a3b8' },
  txtValor: { fontWeight: 'bold', color: '#ef4444' },
  txtValorPago: { color: '#22c55e', textDecorationLine: 'line-through' }
});