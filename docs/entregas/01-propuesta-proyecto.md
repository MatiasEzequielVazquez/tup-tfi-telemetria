# Tecnicatura Universitaria en Programación a Distancia
### Trabajo Final Integrador
**1ª Entrega — Propuesta de Proyecto y Repositorio**

# Sistema de Telemetría Vehicular para Camiones

**Integrantes:** Patricio Sussini Guanziroli (investigación de hardware, estructura de datos y base de datos), Matías Ezequiel Vazquez (desarrollo backend)

**Tutor:** Sebastián Bruselario

**Repositorio GitHub:** https://github.com/MatiasEzequielVazquez/tup-tfi-telemetria

---

## 1. Identificación de la problemática

### 1.1 Contexto

Las empresas de transporte de carga y flotas de camiones de mediana escala suelen carecer de visibilidad centralizada y en tiempo real sobre el estado operativo de sus vehículos. El seguimiento de kilometraje, consumo de combustible y necesidades de mantenimiento se realiza hoy mediante planillas, registros manuales de los choferes o revisiones periódicas presenciales, sin un canal automático que capture estos datos directamente desde el vehículo.

### 1.2 Actores afectados

- **Administradores/dueños de flota:** necesitan indicadores actualizados de consumo, kilometraje y estado de mantenimiento para tomar decisiones de costos y planificación.
- **Personal de mantenimiento:** depende de reportes manuales o del criterio del chofer para anticipar servicios, con riesgo de detectar tarde una falla o vencimiento.
- **Choferes:** hoy son responsables de registrar manualmente datos que podrían capturarse de forma automática desde el propio vehículo.

### 1.3 Impacto

La falta de datos automatizados y centralizados genera decisiones de mantenimiento tardías (con el consiguiente riesgo de rotura o parada de unidad), dificultad para auditar el consumo real de combustible por camión o por recorrido, y ausencia de un histórico confiable para analizar la eficiencia operativa de la flota a lo largo del tiempo.

### 1.4 ¿Por qué admite una solución tecnológica?

Los datos relevantes (kilometraje, consumo, códigos de diagnóstico) ya son generados internamente por la computadora del vehículo y son accesibles de forma estandarizada a través del puerto OBD-II (protocolo SAE J1979). El problema no es la ausencia de datos, sino la falta de un mecanismo automático que los capture, transmita y centralice, la cual es exactamente el tipo de ineficiencia tolerada que una solución de software e IoT puede resolver, transformando un proceso manual y disperso en información visible y procesable en tiempo real.

## 2. Propuesta de valor

Se propone un sistema de telemetría compuesto por un módulo de hardware que se conecta al puerto OBD-II del camión y lee parámetros estándar (SAE J1979) a través de un adaptador compatible con el protocolo ELM327. Estos datos se transmiten mediante un microcontrolador ESP32 y un módulo 4G hacia un broker MQTT en la nube, donde un backend los procesa y persiste. Un dashboard web permite a los administradores de flota visualizar el estado actual de cada unidad y consultar reportes históricos de consumo, kilometraje y mantenimiento.

El valor agregado no está en "agregar una app", sino en transformar datos que hoy existen pero no se capturan ni se centralizan, en información procesada capaz de generar alertas, reportes y patrones que hoy son imposibles de obtener manualmente.

## 3. Plan de trabajo

### 3.1 Objetivo general

Desarrollar un sistema de telemetría vehicular que capture, transmita y centralice datos de ubicación, consumo de combustible, kilometraje y mantenimiento de camiones, exponiéndolos a través de un dashboard web accesible para administradores de flota.

### 3.2 Alcance de la primera versión (MVP)

- Captura de datos OBD-II estándar (kilometraje, consumo de combustible) vía adaptador ELM327-compatible.
- Transmisión desde el ESP32 hacia un broker MQTT mediante conectividad 4G.
- Backend con API REST y proceso de ingesta MQTT que persiste el estado actual y el histórico de cada unidad.
- Dashboard web con visualización del estado actual de la flota y reportes históricos básicos.

Quedan fuera del alcance de esta primera versión: geolocalización en tiempo real avanzada, alertas automáticas configurables y integración con sistemas de terceros (ERP, facturación), que se evaluarán como posibles extensiones.

### 3.3 Stack tecnológico

| Capa | Tecnología elegida | Framework / Herramienta | Justificación breve |
|---|---|---|---|
| Frontend | JavaScript (React) | React + librería de gráficos (Recharts / Chart.js / EchartsForReact) | Lenguaje nativo del navegador; ambos integrantes lo conocen; ecosistema maduro para dashboards con visualización de datos. |
| Backend | JavaScript (Node.js) | Express / NestJS | Unifica el lenguaje en todo el software del proyecto; su modelo de I/O no bloqueante es adecuado para mantener activo el listener MQTT junto con la API REST; es la tecnología que el equipo ya domina. |
| Base de datos | Supabase (PostgreSQL) | Supabase SDK / Postgres + JSONB | Un único motor cubre tanto datos relacionales con estructura estable (unidades, viajes, mantenimiento) como datos semi-estructurados (JSONB, para payloads variables de sensores), e incluye autenticación y gestión de usuarios integrada. |
| Mensajería IoT | MQTT | HiveMQ Cloud (free tier) | Broker intermedio entre el ESP32 y el backend; desacopla la ingesta de hardware del procesamiento en la nube. |
| Plataforma de despliegue | VM Linux (contenedor Docker) | Oracle Cloud Always Free (ARM) | Necesitamos un proceso siempre activo (ingestor MQTT + API); las alternativas PaaS gratuitas evaluadas (Render, Railway) duermen o pausan por inactividad, incompatible con un listener persistente. |

### 3.4 Justificación general del stack

La elección de tecnologías sigue el principio de trabajar con lo que el equipo ya domina siempre que sea viable: React para el frontend porque ambos integrantes tienen experiencia previa y es la opción natural para aplicaciones web.

Node.js (con Express o NestJS) para el backend porque unifica el lenguaje en todo el software del proyecto, su modelo de I/O no bloqueante es adecuado para mantener activo el listener MQTT junto con la API REST, y es la tecnología que el equipo ya conoce.

Para la base de datos se optó por consolidar todo en Supabase (PostgreSQL), que cubre en un único motor tanto los datos con estructura estable y relaciones claras (unidades, viajes, eventos de mantenimiento) como los datos semi-estructurados o variables (payloads de sensores, mediante columnas JSONB), y provee autenticación y gestión de usuarios integrada.

La plataforma de despliegue (Oracle Cloud Always Free) fue seleccionada tras descartar alternativas PaaS gratuitas que interrumpen procesos por inactividad (Render, Railway), incompatibles con un proceso de ingesta MQTT que debe permanecer siempre activo.

## 4. Repositorio

Todo el proyecto (backend, documentación y, a medida que se incorpore, firmware y frontend) se aloja en un único repositorio de GitHub:

https://github.com/MatiasEzequielVazquez/tup-tfi-telemetria