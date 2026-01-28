import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Historico() {
  const [listaPagas, setListaPagas] = useState([]);
  const [totalFiltrado, setTotalFiltrado] = useState(0);

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const formatarData = (isoDate) => {
    if (!isoDate) return '-';
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
  };

  const carregarHistorico = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_db');
      const todas = json ? JSON.parse(json) : [];

      // FILTRO: Só entram as que possuem dataQuitacao preenchida (xeque-mate)
      const apenasPagas = todas.filter(item => item.dataQuitacao !== null && item.dataQuitacao !== undefined);

      // Ordenar: Pela data REAL da quitação (as mais recentes no topo)
      apenasPagas.sort((a, b) => new Date(b.dataQuitacao) - new Date(a.dataQuitacao));

      setListaPagas(apenasPagas);
      calcularTotalPorMes(apenasPagas, mesFiltro);

    } catch (e) {
      console.log(e);
    }
  };

  const calcularTotalPorMes = (dados, mesIndex) => {
    const anoAtual = new Date().getFullYear();
    const filtrados = dados.filter(item => {
      // Usamos a data de quitação para o cálculo do total do cabeçalho
      const dQuitacao = new Date(item.dataQuitacao);
      return dQuitacao.getMonth() === mesIndex && dQuitacao.getFullYear() === anoAtual;
    });

    const soma = filtrados.reduce((acc, item) => acc + item.valorTotal, 0);
    setTotalFiltrado(soma);
  };

  const mudarMes = (index) => {
    setMesFiltro(index);
    calcularTotalPorMes(listaPagas, index);
  };

  useFocusEffect(useCallback(() => {
    carregarHistorico();
  }, []));

  const confirmarExclusao = (id) => {
    Alert.alert(
      "Apagar Registro?",
      "Isso remove a conta permanentemente do histórico.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", onPress: () => deletarItem(id), style: 'destructive' }
      ]
    );
  };

  const deletarItem = async (id) => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_db');
      let todas = json ? JSON.parse(json) : [];
      const novaLista = todas.filter(item => item.id !== id);
      await AsyncStorage.setItem('@pacelo_db', JSON.stringify(novaLista));
      carregarHistorico();
    } catch (e) { }
  };

  // Filtra os itens da lista exibida com base na dataQuitacao
  const dadosExibidos = listaPagas.filter(item => {
    const d = new Date(item.dataQuitacao);
    return d.getMonth() === mesFiltro && d.getFullYear() === new Date().getFullYear();
  });

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onLongPress={() => confirmarExclusao(item.id)}
        delayLongPress={600}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}><Text style={{ fontSize: 18 }}>🏆</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{item.nome}</Text>
            {/* Texto informativo usando a data real do pagamento */}
            <Text style={styles.subtitulo}>Quitado em {formatarData(item.dataQuitacao)}</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>CONCLUÍDO</Text></View>
        </View>
        <View style={styles.divisor} />
        <View style={styles.rowInfo}>
          <View>
            <Text style={styles.label}>Valor Total Pago</Text>
            <Text style={styles.valor}>{formatarMoeda(item.valorTotal)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Parcelas</Text>
            <Text style={styles.infoParcelas}>{item.parcelas.length}x (Finalizado)</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4338ca" />

      <View style={styles.header}>
        <Text style={styles.headerTitulo}>Dívidas Eliminadas em {meses[mesFiltro]}</Text>
        <Text style={styles.headerValor}>{formatarMoeda(totalFiltrado)}</Text>
        <Text style={styles.headerSub}>Parabéns pela disciplina!</Text>
      </View>

      <View style={styles.filtroContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={meses}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => mudarMes(index)}
              style={[styles.mesItem, mesFiltro === index && styles.mesAtivo]}
            >
              <Text style={[styles.mesTexto, mesFiltro === index && { color: '#fff' }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.body}>
        <FlatList
          data={dadosExibidos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={styles.emptyTitle}>Nada em {meses[mesFiltro]}</Text>
              <Text style={styles.emptySub}>Contas finalizadas neste mês aparecerão aqui como troféus.</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#4338ca',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    elevation: 10,
  },
  headerTitulo: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  headerValor: { fontSize: 34, fontWeight: '800', color: '#fff', marginVertical: 5 },
  headerSub: { color: '#e0e7ff', fontSize: 13, fontStyle: 'italic' },
  filtroContainer: { paddingVertical: 15, backgroundColor: '#fff' },
  mesItem: { paddingHorizontal: 18, paddingVertical: 8, marginHorizontal: 5, borderRadius: 20, backgroundColor: '#f1f5f9' },
  mesAtivo: { backgroundColor: '#4338ca' },
  mesTexto: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  body: { flex: 1, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12,
    elevation: 2, borderWidth: 1, borderColor: '#e0e7ff'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  subtitulo: { fontSize: 11, color: '#64748b' },
  badge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: 'bold', color: '#15803d' },
  divisor: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  rowInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  valor: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' },
  infoParcelas: { fontSize: 13, fontWeight: '600', color: '#334155' },
  emptyState: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 50, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
  emptySub: { textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 5 }
});