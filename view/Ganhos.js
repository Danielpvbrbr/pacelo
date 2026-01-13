import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Ganhos({ navigation }) {
  const [ganhos, setGanhos] = useState([]);
  const [totalGanhos, setTotalGanhos] = useState(0);

  const carregar = async () => {
    const json = await AsyncStorage.getItem('@pacelo_ganhos');
    if (json) {
      const lista = JSON.parse(json);
      setGanhos(lista);
      setTotalGanhos(lista.reduce((acc, item) => acc + item.valorTotal, 0));
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#15803d" />
      <View style={styles.header}>
        <Text style={styles.titulo}>Meus Ganhos 🤑</Text>
        <Text style={styles.total}>Total: R$ {totalGanhos.toFixed(2)}</Text>
      </View>

      <FlatList
        data={ganhos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.nome}>{item.nome}</Text>
            <Text style={styles.valor}>+ R$ {item.valorTotal.toFixed(2)}</Text>
            <Text style={styles.freq}>{item.frequencia}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.vazio}>Sem renda cadastrada.</Text>}
      />

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('Cadastro', { tipoOperacao: 'ganho' })}
      >
        <Text style={styles.fabTexto}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  header: { backgroundColor: '#15803d', padding: 20, alignItems: 'center', marginBottom: 10 },
  titulo: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  total: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 20, marginHorizontal: 20, marginBottom: 10, borderRadius: 10, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 16, fontWeight: 'bold', color: '#14532d' },
  valor: { fontSize: 16, fontWeight: 'bold', color: '#22c55e' },
  freq: { fontSize: 12, color: '#86efac' },
  vazio: { textAlign: 'center', marginTop: 50, color: '#15803d' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#15803d', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabTexto: { color: '#fff', fontSize: 30 }
});