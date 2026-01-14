import React from 'react';
import { NavigationContainer } from '@react-navigation/native'; // <--- IMPORTANTE: Faltava isso
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StatusBar } from 'react-native';

import Home from './view/Home';
import Cadastro from './view/Cadastro';
import Ganhos from './view/Ganhos';
import Configuracao from './view/Configuracao';
import Historico from './view/Historico';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabsHome() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused }) => {
        let iconName;
        if (route.name === 'Dívidas') iconName = '💸';
        if (route.name === 'Ganhos') iconName = '💰';
        if (route.name === 'Histórico') iconName = '🏆';
        if (route.name === 'Perfil') iconName = '👤';

        return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{iconName}</Text>;
      },
      tabBarActiveTintColor: '#0f172a',
      tabBarInactiveTintColor: 'gray',
      tabBarStyle: { height: 60, paddingBottom: 10, paddingTop: 10 }
    })}
    >
      <Tab.Screen name="Dívidas" component={Home} />
      <Tab.Screen name="Ganhos" component={Ganhos} />
      <Tab.Screen name="Histórico" component={Historico} />
      <Tab.Screen name="Perfil" component={Configuracao} />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />

      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Principal" component={TabsHome} />
        <Stack.Screen name="Cadastro" component={Cadastro} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;