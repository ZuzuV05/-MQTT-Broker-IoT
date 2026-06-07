/*
 * ============================================================
 *  SISTEM KENDALI IoT MULTI-BROKER
 *  ESP32 + DHT11 + 4 Relay
 *
 *  Broker 1 : test.mosquitto.org    (port 1883, tanpa auth)
 *  Broker 2 : chameleon.lmq.cloudamqp.com (port 8883, TLS)
 *  Broker 3 : mqtt.flespi.io (port 8883, TLS + token)
 *
 *  Pin:
 *    DHT11  -> GPIO 4
 *    Relay1 -> GPIO 23
 *    Relay2 -> GPIO 19
 *    Relay3 -> GPIO 18
 *    Relay4 -> GPIO 5
 * ============================================================
 *
 *  Library yang dibutuhkan (install via Library Manager):
 *    - PubSubClient by Nick O'Leary
 *    - DHT sensor library by Adafruit
 *    - Adafruit Unified Sensor
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// ============================================================
//  KONFIGURASI WiFi
// ============================================================
const char* WIFI_SSID     = "Sumur Tua";
const char* WIFI_PASSWORD = "gula_gulamanis@";

// ============================================================
//  KONFIGURASI PIN
// ============================================================
#define DHTPIN  4
#define DHTTYPE DHT11

int relayPin[4] = {23, 19, 18, 5};  // Relay 1-4

// ============================================================
//  KONFIGURASI BROKER 1 - test.mosquitto.org (tanpa auth)
// ============================================================
const char* BROKER1_HOST = "test.mosquitto.org";
const int   BROKER1_PORT = 1883;

// ============================================================
//  KONFIGURASI BROKER 2 - CloudAMQP / LavinMQ (TLS)
// ============================================================
const char* BROKER2_HOST = "chameleon.lmq.cloudamqp.com";
const int   BROKER2_PORT = 8883;
const char* BROKER2_USER = "butieoos:butieoos";
const char* BROKER2_PASS = "0W6gl0e1QgDCIr-FSpqgkvLKhHeHr-cj";

// ============================================================
//  KONFIGURASI BROKER 3 - Flespi (TLS + token)
//  Username = token Flespi, Password = kosong
// ============================================================
const char* BROKER3_HOST = "mqtt.flespi.io";
const int   BROKER3_PORT = 8883;
const char* BROKER3_USER = "luXv03hboawBqlCMYVRUMap7Hxrg54fqgA355rvStF6ODtdarBk0D3c3YTf8zxSI";
const char* BROKER3_PASS = "";

// ============================================================
//  TOPIC MQTT
// ============================================================
// Publish (ESP32 -> Broker)
const char* TOPIC_SUHU       = "iot/lampu/suhu";
const char* TOPIC_KELEMBAPAN = "iot/lampu/kelembapan";
const char* TOPIC_STATUS     = "iot/lampu/status";

// Subscribe (Broker -> ESP32)
const char* TOPIC_RELAY1  = "iot/lampu/relay/1";
const char* TOPIC_RELAY2  = "iot/lampu/relay/2";
const char* TOPIC_RELAY3  = "iot/lampu/relay/3";
const char* TOPIC_RELAY4  = "iot/lampu/relay/4";
const char* TOPIC_POLA    = "iot/lampu/pola";   // "sequential" atau "strobo"

// ============================================================
//  INISIALISASI OBJEK
// ============================================================
DHT dht(DHTPIN, DHTTYPE);

// Broker 1 pakai WiFiClient biasa (tanpa TLS)
WiFiClient       wifiClient1;

// Broker 2 & 3 pakai WiFiClientSecure (TLS port 8883)
WiFiClientSecure wifiClient2;
WiFiClientSecure wifiClient3;

PubSubClient mqtt1(wifiClient1);  // Mosquitto
PubSubClient mqtt2(wifiClient2);  // CloudAMQP
PubSubClient mqtt3(wifiClient3);  // Flespi

// ============================================================
//  VARIABEL GLOBAL
// ============================================================
unsigned long lastSensorPublish = 0;
const long    SENSOR_INTERVAL   = 5000;  // Kirim data sensor tiap 5 detik

unsigned long lastPolaMillis = 0;
bool          polaAktif      = false;
String        polaMode       = "";
int           polaStep       = 0;
const long    POLA_INTERVAL  = 300;

// ============================================================
//  CALLBACK - Dipanggil saat ada pesan masuk dari broker
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String pesan = "";
  for (unsigned int i = 0; i < length; i++) {
    pesan += (char)payload[i];
  }
  pesan.toUpperCase();

  String topicStr = String(topic);

  Serial.print("[MQTT] Topic: ");
  Serial.print(topicStr);
  Serial.print(" | Pesan: ");
  Serial.println(pesan);

  // --- Kendali Relay individual ---
  if (topicStr == TOPIC_RELAY1) {
    digitalWrite(relayPin[0], pesan == "ON" ? LOW : HIGH);
    Serial.println("Relay 1 -> " + pesan);
  }
  else if (topicStr == TOPIC_RELAY2) {
    digitalWrite(relayPin[1], pesan == "ON" ? LOW : HIGH);
    Serial.println("Relay 2 -> " + pesan);
  }
  else if (topicStr == TOPIC_RELAY3) {
    digitalWrite(relayPin[2], pesan == "ON" ? LOW : HIGH);
    Serial.println("Relay 3 -> " + pesan);
  }
  else if (topicStr == TOPIC_RELAY4) {
    digitalWrite(relayPin[3], pesan == "ON" ? LOW : HIGH);
    Serial.println("Relay 4 -> " + pesan);
  }

  // --- Kendali semua relay sekaligus ---
  else if (topicStr == "iot/lampu/relay/all") {
    bool state = (pesan == "ON") ? LOW : HIGH;
    for (int i = 0; i < 4; i++) {
      digitalWrite(relayPin[i], state);
    }
    Serial.println("Semua relay -> " + pesan);
  }

  // --- Kendali Pola ---
  else if (topicStr == TOPIC_POLA) {
    if (pesan == "SEQUENTIAL") {
      polaAktif = true;
      polaMode  = "sequential";
      polaStep  = 0;
      Serial.println("[POLA] Mode: Sequential (kiri ke kanan)");
    }
    else if (pesan == "STROBO") {
      polaAktif = true;
      polaMode  = "strobo";
      polaStep  = 0;
      Serial.println("[POLA] Mode: Strobo");
    }
    else if (pesan == "STOP") {
      polaAktif = false;
      polaMode  = "";
      for (int i = 0; i < 4; i++) digitalWrite(relayPin[i], HIGH);
      Serial.println("[POLA] Dihentikan, semua relay OFF");
    }
  }
}

// ============================================================
//  FUNGSI SUBSCRIBE - Subscribe ke semua topic kendali
// ============================================================
void subscribeTopics(PubSubClient &client) {
  client.subscribe(TOPIC_RELAY1);
  client.subscribe(TOPIC_RELAY2);
  client.subscribe(TOPIC_RELAY3);
  client.subscribe(TOPIC_RELAY4);
  client.subscribe(TOPIC_POLA);
  client.subscribe("iot/lampu/relay/all");
}

// ============================================================
//  KONEKSI BROKER 1 - test.mosquitto.org
// ============================================================
void connectBroker1() {
  if (mqtt1.connected()) return;

  Serial.print("[Broker1] Menghubungkan ke test.mosquitto.org...");
  String clientId = "ESP32_Broker1_" + String(random(0xffff), HEX);

  if (mqtt1.connect(clientId.c_str())) {
    Serial.println(" TERHUBUNG");
    subscribeTopics(mqtt1);
    mqtt1.publish(TOPIC_STATUS, "ESP32 Broker1 Online");
  } else {
    Serial.print(" GAGAL, rc=");
    Serial.println(mqtt1.state());
  }
}

// ============================================================
//  KONEKSI BROKER 2 - CloudAMQP (TLS)
// ============================================================
void connectBroker2() {
  if (mqtt2.connected()) return;

  Serial.print("[Broker2] Menghubungkan ke CloudAMQP...");
  String clientId = "ESP32_Broker2_" + String(random(0xffff), HEX);

  if (mqtt2.connect(clientId.c_str(), BROKER2_USER, BROKER2_PASS)) {
    Serial.println(" TERHUBUNG");
    subscribeTopics(mqtt2);
    mqtt2.publish(TOPIC_STATUS, "ESP32 Broker2 Online");
  } else {
    Serial.print(" GAGAL, rc=");
    Serial.println(mqtt2.state());
  }
}

// ============================================================
//  KONEKSI BROKER 3 - Flespi (TLS + token)
// ============================================================
void connectBroker3() {
  if (mqtt3.connected()) return;

  Serial.print("[Broker3] Menghubungkan ke Flespi...");
  String clientId = "ESP32_Broker3_" + String(random(0xffff), HEX);

  if (mqtt3.connect(clientId.c_str(), BROKER3_USER, BROKER3_PASS)) {
    Serial.println(" TERHUBUNG");
    subscribeTopics(mqtt3);
    mqtt3.publish(TOPIC_STATUS, "ESP32 Broker3 Online");
  } else {
    Serial.print(" GAGAL, rc=");
    Serial.println(mqtt3.state());
  }
}

// ============================================================
//  PUBLISH KE 3 BROKER SEKALIGUS
// ============================================================
void publishAll(const char* topic, const char* payload) {
  if (mqtt1.connected()) mqtt1.publish(topic, payload);
  if (mqtt2.connected()) mqtt2.publish(topic, payload);
  if (mqtt3.connected()) mqtt3.publish(topic, payload);
}

// ============================================================
//  BACA DAN KIRIM DATA SENSOR DHT11
// ============================================================
void bacaDanKirimSensor() {
  float suhu       = dht.readTemperature();
  float kelembapan = dht.readHumidity();

  if (isnan(suhu) || isnan(kelembapan)) {
    Serial.println("[DHT11] Gagal membaca sensor!");
    return;
  }

  char bufSuhu[10], bufKelembapan[10];
  dtostrf(suhu,       4, 1, bufSuhu);
  dtostrf(kelembapan, 4, 1, bufKelembapan);

  Serial.print("[DHT11] Suhu: ");
  Serial.print(bufSuhu);
  Serial.print(" C | Kelembapan: ");
  Serial.print(bufKelembapan);
  Serial.println(" %");

  publishAll(TOPIC_SUHU,       bufSuhu);
  publishAll(TOPIC_KELEMBAPAN, bufKelembapan);
}

// ============================================================
//  POLA 1 - SEQUENTIAL (Kiri ke Kanan)
// ============================================================
void jalankanPolaSequential() {
  if (millis() - lastPolaMillis < POLA_INTERVAL) return;
  lastPolaMillis = millis();

  switch (polaStep % 8) {
    case 0: digitalWrite(relayPin[0], LOW);  break;  // R1 ON
    case 1: digitalWrite(relayPin[1], LOW);  break;  // R2 ON
    case 2: digitalWrite(relayPin[2], LOW);  break;  // R3 ON
    case 3: digitalWrite(relayPin[3], LOW);  break;  // R4 ON
    case 4: digitalWrite(relayPin[3], HIGH); break;  // R4 OFF
    case 5: digitalWrite(relayPin[2], HIGH); break;  // R3 OFF
    case 6: digitalWrite(relayPin[1], HIGH); break;  // R2 OFF
    case 7: digitalWrite(relayPin[0], HIGH); break;  // R1 OFF
  }
  polaStep++;
}

// ============================================================
//  POLA 2 - STROBO (Kedip Bergantian)
// ============================================================
void jalankanPolaStrobo() {
  if (millis() - lastPolaMillis < 150) return;
  lastPolaMillis = millis();

  if (polaStep % 2 == 0) {
    digitalWrite(relayPin[0], LOW);   // R1 ON
    digitalWrite(relayPin[2], LOW);   // R3 ON
    digitalWrite(relayPin[1], HIGH);  // R2 OFF
    digitalWrite(relayPin[3], HIGH);  // R4 OFF
  } else {
    digitalWrite(relayPin[1], LOW);   // R2 ON
    digitalWrite(relayPin[3], LOW);   // R4 ON
    digitalWrite(relayPin[0], HIGH);  // R1 OFF
    digitalWrite(relayPin[2], HIGH);  // R3 OFF
  }
  polaStep++;
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n====================================");
  Serial.println("  Sistem IoT Multi-Broker ESP32");
  Serial.println("====================================");

  for (int i = 0; i < 4; i++) {
    pinMode(relayPin[i], OUTPUT);
    digitalWrite(relayPin[i], HIGH);
  }
  Serial.println("[RELAY] 4 relay diinisialisasi -> OFF");

  dht.begin();
  Serial.println("[DHT11] Sensor diinisialisasi");

  Serial.print("[WiFi] Menghubungkan ke ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] TERHUBUNG!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  // Bypass verifikasi sertifikat TLS untuk Broker 2 & 3
  wifiClient2.setInsecure();
  wifiClient3.setInsecure();

  mqtt1.setServer(BROKER1_HOST, BROKER1_PORT);
  mqtt1.setCallback(mqttCallback);

  mqtt2.setServer(BROKER2_HOST, BROKER2_PORT);
  mqtt2.setCallback(mqttCallback);

  mqtt3.setServer(BROKER3_HOST, BROKER3_PORT);
  mqtt3.setCallback(mqttCallback);

  connectBroker1();
  delay(500);
  connectBroker2();
  delay(500);
  connectBroker3();

  Serial.println("\n[SYSTEM] Setup selesai, sistem berjalan...");
  Serial.println("====================================");
}

// ============================================================
//  LOOP UTAMA
// ============================================================
void loop() {
  if (!mqtt1.connected()) connectBroker1();
  if (!mqtt2.connected()) connectBroker2();
  if (!mqtt3.connected()) connectBroker3();

  mqtt1.loop();
  mqtt2.loop();
  mqtt3.loop();

  if (millis() - lastSensorPublish >= SENSOR_INTERVAL) {
    lastSensorPublish = millis();
    bacaDanKirimSensor();
  }

  if (polaAktif) {
    if (polaMode == "sequential") {
      jalankanPolaSequential();
    } else if (polaMode == "strobo") {
      jalankanPolaStrobo();
    }
  }
}
