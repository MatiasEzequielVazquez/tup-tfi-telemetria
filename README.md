# Sistema de Telemetría Vehicular para Camiones

Trabajo Final Integrador — Tecnicatura Universitaria en Programación a Distancia (UTN)

Sistema que captura datos de kilometraje, consumo de combustible y mantenimiento directamente desde el puerto OBD-II de camiones, los transmite vía MQTT/4G a la nube, y los expone en un dashboard web para administradores de flota.

## Integrantes

- **Patricio Sussini Guanziroli** — investigación de hardware, estructura de datos y base de datos
- **Matías Ezequiel Vazquez** — desarrollo backend

**Tutor:** Sebastián Bruselario

## Arquitectura

```
OBD-II (SAE J1979) → adaptador ELM327-compatible (STN1110/STN2100)
    → ESP32 (UART) → módulo 4G
    → HiveMQ Cloud (MQTT)
    → Backend en Oracle Cloud VM (ingestor MQTT + API REST)
    → Supabase
    → Dashboard web (React)
```

## Stack tecnológico

- **Frontend:** React
- **Backend:** Node.js (Express / NestJS)
- **Base de datos:** Supabase (PostgreSQL + JSONB, auth incluido)
- **Mensajería IoT:** MQTT (HiveMQ Cloud)
- **Despliegue:** Oracle Cloud Always Free (VM ARM, Docker)

## Estructura del repositorio

```
.
├── README.md
├── docs/
│   └── entregas/          # informes de cada instancia de entrega
├── backend/                # API REST + ingestor MQTT (Node.js)
├── frontend/                # Dashboard web (React)
├── firmware/                # Código del ESP32
└── db/                      # Esquemas y scripts de Supabase (PostgreSQL)
```

## Instalación y ejecución

_Pendiente_