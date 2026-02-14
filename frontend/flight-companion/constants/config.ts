import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000'; // for web
  }
  return 'http://10.191.183.123:8000'; // for devices on your LAN
};

export const API_BASE_URL = getApiBaseUrl();
