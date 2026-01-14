import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Ganhos({ navigation }) {
  const [listaGanhos, setListaGanhos] = useState([]);
  const [totalGanhos, setTotalGanhos] = useState(0);

  const formatarMoeda = (valor) => {
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const formatarData = (isoDate) => {
    const data = new Date(isoDate);
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth()+1).toString().padStart(2, '0')}/${data.getFullYear()}`;
  };

  const carregarGanhos = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_ganhos');
      let dados = json ? JSON.parse(json) : [];

      // Ordenar por data (Mais recentes primeiro)
      dados.sort((a, b) => {
        // Pega a data da primeira parcela (que é a data do ganho na nossa lógica simplificada)
        const dataA = new Date(a.parcelas[0].vencimento);
        const dataB = new Date(b.parcelas[0].vencimento);
        return dataB - dataA;
      });

      // Calcular Totalzão
      let soma = 0;
      dados.forEach(item => {
        soma += item.valorTotal;
      });

      setListaGanhos(dados);
      setTotalGanhos(soma);

    } catch (e) {
      console.log(e);
    }
  };

  useFocusEffect(useCallback(() => {
    carregarGanhos();
  }, []));

  // --- FUNÇÃO DELETAR ---
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
        carregarGanhos(); // Atualiza a tela
    } catch (e) {
        Alert.alert("Erro", "Não foi possível apagar.");
    }
  };

  const renderItem = ({ item }) => {
    // Na nossa lógica simplificada, o ganho tem 1 parcela ou é recorrente, 
    // mas a data base fica na primeira parcela.
    const dataGanho = item.parcelas[0].vencimento;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onLongPress={() => confirmarExclusao(item.id)} // Segura pra apagar
        delayLongPress={600}
      >
        <View style={styles.iconContainer}>
            <Text style={{fontSize: 20}}>💰</Text>
        </View>
        
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
      
      {/* CABEÇALHO VERDE (Estilo Home) */}
      <View style={styles.header}>
        <Text style={styles.labelHeader}>Total Acumulado</Text>
        <Text style={styles.valorHeader}>{formatarMoeda(totalGanhos)}</Text>
        
        <View style={styles.resumoBadge}>
            <Text style={styles.resumoTexto}>🚀 Foguete não tem ré</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.rowTitulo}>
            <Text style={styles.tituloLista}>Histórico de Entradas</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Cadastro', { tipoOperacao: 'ganho' })}>
                <Text style={styles.btnNovo}>+ Novo</Text>
            </TouchableOpacity>
        </View>

        <FlatList 
            data={listaGanhos}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                    <Text style={{fontSize: 40}}>💸</Text>
                    <Text style={styles.emptyTxt}>Nenhum ganho registrado.</Text>
                </View>
            )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // --- HEADER (VERDE ESCURO PRA DIFERENCIAR DA HOME) ---
  header: {
    backgroundColor: '#14532d', // Verde bem escuro e chique
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 30 : 70,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 10,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    alignItems: 'center'
  },
  labelHeader: { color: '#86efac', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  valorHeader: { color: '#fff', fontSize: 40, fontWeight: '800', marginVertical: 5 },
  
  resumoBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  resumoTexto: { color: '#fff', fontWeight: '600', fontSize: 12 },

  // --- CORPO ---
  body: { flex: 1, paddingHorizontal: 20, marginTop: 25 },
  
  rowTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tituloLista: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  btnNovo: { color: '#15803d', fontWeight: 'bold', fontSize: 14 },

  // --- CARD GANHO ---
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    
    // Sombra Suave
    elevation: 2,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0fdf4' // Borda verdinha bem clara
  },
  iconContainer: {
    width: 46, height: 46, borderRadius: 12, backgroundColor: '#dcfce7',
    justifyContent: 'center', alignItems: 'center', marginRight: 15
  },
  infoContainer: { flex: 1 },
  cardTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  cardData: { fontSize: 12, color: '#64748b', marginTop: 2 },
  
  cardValor: { fontSize: 16, fontWeight: 'bold', color: '#15803d' },
  cardStatus: { fontSize: 10, color: '#15803d', fontWeight: 'bold', backgroundColor: '#dcfce7', alignSelf: 'flex-end', paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyTxt: { color: '#94a3b8', marginTop: 10, fontSize: 16 }
});