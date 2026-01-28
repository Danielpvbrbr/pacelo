import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Alert, Keyboard, StatusBar, SectionList, Modal, ScrollView,
  Share, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TriggerType, RepeatFrequency, AndroidImportance } from '@notifee/react-native';
import { Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import IconeWhatsApp from "./utils/IconeWhatsApp"
const screenWidth = Dimensions.get('window').width;
import { NotificationService } from '../services/NotificationService';

export default function ListaCompras() {
  const [itemInput, setItemInput] = useState('');
  const [lista, setLista] = useState([]);
  const [historicoPrecos, setHistoricoPrecos] = useState({});
  const [comprasPassadas, setComprasPassadas] = useState([]);
  const [totalCarrinho, setTotalCarrinho] = useState(0);
  const [economiaTotal, setEconomiaTotal] = useState(0);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());

  const [dadosGrafico, setDadosGrafico] = useState({
    labels: [],
    datasets: [{ data: [] }],
  });
  const compartilharListaWhatsApp = async () => {
    if (lista.length === 0) {
      Alert.alert("Lista Vazia", "Não há itens para compartilhar na sua lista atual.");
      return;
    }

    let mensagem = "🛒 Minha Lista de Compras:\n\n";
    const itensComprados = lista.filter(item => item.comprado);
    const itensNaoComprados = lista.filter(item => !item.comprado);

    if (itensComprados.length > 0) {
      mensagem += "✅ Já no Carrinho:\n";
      itensComprados.forEach(item => {
        mensagem += `- ${item.nome} (R$ ${Number(item.valor).toFixed(2).replace('.', ',')})\n`;
      });
      mensagem += "\n";
    }

    if (itensNaoComprados.length > 0) {
      mensagem += "📝 Para Comprar:\n";
      itensNaoComprados.forEach(item => {
        mensagem += `- ${item.nome}\n`;
      });
      mensagem += "\n";
    }
    mensagem += `Total no Carrinho: *R$ ${totalCarrinho.toFixed(2).replace('.', ',')}*\n`;
    mensagem += "Criado com meu App de Compras Inteligente!";

    // Codifica a mensagem para URL
    const encodedMessage = encodeURIComponent(mensagem);
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback para caso o WhatsApp não esteja instalado ou outra versão
        await Share.share({ message: mensagem });
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp ou compartilhar.");
      console.log("Erro ao compartilhar:", error);
    }
  };
  // NOVO useEffect para calcular os dados do gráfico quando o mês do filtro ou as compras mudam
  useEffect(() => {
    if (comprasPassadas.length > 0) {
      const gastosPorMes = {};
      const mesAtual = meses[mesFiltro]; // Nome do mês selecionado
      const anoAtual = new Date().getFullYear(); // Ou ajuste para o ano da compra

      comprasPassadas.forEach(compra => {
        if (compra.mes === mesFiltro && compra.ano === anoAtual) { // Filtra por mês e ano
          gastosPorMes[compra.data] = (gastosPorMes[compra.data] || 0) + compra.total;
        }
      });

      const datasOrdenadas = Object.keys(gastosPorMes).sort((a, b) => {
        // Formato DD/MM/AAAA para MM/DD/AAAA para comparar
        const [dA, mA, aA] = a.split('/');
        const [dB, mB, aB] = b.split('/');
        return new Date(`${mA}/${dA}/${aA}`).getTime() - new Date(`${mB}/${dB}/${aB}`).getTime();
      });

      const labels = datasOrdenadas.map(data => data.substring(0, 5)); // Ex: 01/01
      const data = datasOrdenadas.map(data => gastosPorMes[data]);

      setDadosGrafico({
        labels: labels.length > 0 ? labels : [mesAtual], // Garante que sempre tenha um label
        datasets: [{
          data: data.length > 0 ? data : [0], // Garante que sempre tenha dados, mesmo que 0
        }],
      });
    } else {
      setDadosGrafico({
        labels: [meses[mesFiltro]],
        datasets: [{ data: [0] }],
      });
    }
  }, [comprasPassadas, mesFiltro]); // Recalcula quando as compras ou o mês do filtro mudam

  useEffect(() => {
    carregarDados();
    solicitarPermissao();
    // Limpa os alertas pendentes ao abrir, já que o usuário já entrou no app
    notifee.cancelAllNotifications();
  }, []);

  useEffect(() => {
    let total = 0;
    let economia = 0;
    lista.forEach(item => {
      if (item.comprado) {
        const valor = parseFloat(item.valor) || 0;
        total += valor;
        if (item.precoReferencia && valor > 0 && valor < item.precoReferencia) {
          economia += (item.precoReferencia - valor);
        }
      }
    });
    setTotalCarrinho(total);
    setEconomiaTotal(economia);
  }, [lista]);

  useEffect(() => {
    if (itemInput.length > 1) {
      const nomesCadastrados = Object.keys(historicoPrecos);
      const filtrados = nomesCadastrados.filter(nome =>
        nome.includes(itemInput.toLowerCase()) &&
        !lista.some(li => li.nome.toLowerCase() === nome)
      );
      setSugestoes(filtrados);
    } else { setSugestoes([]); }
  }, [itemInput]);

  const solicitarPermissao = async () => {
    await notifee.requestPermission();
  };

  const carregarDados = async () => {
    try {
      const listaSalva = await AsyncStorage.getItem('@pacelo_lista_temp');
      if (listaSalva) setLista(JSON.parse(listaSalva));
      const histRef = await AsyncStorage.getItem('@pacelo_produtos_history');
      if (histRef) setHistoricoPrecos(JSON.parse(histRef));
      const todasCompras = await AsyncStorage.getItem('@pacelo_historico_compras');
      if (todasCompras) setComprasPassadas(JSON.parse(todasCompras));
    } catch (e) { console.log("Erro ao carregar", e); }
  };

  // --- O MOTOR DE INTELIGÊNCIA ---
  const descobrirAfinidade = () => {
    if (comprasPassadas.length === 0) return null;

    // Pega os itens da última compra
    const ultimaCompra = comprasPassadas[0].itens.map(i => i.nome.toLowerCase());
    if (ultimaCompra.length < 2) return null;

    // Escolhe um item aleatório da última compra para sugerir um "par"
    const itemSorteado = ultimaCompra[Math.floor(Math.random() * ultimaCompra.length)];

    // Procura no histórico quais itens costumam aparecer com ele
    let frequenciaPar = {};
    comprasPassadas.forEach(compra => {
      const nomes = compra.itens.map(i => i.nome.toLowerCase());
      if (nomes.includes(itemSorteado)) {
        nomes.forEach(n => {
          if (n !== itemSorteado) {
            frequenciaPar[n] = (frequenciaPar[n] || 0) + 1;
          }
        });
      }
    });

    // Pega o item que mais apareceu junto
    const parMaisFrequente = Object.keys(frequenciaPar).reduce((a, b) => frequenciaPar[a] > frequenciaPar[b] ? a : b, null);

    if (parMaisFrequente) {
      return { item: itemSorteado, sugestao: parMaisFrequente };
    }
    return null;
  };

  const agendarNotificacaoInteligente = async () => {
    try {
      // 1. Permissões
      await notifee.requestPermission();

      const afinidade = descobrirAfinidade();
      let titulo = "🛒 Hora do Mercado?";
      let corpo = "Que tal montar sua lista de compras?";

      if (afinidade) {
        titulo = `Não esqueça o ${afinidade.sugestao}!`;
        corpo = `Você costuma levar ${afinidade.sugestao} quando compra ${afinidade.item}.`;
      } else {
        const produtos = Object.keys(historicoPrecos);
        if (produtos.length > 0) {
          const p = produtos[Math.floor(Math.random() * produtos.length)];
          const preco = historicoPrecos[p].toFixed(2).replace('.', ',');
          titulo = `O preço do ${p} baixou?`;
          corpo = `Na última vez você pagou R$ ${preco}. Vamos conferir?`;
        }
      }

      const dataNotificacao = new Date();
      dataNotificacao.setDate(dataNotificacao.getDate() + 1); // Amanhã
      dataNotificacao.setHours(8, 0, 0, 0); 

      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: dataNotificacao.getTime(),
        alarmManager: true, 
      };

      // USANDO O SERVICE: Ele decide se toca som e se a notificação deve sair
      await NotificationService.schedule(
        {
          title: `<b>${titulo}</b>`,
          body: corpo,
          android: {
            // O channelId será definido automaticamente pelo Service
            smallIcon: 'ic_notification', 
            largeIcon: 'ic_launcher',
            pressAction: { id: 'default' },
            color: '#0f172a',
          },
        },
        trigger,
      );

      console.log("Mercado agendado via Service para:", dataNotificacao.toLocaleString());
    } catch (e) {
      console.log("Erro ao agendar mercado:", e);
    }
  };

  const salvarCompraFinalizada = async () => {
    const dataAtual = new Date();
    const itensComprados = lista.filter(i => i.comprado && Number(i.valor) > 0);

    const novaCompra = {
      id: dataAtual.getTime(),
      data: dataAtual.toLocaleDateString('pt-BR'),
      mes: dataAtual.getMonth(),
      ano: dataAtual.getFullYear(),
      itens: itensComprados,
      total: totalCarrinho
    };

    const novoHistorico = [novaCompra, ...comprasPassadas];
    await AsyncStorage.setItem('@pacelo_historico_compras', JSON.stringify(novoHistorico));
    setComprasPassadas(novoHistorico);

    let novaInteligencia = { ...historicoPrecos };
    itensComprados.forEach(item => {
      novaInteligencia[item.nome.toLowerCase()] = Number(item.valor);
    });
    await AsyncStorage.setItem('@pacelo_produtos_history', JSON.stringify(novaInteligencia));
    setHistoricoPrecos(novaInteligencia);

    await AsyncStorage.removeItem('@pacelo_lista_temp');
    setLista([]);

    // Agenda a notificação com base no que acabou de ser processado
    await agendarNotificacaoInteligente();

    Alert.alert("Sucesso!", "Compra salva. Lembrete agendado para amanhã às 08:00!");
  };

  // --- REUTILIZAÇÃO DAS FUNÇÕES DE RENDER (Mantendo seu design original) ---
  const adicionarItem = (nomeSugerido = null) => {
    const nome = (nomeSugerido || itemInput).trim();
    if (!nome) return;
    const precoRef = historicoPrecos[nome.toLowerCase()] || null;
    const novo = { id: Date.now().toString(), nome, valor: "0.00", comprado: false, precoReferencia: precoRef };
    const nl = [novo, ...lista];
    setLista(nl);
    AsyncStorage.setItem('@pacelo_lista_temp', JSON.stringify(nl));
    setItemInput('');
    setSugestoes([]);
    if (!nomeSugerido) Keyboard.dismiss();
  };

  const formatarEntradaPreco = (texto, id) => {
    let limpo = texto.replace(/\D/g, "");
    let numero = (Number(limpo) / 100).toFixed(2);
    const nl = lista.map(i => i.id === id ? { ...i, valor: numero } : i);
    setLista(nl);
    AsyncStorage.setItem('@pacelo_lista_temp', JSON.stringify(nl));
  };

  const finalizarCompra = () => {
    if (totalCarrinho === 0) return Alert.alert("Vazio", "Marque os itens e coloque o preço.");
    Alert.alert("Finalizar", "Salvar compra no histórico?", [
      { text: "Não" }, { text: "Sim", onPress: salvarCompraFinalizada }
    ]);
  };

  // FUNÇÃO DE TESTE (Dispara na hora ao segurar o título "Mercado")
