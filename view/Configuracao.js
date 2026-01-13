import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Configuracao() {
  const [nome, setNome] = useState('');
  const [tipoTrabalho, setTipoTrabalho] = useState('CLT'); // CLT, PJ, Autonomo

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    try {
      const json = await AsyncStorage.getItem('@pacelo_perfil');
      if (json) {
        const perfil = JSON.parse(json);
        setNome(perfil.nome);
        setTipoTrabalho(perfil.tipoTrabalho);
      }
    } catch (e) {
      console.log('Erro ao carregar perfil');
    }
  };

  const salvar = async () => {
    if (!nome) {
      Alert.alert('Opa', 'Como você quer ser chamado?');
      return;
    }

    const perfil = { nome, tipoTrabalho };
    try {
      await AsyncStorage.setItem('@pacelo_perfil', JSON.stringify(perfil));
      Alert.alert('Sucesso', 'Perfil atualizado! O Pacelo já te conhece.');
    } catch (e) {
      Alert.alert('Erro', 'Não deu pra salvar.');
    }
  };

  const limparTudo = async () => {
    Alert.alert(
      "PERIGO ⚠️",
      "Isso vai apagar TODAS as suas dívidas e ganhos. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "SIM, APAGAR TUDO", 
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            setNome('');
            setTipoTrabalho('CLT');
            Alert.alert('Reset', 'App zerado. Comece do zero.');
          }
        }
      ]
    );
  };

  const OpcaoTrabalho = ({ titulo, valor }) => (
    <TouchableOpacity 
      style={[styles.btnOpcao, tipoTrabalho === valor && styles.btnOpcaoAtivo]}
      onPress={() => setTipoTrabalho(valor)}
    >
      <Text style={[styles.txtOpcao, tipoTrabalho === valor && styles.txtOpcaoAtivo]}>
        {titulo}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tituloHeader}>Configuração ⚙️</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Como quer ser chamado?</Text>
        <TextInput 
          style={styles.input}
          placeholder="Ex: O Magnata, O Endividado..."
          value={nome}
          onChangeText={setNome}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Qual sua situação atual?</Text>
        <View style={styles.rowOpcoes}>
          <OpcaoTrabalho titulo="CLT (Carteira)" valor="CLT" />
          <OpcaoTrabalho titulo="PJ (Empresa)" valor="PJ" />
          <OpcaoTrabalho titulo="Autônomo" valor="Autonomo" />
        </View>
        <Text style={styles.dica}>
          {tipoTrabalho === 'CLT' && "Fixo todo mês, com descontos."}
          {tipoTrabalho === 'PJ' && "Sem descontos, mas sem garantias."}
          {tipoTrabalho === 'Autonomo' && "Matando um leão por dia."}
        </Text>
      </View>

      <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
        <Text style={styles.txtSalvar}>Salvar Perfil</Text>
      </TouchableOpacity>

      <View style={styles.divisor} />

      <Text style={styles.zonaPerigo}>Zona de Perigo</Text>
      <TouchableOpacity style={styles.btnReset} onPress={limparTudo}>
        <Text style={styles.txtReset}>Resetar Todo o App</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0f172a', padding: 20, marginBottom: 20 },
  tituloHeader: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  
  section: { paddingHorizontal: 20, marginBottom: 25 },
  label: { fontSize: 16, color: '#334155', fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 15, fontSize: 16, color: '#0f172a' },
  
  rowOpcoes: { flexDirection: 'row', justifyContent: 'space-between' },
  btnOpcao: { flex: 1, alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginHorizontal: 2, backgroundColor: '#fff' },
  btnOpcaoAtivo: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  txtOpcao: { color: '#64748b', fontWeight: '600' },
  txtOpcaoAtivo: { color: '#fff', fontWeight: 'bold' },
  dica: { marginTop: 8, fontSize: 12, color: '#64748b', fontStyle: 'italic' },

  btnSalvar: { margin: 20, backgroundColor: '#2563eb', padding: 18, borderRadius: 10, alignItems: 'center', elevation: 2 },
  txtSalvar: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  divisor: { height: 1, backgroundColor: '#cbd5e1', margin: 20 },
  
  zonaPerigo: { marginLeft: 20, color: '#ef4444', fontWeight: 'bold', marginBottom: 10 },
  btnReset: { marginHorizontal: 20, borderWidth: 1, borderColor: '#ef4444', padding: 15, borderRadius: 10, alignItems: 'center' },
  txtReset: { color: '#ef4444', fontWeight: 'bold' }
});