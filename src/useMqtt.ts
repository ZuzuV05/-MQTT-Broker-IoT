import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { BrokerStatus, MqttBrokerConfig, SensorData } from './types';

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

const BROKERS: MqttBrokerConfig[] = [
  {
    id: 'mosquitto',
    name: 'test.mosquitto.org',
    url: isHttps ? 'wss://test.mosquitto.org:8081/mqtt' : 'ws://test.mosquitto.org:8080/mqtt',
  },
  {
    id: 'cloudamqp',
    name: 'chameleon.lmq.cloudamqp.com',
    url: 'wss://chameleon.lmq.cloudamqp.com/ws', // CloudAMQP / RabbitMQ default WS path
    options: {
      username: 'butieoos:butieoos',
      password: '0W6gl0e1QgDCIr-FSpqgkvLKhHeHr-cj',
      clientId: `client_${Math.random().toString(16).slice(3)}`,
      reconnectPeriod: 5000,
    },
  },
  {
    id: 'flespi',
    name: 'mqtt.flespi.io',
    url: 'wss://mqtt.flespi.io:443',
    options: {
      username: 'luXv03hboawBqlCMYVRUMap7Hxrg54fqgA355rvStF6ODtdarBk0D3c3YTf8zxSI',
      password: '',
      clientId: `client_${Math.random().toString(16).slice(3)}`,
      reconnectPeriod: 5000,
    },
  },
];

export function useMqtt() {
  const [brokerStatuses, setBrokerStatuses] = useState<BrokerStatus[]>(
    BROKERS.map((b) => ({ id: b.id, name: b.name, status: 'disconnected' }))
  );
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: null,
    humidity: null,
  });

  const clientsRef = useRef<Map<string, MqttClient>>(new Map());

  useEffect(() => {
    BROKERS.forEach((broker) => {
      setBrokerStatuses((prev) =>
        prev.map((s) => (s.id === broker.id ? { ...s, status: 'connecting' } : s))
      );

      try {
        const client = mqtt.connect(broker.url, broker.options);
        clientsRef.current.set(broker.id, client);

        client.on('connect', () => {
          setBrokerStatuses((prev) =>
            prev.map((s) => (s.id === broker.id ? { ...s, status: 'connected' } : s))
          );
          client.subscribe('iot/lampu/suhu');
          client.subscribe('iot/lampu/kelembapan');
        });

        client.on('error', (err) => {
          setBrokerStatuses((prev) =>
            prev.map((s) => (s.id === broker.id ? { ...s, status: 'error' } : s))
          );
          console.warn(`MQTT Error [${broker.id}]:`, err.message || err);
        });

        client.on('close', () => {
          setBrokerStatuses((prev) =>
            prev.map((s) => (s.id === broker.id ? { ...s, status: 'disconnected' } : s))
          );
        });

        client.on('message', (topic, message) => {
          const payload = message.toString();
          if (topic === 'iot/lampu/suhu') {
            setSensorData((prev) => ({ ...prev, temperature: payload }));
          } else if (topic === 'iot/lampu/kelembapan') {
            setSensorData((prev) => ({ ...prev, humidity: payload }));
          }
        });
      } catch (err) {
        console.error(`Failed to connect MQTT [${broker.id}]:`, err);
        setBrokerStatuses((prev) =>
          prev.map((s) => (s.id === broker.id ? { ...s, status: 'error' } : s))
        );
      }
    });

    return () => {
      clientsRef.current.forEach((client) => {
        client.end();
      });
      clientsRef.current.clear();
    };
  }, []);

  const publishMessage = useCallback((topic: string, message: string) => {
    clientsRef.current.forEach((client, id) => {
      if (client.connected) {
        client.publish(topic, message);
      }
    });
  }, []);

  return {
    brokerStatuses,
    sensorData,
    publishMessage,
  };
}
