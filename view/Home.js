import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, Modal, ScrollView, Dimensions, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { changeIcon, getIcon } from 'react-native-change-icon';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width } = Dimensions.get('window');

export default function Home({ navigation }) {
  const [dados, setDados] = useState([]);
  const [nomeUsuario, setNomeUsuario] = useState('Campeão');
  const [carregando, setCarregando] = useState(true);
  
  const confettiRef = useRef(null);

  const [financeiro, setFinanceiro] = useState({
    totalGanhos: 0,
    totalPago: 0,
    saldoAtual: 0
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [menuAddAberto, setMenuAddAberto] = useState(false);

  const gerenciarIconeApp = async (temAtraso) => {
    try {
      const iconeAtual = await getIcon();
      if (temAtraso && iconeAtual !== 'MainActivityPerigo') {
        await changeIcon('MainActivityPerigo');
      } else if (!temAtraso && iconeAtual !== 'MainActivityDefault') {
        await changeIcon('MainActivityDefault');
      }
    } catch (e) { }
  };

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const perfilJson = await AsyncStorage.getItem('@pacelo_perfil');
      if (perfilJson) setNomeUsuario(JSON.parse(perfilJson).nome);

      const dividasJson = await AsyncStorage.getItem('@pacelo_db');
      let listaDividas = dividasJson ? JSON.parse(dividasJson) : [];

      const ganhosJson = await AsyncStorage.getItem('@pacelo_ganhos');
      const listaGanhos = ganhosJson ? JSON.parse(ganhosJson) : [];

      const { dividasAtualizadas, pagouAlgo, temAtrasoGeral } = verificarAutomacao(listaDividas);
      
      if (pagouAlgo) {
        listaDividas = dividasAtualizadas;
        await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaDividas));
      }

      gerenciarIconeApp(temAtrasoGeral);

      const listaAtiva = listaDividas.filter(item => {
          const tudoPago = item.parcelas.every(p => p.pago);
          return !item.arquivado && !tudoPago; 
      });

      setDados(listaAtiva);
      calcularFluxoCaixa(listaAtiva, listaGanhos);

    } catch (e) {
      console.log('Erro ao ler dados', e);
    } finally {
        setTimeout(() => setCarregando(false), 500);
    }
  };

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  const verificarAutomacao = (dividas) => {
    let pagouAlgo = false;
    let temAtrasoGeral = false;
    const hoje = new Date();
    hoje.setHours(0,0,0,0); 

    dividas.forEach(item => {
        const temVencidaNesseItem = item.parcelas.some(p => !p.pago && new Date(p.vencimento) < hoje);
        if (temVencidaNesseItem) temAtrasoGeral = true;

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

    return { dividasAtualizadas: dividas, pagouAlgo, temAtrasoGeral };
  };

  const calcularFluxoCaixa = (dividas, ganhos) => {
    const hoje = new Date();
    let totalEntradas = 0;
    ganhos.forEach(item => {
        item.parcelas.forEach(p => {
            if (new Date(p.vencimento) <= hoje) totalEntradas += p.valor;
        });
    });

    let totalSaidas = 0;
    dividas.forEach(item => {
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

  const confirmarArquivamento = (item) => {
    Alert.alert(
      "Arquivar?", 
      `Ocultar "${item.nome}" da lista?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Arquivar", onPress: () => arquivarItem(item.id), style: 'destructive' }
      ]
    );
  };

  const arquivarItem = async (id) => {
    try {
      const dividasJson = await AsyncStorage.getItem('@pacelo_db');
      let lista = dividasJson ? JSON.parse(dividasJson) : [];
      const novaLista = lista.map(item => item.id === id ? { ...item, arquivado: true } : item);
      await AsyncStorage.setItem('@pacelo_db', JSON.stringify(novaLista));
      carregarDados();
    } catch (e) {}
  };

  const pagarProximaParcela = async (itemIndex) => {
    const itemTela = dados[itemIndex];
    const dividasJson = await AsyncStorage.getItem('@pacelo_db');
    let listaCompleta = dividasJson ? JSON.parse(dividasJson) : [];
    
    const indexReal = listaCompleta.findIndex(i => i.id === itemTela.id);
    if (indexReal === -1) return;

    const item = listaCompleta[indexReal];
    const parcelaIndex = item.parcelas.findIndex(p => !p.pago);
    if (parcelaIndex === -1) return;

    if (financeiro.saldoAtual < item.parcelas[parcelaIndex].valor) {
        Alert.alert("Saldo Insuficiente", "Sem caixa para pagar isso agora.");
        return;
    }

    const parcelasRestantes = item.parcelas.filter(p => !p.pago).length;
    const ehUltima = parcelasRestantes === 1;

    if (ehUltima) {
        confettiRef.current && confettiRef.current.start();
        item.parcelas[parcelaIndex].pago = true;
        listaCompleta[indexReal] = item;
        
        setTimeout(async () => {
            await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaCompleta));
            carregarDados();
            if (itemSelecionado && itemSelecionado.id === item.id) setItemSelecionado(null);
        }, 1500);

    } else {
        item.parcelas[parcelaIndex].pago = true;
        listaCompleta[indexReal] = item;
        await AsyncStorage.setItem('@pacelo_db', JSON.stringify(listaCompleta));
        carregarDados();
        if (itemSelecionado && itemSelecionado.id === item.id) setItemSelecionado(item);
    }
  };

  const formatarData = (isoDate) => {
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth()+1).toString().padStart(2, '0')}`;
  };

  const abrirDetalhes = (item) => {
    setItemSelecionado(item);
    setModalVisible(true);
  };

  const irParaCadastro = (tipo) => {
    setMenuAddAberto(false);
    navigation.navigate('Cadastro', { tipoOperacao: tipo });
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🧘‍♂️</Text>
        <Text style={styles.emptyTitle}>Tudo em Paz!</Text>
        <Text style={styles.emptySub}>Você não tem nenhuma dívida pendente.</Text>
        <Text style={styles.emptySub}>Aproveite o momento.</Text>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const proxima = item.parcelas.find(p => !p.pago);
    const pagasQtd = item.parcelas.filter(p => p.pago).length;
    const totalQtd = item.parcelas.length;
    const progresso = pagasQtd / totalQtd;
    const valorPagoAcumulado = item.parcelas.filter(p => p.pago).reduce((acc, p) => acc + p.valor, 0);
    const valorRestante = item.valorTotal - valorPagoAcumulado;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const estaAtrasada = proxima && new Date(proxima.vencimento) < hoje;

    return (
      <TouchableOpacity 
        style={[styles.card, estaAtrasada && styles.cardAtrasado]} 
        activeOpacity={0.9} 
        onPress={() => abrirDetalhes(item)}
        onLongPress={() => confirmarArquivamento(item)}
        delayLongPress={600}
      >
        <View style={styles.cardHeader}>
          <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
             <View style={[styles.iconPlaceholder, {backgroundColor: estaAtrasada ? '#fee2e2' : '#f1f5f9'}]}>
                <Text style={{fontSize: 18}}>{estaAtrasada ? '🚨' : '🛍️'}</Text>
             </View>
             <View style={{marginLeft: 12, flex: 1}}>
                <Text style={styles.cardTitulo} numberOfLines={1}>{item.nome}</Text>
                <Text style={styles.cardSubtitulo}>{pagasQtd}/{totalQtd} parcelas</Text>
             </View>
          </View>
          
          <View style={{alignItems: 'flex-end'}}>
             <Text style={styles.valorTotalCard}>{formatarMoeda(item.valorTotal)}</Text>
             {item.autoPay && <View style={styles.badgeAuto}><Text style={styles.txtBadge}>AUTO</Text></View>}
          </View>
        </View>

        <View style={[styles.statsRow, estaAtrasada ? {backgroundColor: '#fecaca'} : {}]}>
            <View style={styles.statItem}>
                <Text style={styles.statLabel}>Pago</Text>
                <Text style={[styles.statValor, {color: '#16a34a'}]}>{formatarMoeda(valorPagoAcumulado)}</Text>
            </View>
            <View style={styles.statDivisor}/>
            <View style={styles.statItem}>
                <Text style={styles.statLabel}>Restante</Text>
                <Text style={[styles.statValor, {color: estaAtrasada ? '#dc2626' : '#64748b'}]}>
                    {formatarMoeda(valorRestante)}
                </Text>
            </View>
        </View>

        <View style={styles.barraFundo}>
          <View style={[styles.barraPreenchida, { width: `${progresso * 100}%`, backgroundColor: estaAtrasada ? '#ef4444' : '#22c55e' }]} />
        </View>

        {proxima ? (
          <View style={styles.footerCard}>
             <View>
                <Text style={[styles.labelVencimento, {color: estaAtrasada ? '#ef4444' : '#64748b'}]}>
                    {estaAtrasada ? `VENCEU ${formatarData(proxima.vencimento)}` : `Vence ${formatarData(proxima.vencimento)}`}
                </Text>
                <Text style={styles.valorParcelaDestaque}>{formatarMoeda(proxima.valor)}</Text>
             </View>

             {!item.autoPay && (
                 <TouchableOpacity style={[styles.btnPagar, estaAtrasada && styles.btnPagarAtrasado]} onPress={() => pagarProximaParcela(index)}>
                    <Text style={styles.txtBtnPagar}>PAGAR</Text>
                 </TouchableOpacity>
             )}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      <ConfettiCannon count={200} origin={{x: -10, y: 0}} autoStart={false} ref={confettiRef} fadeOut={true} />

      <View style={styles.painelPrincipal}>
        <View style={styles.headerTop}>
            <View>
                <Text style={styles.saudacao}>Olá, {nomeUsuario}</Text>
                <Text style={styles.dataHoje}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}</Text>
            </View>
            <TouchableOpacity style={styles.btnPerfil} onPress={() => navigation.navigate('Perfil')}>
                <Text style={{fontSize:18}}>👤</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.saldoContainer}>
            <Text style={styles.labelSaldo}>Saldo Disponível</Text>
            <Text style={styles.valorSaldo}>{formatarMoeda(financeiro.saldoAtual)}</Text>
        </View>

        <View style={styles.resumoRow}>
            <View style={styles.resumoItem}>
                <View style={[styles.dot, {backgroundColor: '#4ade80'}]}/>
                <Text style={styles.resumoLabel}>Entradas</Text>
                <Text style={styles.resumoValor}>{formatarMoeda(financeiro.totalGanhos)}</Text>
            </View>
            <View style={styles.resumoDivisor}/>
            <View style={styles.resumoItem}>
                <View style={[styles.dot, {backgroundColor: '#f87171'}]}/>
                <Text style={styles.resumoLabel}>Saídas</Text>
                <Text style={styles.resumoValor}>{formatarMoeda(financeiro.totalPago)}</Text>
            </View>
        </View>
      </View>

      <View style={styles.bodyContainer}>
          <Text style={styles.tituloSecao}>Próximos Pagamentos</Text>
          {carregando ? (
              <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0f172a" />
                  <Text style={styles.loadingTxt}>Organizando finanças...</Text>
              </View>
          ) : (
              <FlatList 
                data={dados}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={EmptyState} 
              />
          )}
      </View>

      {menuAddAberto && (
        <>
            <TouchableOpacity style={styles.backdropMenu} activeOpacity={1} onPress={() => setMenuAddAberto(false)} />
            <View style={styles.menuAddContainer}>
                <TouchableOpacity style={styles.menuOpcao} onPress={() => irParaCadastro('ganho')}>
                    <Text style={styles.menuIcone}>💰</Text>
                    <Text style={styles.menuTexto}>Entrada</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuOpcao} onPress={() => irParaCadastro('despesa')}>
                    <Text style={styles.menuIcone}>💸</Text>
                    <Text style={styles.menuTexto}>Dívida</Text>
                </TouchableOpacity>
            </View>
        </>
      )}

      <TouchableOpacity 
        style={[styles.fab, menuAddAberto && {transform: [{rotate: '45deg'}]}]}
        onPress={() => setMenuAddAberto(!menuAddAberto)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabTexto}>+</Text>
      </TouchableOpacity>

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                <View style={styles.modalDragIndicator} />
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitulo}>{itemSelecionado?.nome}</Text>
                    <Text style={styles.modalTotal}>{itemSelecionado && formatarMoeda(itemSelecionado.valorTotal)}</Text>
                </View>
                
                <ScrollView style={styles.modalLista}>
                    {itemSelecionado?.parcelas.map((p, index) => {
                        // --- LÓGICA DO VERMELHO NO DETALHE ---
                        const hoje = new Date();
                        hoje.setHours(0,0,0,0);
                        const dataVenc = new Date(p.vencimento);
                        const estaVencida = !p.pago && dataVenc < hoje;
                        // -------------------------------------

                        return (
                            <View key={index} style={[styles.linhaParcela, p.pago ? styles.linhaPaga : null]}>
                                <View style={{flexDirection:'row', alignItems:'center'}}>
                                    {/* Bolinha: Verde se pago, Vermelho se Vencido, Cinza se Futuro */}
                                    <View style={[styles.bolinhaStatus, {backgroundColor: p.pago ? '#22c55e' : (estaVencida ? '#ef4444' : '#e2e8f0')}]}/>
                                    
                                    {/* Texto: Vermelho se vencido */}
                                    <Text style={[styles.txtNumero, estaVencida && {color: '#ef4444'}]}>
                                        Parcela {p.numero}
                                    </Text>
                                </View>

                                <View style={{alignItems:'flex-end'}}>
                                    <Text style={[styles.txtValor, estaVencida && {color: '#ef4444'}]}>
                                        {formatarMoeda(p.valor)}
                                    </Text>
                                    <Text style={[styles.txtData, estaVencida && {color: '#ef4444', fontWeight: 'bold'}]}>
                                        {formatarData(p.vencimento)} {estaVencida ? '⚠️' : ''}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  painelPrincipal: { backgroundColor: '#0f172a', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60, paddingHorizontal: 24, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, zIndex: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  saudacao: { color: '#94a3b8', fontSize: 16, fontWeight: '500' },
  dataHoje: { color: '#fff', fontSize: 14, fontWeight: 'bold', textTransform: 'capitalize' },
  btnPerfil: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  saldoContainer: { alignItems: 'center', marginBottom: 25 },
  labelSaldo: { color: '#cbd5e1', fontSize: 14, marginBottom: 5 },
  valorSaldo: { color: '#fff', fontSize: 36, fontWeight: '800' },
  resumoRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 15 },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoDivisor: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  resumoLabel: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  resumoValor: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bodyContainer: { flex: 1, paddingHorizontal: 20, marginTop: 20 },
  tituloSecao: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  loadingTxt: { marginTop: 10, color: '#64748b', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40, padding: 20 },
  emptyEmoji: { fontSize: 50, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#334155', marginBottom: 5 },
  emptySub: { color: '#64748b', textAlign: 'center', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, elevation: 3, shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  cardAtrasado: { borderColor: '#ef4444', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  iconPlaceholder: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  cardSubtitulo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  valorTotalCard: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  badgeAuto: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: 'flex-end' },
  txtBadge: { color: '#d97706', fontSize: 10, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivisor: { width: 1, backgroundColor: '#e2e8f0' },
  statLabel: { fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase' },
  statValor: { fontSize: 13, fontWeight: 'bold' },
  barraFundo: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, marginBottom: 15 },
  barraPreenchida: { height: '100%', borderRadius: 3 },
  footerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelVencimento: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  valorParcelaDestaque: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  btnPagar: { backgroundColor: '#0f172a', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnPagarAtrasado: { backgroundColor: '#ef4444' },
  txtBtnPagar: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor:'#2563eb', shadowOpacity: 0.4, shadowRadius: 10 },
  fabTexto: { color: '#fff', fontSize: 32, marginTop: -4, fontWeight: '300' },
  backdropMenu: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.8)' },
  menuAddContainer: { position: 'absolute', bottom: 100, right: 20, alignItems: 'flex-end' },
  menuOpcao: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, paddingHorizontal: 20, borderRadius: 50, marginBottom: 12, elevation: 5 },
  menuIcone: { fontSize: 20, marginRight: 10 },
  menuTexto: { fontWeight: 'bold', color: '#1e293b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '65%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalDragIndicator: { width: 40, height: 5, backgroundColor: '#e2e8f0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  modalTotal: { fontSize: 18, color: '#64748b' },
  linhaParcela: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  linhaPaga: { opacity: 0.4 },
  bolinhaStatus: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  txtNumero: { fontWeight: '600', color: '#334155' },
  txtData: { color: '#94a3b8', fontSize: 12 },
  txtValor: { fontWeight: 'bold', color: '#1e293b' },
});