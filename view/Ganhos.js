import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Ganhos({ navigation }) {
  const [listaGanhos, setListaGanhos] = useState([]);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  
  // Estados para o Filtro de Data
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const formatarData = (isoDate) => {
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
  };

  const carregarGanhos = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_ganhos');
      let dados = json ? JSON.parse(json) : [];

      // Ordenar por data (Mais recentes primeiro)
      dados.sort((a, b) => {
        const dataA = new Date(a.parcelas[0].vencimento);
        const dataB = new Date(b.parcelas[0].vencimento);
        return dataB - dataA;
      });

      setListaGanhos(dados);
      calcularTotalPorMes(dados, mesFiltro);

    } catch (e) {
      console.log(e);
    }
  };

  // Função para calcular o total baseado no mês selecionado
  const calcularTotalPorMes = (dados, mesIndex) => {
    const anoAtual = new Date().getFullYear();
    const filtrados = dados.filter(item => {
      const data = new Date(item.parcelas[0].vencimento);
      return data.getMonth() === mesIndex && data.getFullYear() === anoAtual;
    });

    const soma = filtrados.reduce((acc, item) => acc + item.valorTotal, 0);
    setTotalFiltrado(soma);
  };

  // Atualiza o cálculo sempre que o mês mudar
  const mudarMes = (index) => {
    setMesFiltro(index);
    calcularTotalPorMes(listaGanhos, index);
  };

  useFocusEffect(useCallback(() => {
    carregarGanhos();
  }, []));

  const confirmarExclusao = (id) => {
    Alert.alert(
      "Remover Ganho?",
      "Esse valor será descontado do seu histórico.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", onPress: () => deletarItem(id), style: 'destructive' }
      ]
    );
  };

  const deletarItem = async (id) => {
    try {
      const novaLista = listaGanhos.filter(item => item.id !== id);
      await AsyncStorage.setItem('@pacelo_ganhos', JSON.stringify(novaLista));
      carregarGanhos();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível apagar.");
    }
  };

  // Filtra a lista da FlatList para exibir apenas o mês selecionado
  const dadosExibidos = listaGanhos.filter(item => {
    const d = new Date(item.parcelas[0].vencimento);
    return d.getMonth() === mesFiltro && d.getFullYear() === new Date().getFullYear();
  });

  const renderItem = ({ item }) => {
    const dataGanho = item.parcelas[0].vencimento;
    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onLongPress={() => confirmarExclusao(item.id)}
        delayLongPress={600}
      >
        <View style={styles.iconContainer}><Text style={{fontSize: 20}}>💰</Text></View>
        <View style={styles.infoContainer}>
          <Text style={styles.cardTitulo}>{item.nome}</Text>
          <Text style={styles.cardData}>{formatarData(dataGanho)}</Text>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={styles.cardValor}>{formatarMoeda(item.valorTotal)}</Text>
          <Text style={styles.cardStatus}>Recebido</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />
      
      <View style={styles.header}>
        <Text style={styles.labelHeader}>Ganhos em {meses[mesFiltro]}</Text>
        <Text style={styles.valorHeader}>{formatarMoeda(totalFiltrado)}</Text>
        <View style={styles.resumoBadge}>
            <Text style={styles.resumoTexto}>Foguete não tem ré 🚀</Text>
        </View>
      </View>

      {/* FILTRO DE MESES (Carrossel) */}
      <View style={styles.filtroContainer}>
        <FlatList 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          data={meses}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({item, index}) => (
            <TouchableOpacity 
              onPress={() => mudarMes(index)} 
              style={[styles.mesItem, mesFiltro === index && styles.mesAtivo]}
            >
              <Text style={[styles.mesTexto, mesFiltro === index && {color: '#fff'}]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.rowTitulo}>
            <Text style={styles.tituloLista}>Entradas de {meses[mesFiltro]}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Cadastro', { tipoOperacao: 'ganho' })}>
                <Text style={styles.btnNovo}>+ Novo</Text>
            </TouchableOpacity>
        </View>

        <FlatList 
            data={dadosExibidos}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                    <Text style={{fontSize: 40}}>🍃</Text>
                    <Text style={styles.emptyTxt}>Nenhum ganho em {meses[mesFiltro]}.</Text>
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
    backgroundColor: '#14532d',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center'
  },
  labelHeader: { color: '#86efac', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  valorHeader: { color: '#fff', fontSize: 36, fontWeight: '800', marginVertical: 5 },
  resumoBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  resumoTexto: { color: '#fff', fontWeight: '600', fontSize: 11 },

  // Estilos do Filtro
  filtroContainer: { paddingVertical: 15, backgroundColor: '#fff' },
  mesItem: { paddingHorizontal: 20, paddingVertical: 8, marginHorizontal: 5, borderRadius: 20, backgroundColor: '#f1f5f9' },
  mesAtivo: { backgroundColor: '#15803d' },
  mesTexto: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },

  body: { flex: 1, paddingHorizontal: 20 },
  rowTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  tituloLista: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  btnNovo: { color: '#15803d', fontWeight: 'bold', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#f0fdf4'
  },
  iconContainer: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoContainer: { flex: 1 },
  cardTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  cardData: { fontSize: 12, color: '#64748b' },
  cardValor: { fontSize: 16, fontWeight: 'bold', color: '#15803d' },
  cardStatus: { fontSize: 10, color: '#15803d', fontWeight: 'bold', backgroundColor: '#dcfce7', alignSelf: 'flex-end', paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyTxt: { color: '#94a3b8', marginTop: 10, fontSize: 15 }
});