const testarNotificacao = async () => {
    try {
      await notifee.requestPermission();
      const afinidade = descobrirAfinidade();
      
      let titulo = "🛒 Teste de Inteligência";
      let corpo = "Ainda não tenho dados, mas o sistema está ativo!";

      if (afinidade) {
        titulo = `<b>Já tem ${afinidade.sugestao}?</b>`;
        corpo = `Notei que você costuma levar com ${afinidade.item}.`;
      }

      // IMPORTANTE: Para o teste ser IMEDIATO mas respeitar o som, 
      // usamos um trigger de 1 segundo com o Service
      const triggerTeste = {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + 1000, 
      };

      await NotificationService.schedule({
        title: titulo,
        body: corpo,
        android: {
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
          pressAction: { id: 'default' },
          color: '#0f172a',
        },
      }, triggerTeste);

    } catch (e) {
      console.log("Erro no teste:", e);
    }
  };

  const renderItem = ({ item }) => {
    const valorAtual = Number(item.valor);
    const dif = item.precoReferencia ? valorAtual - item.precoReferencia : 0;
    return (
      <View style={[styles.card, item.comprado && styles.cardComprado]}>
        <TouchableOpacity style={[styles.check, item.comprado && styles.checkAtivo]}
          onPress={() => {
            const nl = lista.map(i => i.id === item.id ? { ...i, comprado: !i.comprado } : i);
            setLista(nl);
            AsyncStorage.setItem('@pacelo_lista_temp', JSON.stringify(nl));
          }}>
          {item.comprado && <Text style={{ color: '#fff', fontSize: 10 }}>✔</Text>}
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.nome, item.comprado && styles.nomeComprado]}>{item.nome}</Text>
          {item.precoReferencia > 0 && <Text style={styles.labelRef}>Ref: R$ {item.precoReferencia.toFixed(2).replace('.', ',')}</Text>}
        </View>
        <View style={styles.areaPreco}>
          <TextInput keyboardType="numeric" style={[styles.inputVal, valorAtual > 0 && dif > 0 ? { color: '#ef4444' } : valorAtual > 0 && dif < 0 ? { color: '#16a34a' } : { color: '#0f172a' }]}
            value={item.valor === "0.00" ? "" : item.valor.replace('.', ',')}
            placeholder="0,00" onChangeText={(t) => formatarEntradaPreco(t, item.id)} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onLongPress={testarNotificacao} delayLongPress={2000}>
            <Text style={styles.titulo}>Mercado</Text>
          </TouchableOpacity>
          <Text style={styles.sub}>Total: R$ {totalCarrinho.toFixed(2).replace('.', ',')}</Text>
          {economiaTotal > 0 && (
            <Text style={styles.txtEconomia}>Economia: R$ {economiaTotal.toFixed(2).replace('.', ',')}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            onPress={compartilharListaWhatsApp}
            style={[styles.btnAction, { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center' }]}
          >
            <IconeWhatsApp tamanho={18} cor="#fff" />
            {/* <Text style={[styles.btnActionText, { marginLeft: 5 }]}>Enviar</Text> */}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalHistorico(true)} style={[styles.btnAction, { backgroundColor: '#334155', marginLeft: 8 }]}>
            <Text style={styles.btnActionText}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!lista.length}
            onPress={finalizarCompra}
            style={[styles.btnAction, {
              backgroundColor: lista.length ? '#16a34a' : '#94a3b8', marginLeft: 8
            }]}>
            <Text style={styles.btnActionText}>Encerrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} placeholder="O que vamos comprar?" value={itemInput} onChangeText={setItemInput} placeholderTextColor="#64748b" />
          <TouchableOpacity style={styles.btnAdd} onPress={() => adicionarItem()}><Text style={styles.btnAddText}>+</Text></TouchableOpacity>
        </View>
        {sugestoes.length > 0 && (
          <View style={styles.sugestoesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {sugestoes.map((sug, idx) => (
                <TouchableOpacity key={idx} style={styles.sugestaoItem} onPress={() => adicionarItem(sug)}>
                  <Text style={styles.sugestaoTexto}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <SectionList
        sections={[{ title: 'Faltando', data: lista.filter(i => !i.comprado) }, { title: 'No Carrinho', data: lista.filter(i => i.comprado) }]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title, data } }) => (data.length > 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null)}
      />

      <Modal visible={modalHistorico} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

          <View style={styles.header}>
            <Text style={styles.titulo}>Minhas Compras</Text>
            <TouchableOpacity onPress={() => setModalHistorico(false)}><Text style={{ color: '#fff' }}>Fechar</Text></TouchableOpacity>
          </View>
          <View style={{ backgroundColor: '#fff', paddingVertical: 10 }}>
            <FlatList horizontal showsHorizontalScrollIndicator={false} data={meses} renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => setMesFiltro(index)} style={[styles.mesItem, mesFiltro === index && styles.mesAtivo]}>
                <Text style={[styles.mesTexto, mesFiltro === index && { color: '#fff' }]}>{item}</Text>
              </TouchableOpacity>
            )} />
          </View>
          {/* --- NOVO: GRÁFICO DE BARRAS --- */}
          {comprasPassadas.filter(c => c.mes === mesFiltro).length > 0 ? (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Gastos em {meses[mesFiltro]}</Text>
              <BarChart
                data={dadosGrafico}
                width={screenWidth - 30} // Largura da tela menos as margens
                height={220}
                yAxisLabel="R$"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0, // Sem casas decimais para o valor R$
                  color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`, // Cor do tema (azul escuro)
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Cores dos labels
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#0f172a'
                  }
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
              />
            </View>
          ) : (
            <Text style={styles.emptyChart}>Nenhum gasto registrado em {meses[mesFiltro]} para o gráfico.</Text>
          )}
          <FlatList
            data={comprasPassadas.filter(c => c.mes === mesFiltro)}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => (
              <View style={styles.cardCompraRealizada}>
                <View style={styles.topoCompra}>
                  <Text style={styles.dataCompra}>{item.data}</Text>
                  <Text style={styles.totalCompra}>Total: R$ {item.total.toFixed(2).replace('.', ',')}</Text>
                </View>
                {item.itens.map((prod, idx) => (
                  <View key={idx} style={styles.linhaProd}>
                    <Text style={styles.nomeProd}>{prod.nome}</Text>
                    <Text style={styles.precoProd}>R$ {Number(prod.valor).toFixed(2).replace('.', ',')}</Text>
                  </View>
                ))}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Nenhuma compra em {meses[mesFiltro]}.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0f172a', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#4ade80', fontSize: 18, fontWeight: '800' },
  txtEconomia: { color: '#fff', fontSize: 11, backgroundColor: '#166534', alignSelf: 'flex-start', paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },
  btnAction: { height: 40, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 10 },
  btnActionText: { color: '#fff', fontWeight: 'bold' },
  inputArea: { backgroundColor: '#fff', paddingBottom: 10, elevation: 4 },
  inputRow: { flexDirection: 'row', padding: 15 },
  input: { color: "#000", flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 16 },
  btnAdd: { backgroundColor: '#0f172a', width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginLeft: 10 },
  btnAddText: { color: '#fff', fontSize: 24 },
  sugestoesContainer: { paddingHorizontal: 15, paddingBottom: 10 },
  sugestaoItem: { backgroundColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  sugestaoTexto: { fontSize: 13, color: '#475569', fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94a3b8', marginLeft: 20, marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 15, padding: 15, borderRadius: 12, marginTop: 10, elevation: 1 },
  cardComprado: { opacity: 0.5, backgroundColor: '#f1f5f9' },
  check: { width: 26, height: 26, borderWidth: 2, borderColor: '#cbd5e1', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  checkAtivo: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  nome: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  labelRef: { fontSize: 10, color: '#94a3b8' },
  areaPreco: { width: 90 },
  inputVal: { fontSize: 17, fontWeight: 'bold', textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  mesItem: { paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 5, borderRadius: 20, backgroundColor: '#f1f5f9' },
  mesAtivo: { backgroundColor: '#0f172a' },
  mesTexto: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  cardCompraRealizada: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
  topoCompra: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 8 },
  dataCompra: { fontWeight: 'bold', color: '#64748b' },
  totalCompra: { fontWeight: 'bold', color: '#16a34a' },
  linhaProd: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  nomeProd: { fontSize: 13, color: '#334155' },
  precoProd: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 15,
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 10,
  },
  emptyChart: {
    textAlign: 'center',
    marginTop: 20,
    color: '#94a3b8',
    fontSize: 14,
    marginHorizontal: 15,
  },
});