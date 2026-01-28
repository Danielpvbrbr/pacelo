import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

export const NotificationService = {
  async schedule(config, trigger) {
    try {
      // 1. Pega as preferências do usuário
      const perfilJson = await AsyncStorage.getItem('@pacelo_perfil');
      const perfil = perfilJson ? JSON.parse(perfilJson) : { notificacoes: true, sons: true };

      // INTERRUPTOR GERAL: Se notificações estiverem off, cancela aqui
      if (perfil.notificacoes === false) return null;

      // 2. Define qual canal usar baseado no interruptor de SOM
      const channelId = perfil.sons ? 'canal-com-som' : 'canal-silencioso';
      const channelName = perfil.sons ? 'Alertas com Som' : 'Alertas Silenciosos';

      // 3. Cria/Garante que os canais existam
      await notifee.createChannel({
        id: channelId,
        name: channelName,
        importance: AndroidImportance.HIGH,
        sound: perfil.sons ? 'default' : undefined, // Aqui acontece a mágica
      });

      // 4. Aplica o canal correto na configuração da notificação
      const finalConfig = {
        ...config,
        android: {
          ...config.android,
          channelId: channelId,
        }
      };

      return await notifee.createTriggerNotification(finalConfig, trigger);
    } catch (e) {
      console.log("Erro no NotificationService:", e);
    }
  },

  // Função para limpar tudo se o usuário desativar a chave geral
  async cancelarTodas() {
    await notifee.cancelAllNotifications();
  }
};