import { StatusBar } from 'expo-status-bar';
import DashboardScreen from './src/app/(tabs)/index';

export default function App() {
  return (
    <>
      <DashboardScreen />
      <StatusBar style="auto" />
    </>
  );
}
