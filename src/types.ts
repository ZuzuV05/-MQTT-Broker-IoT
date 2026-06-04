export interface MqttBrokerConfig {
  id: string;
  name: string;
  url: string;
  options?: any;
}

export interface SensorData {
  temperature: string | null;
  humidity: string | null;
}

export interface RelayState {
  relay1: boolean;
  relay2: boolean;
  relay3: boolean;
  relay4: boolean;
  pattern: string | null;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BrokerStatus {
  id: string;
  name: string;
  status: ConnectionStatus;
}
