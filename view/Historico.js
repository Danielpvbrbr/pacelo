import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Historico() {
  const [listaPagas, setListaPagas] = useState([]);
  const [totalQuitado, setTotalQuitado] = useState(0);

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const formatarData = (isoDate) => {
    if(!isoDate) return '-';
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth()+1).toString().padStart(2, '0')}/${data.getFullYear()}`;
  };

  const carregarHistorico = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_db');
      const todas = json ? JSON.parse(json) : [];

      // FILTRO: Só quem tem TODAS as parcelas pagas
      const apenasPagas = todas.filter(item => {
        return item.parcelas.every(parcela => parcela.pago === true);
      });

      // Ordenar: As que terminaram mais recentemente ficam em cima
      apenasPagas.sort((a, b) => {
        const ultimaA = a.parcelas[a.parcelas.length - 1].vencimento;
        const ultimaB = b.parcelas[b.parcelas.length - 1].vencimento;
        return new Date(ultimaB) - new Date(ultimaA);
      });

      // Calcular quanto dinheiro você já honrou
      let soma = 0;
      apenasPagas.forEach(item => soma += item.valorTotal);

      setListaPagas(apenasPagas);
      setTotalQuitado(soma);

    } catch (e) {
      console.log(e);
    }
  };

  useFocusEffect(useCallback(() => {
    carregarHistorico();
  }, []));

  // --- APAGAR DO HISTÓRICO (Lixeira) ---
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
    } catch (e) {}
  };

  const renderItem = ({ item }) => {
    const ultimaParcela = item.parcelas[item.parcelas.length - 1];

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onLongPress={() => confirmarExclusao(item.id)} // Segura pra limpar
        delayLongPress={600}
      >
        <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
                <Text style={{fontSize: 18}}>🏆</Text>
            </View>
            <View style={{flex: 1}}>
                <Text style={styles.titulo}>{item.nome}</Text>
                <Text style={styles.subtitulo}>Finalizado em {formatarData(ultimaParcela.vencimento)}</Text>
            </View>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>CONCLUÍDO</Text>
            </View>
        </View>

        <View style={styles.divisor} />

        <View style={styles.rowInfo}>
            <View>
                <Text style={styles.label}>Valor Total Pago</Text>
                <Text style={styles.valor}>{formatarMoeda(item.valorTotal)}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.label}>Parcelas</Text>
                <Text style={styles.infoParcelas}>{item.parcelas.length}x (Quitado)</Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4338ca" />
      
      {/* CABEÇALHO ROXO (Vitória) */}
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>Dívidas Eliminadas</Text>
        <Text style={styles.headerValor}>{formatarMoeda(totalQuitado)}</Text>
        <Text style={styles.headerSub}>Parabéns pela disciplina!</Text>
      </View>

      <View style={styles.body}>
        {listaPagas.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🍃</Text>
                <Text style={styles.emptyTitle}>Histórico Vazio</Text>
                <Text style={styles.emptySub}>Assim que você pagar a última parcela de uma conta, ela aparecerá aqui como um troféu.</Text>
            </View>
        ) : (
            <FlatList
                data={listaPagas}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  // --- HEADER ---
  header: { 
    backgroundColor: '#4338ca', // Roxo Índigo
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 30 : 70,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#4338ca',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  headerTitulo: { color: '#a5b4fc', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerValor: { fontSize: 36, fontWeight: '800', color: '#fff', marginVertical: 5 },
  headerSub: { color: '#e0e7ff', fontSize: 14, fontStyle: 'italic' },

  // --- LISTA ---
  body: { flex: 1, paddingHorizontal: 20, marginTop: 20 },

  // --- CARD ---
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 15, 
    elevation: 2,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e7ff'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconContainer: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef3c7',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  subtitulo: { fontSize: 12, color: '#64748b' },
  
  badge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#15803d' },

  divisor: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },

  rowInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  valor: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' }, // Valor em Roxo pra combinar
  infoParcelas: { fontSize: 14, fontWeight: '600', color: '#334155' },

  // --- EMPTY STATE ---
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 50 },
  emptyEmoji: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#334155', marginBottom: 10 },
  emptySub: { textAlign: 'center', color: '#64748b', lineHeight: 22 }
});