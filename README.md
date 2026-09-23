# Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas

Trabajo Final Integrador — Tecnicatura Universitaria en Programación a Distancia (UTN)

Las pymes de transporte con flotas mixtas (camiones de distintas marcas, propios y de terceros) suelen controlar el mantenimiento preventivo con registros manuales, porque la telemetría de fábrica solo cubre a las unidades recientes de cada marca. Este proyecto propone un dispositivo independiente de la marca que lee kilometraje, horas de motor y códigos de falla desde el conector de diagnóstico del vehículo (SAE J1939 / J1979), los transmite por MQTT a la nube y calcula automáticamente el estado de mantenimiento de cada unidad en un dashboard web.

## Integrantes

- **Patricio Sussini Guanziroli** — hardware y firmware, frontend
- **Matias Ezequiel Vazquez** — backend, bases de datos e infraestructura

**Tutor:** Sebastián Bruselario

## Documentación

| Documento | Contenido |
|---|---|
| [1ª Entrega — Propuesta de proyecto](docs/entregas/01-propuesta-proyecto.md) | Problemática y evidencia (caso de estudio), propuesta de valor, actores, alcance, requerimientos funcionales y no funcionales, reglas de negocio, casos de uso, plan de trabajo y ficha de la entrevista. |
| [Diagramas](docs/diagramas/) | Diagramas en PNG, con sus archivos editables en draw.io. |

## Arquitectura

![Contexto y arquitectura del sistema](docs/diagramas/02-arquitectura.png)

```
Computadora del vehículo (SAE J1939 / J1979)
    → SparkFun OBD-II UART (STN1110)
    → ESP32 (UART) + módulo 4G
    → HiveMQ Cloud (MQTT sobre TLS)
    → Backend en Oracle Cloud VM (ingesta MQTT + motor de mantenimiento + API REST)
    → Supabase (PostgreSQL + Auth)
    → Dashboard web (React)
```

## Stack tecnológico

- **Hardware:** ESP32, SparkFun OBD-II UART (STN1110), módulo 4G
- **Frontend:** React
- **Backend:** Node.js (Express / NestJS)
- **Base de datos:** Supabase (PostgreSQL + JSONB, autenticación incluida)
- **Mensajería IoT:** MQTT (HiveMQ Cloud)
- **Despliegue:** Oracle Cloud Always Free (VM ARM, Docker)

## Estructura del repositorio

```
.
├── README.md
├── docs/
│   ├── entregas/            # Informes de cada instancia de entrega
│   └── diagramas/           # Diagramas en PNG
│       └── drawio/          # Fuentes editables (.drawio)
├── backend/                 # API REST + ingestor MQTT (Node.js)
├── frontend/                # Dashboard web (React)
├── firmware/                # Código del ESP32
└── db/                      # Esquemas y scripts de Supabase (PostgreSQL)
```

## Estado del proyecto

Etapa de análisis y diseño (1ª entrega). El desarrollo del backend, el frontend y el firmware comienza una vez aprobada la documentación.

## Instalación y ejecución

_Pendiente_