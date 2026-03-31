# Plan de Aplicación - Voicemod Senior Node.js Developer

**Fecha:** 2026-03-30
**Urgencia:** Oferta publicada hace 4 días - APLICAR EN 2-3 DÍAS
**Sistema:** Windows 11

---

## 📋 RESUMEN DE LA OFERTA

**Empresa:** Voicemod (Valencia, audio tech)
**Puesto:** Senior Node.js Developer
**Salario:** €68,000/año + €400/guardia semanal
**Modalidad:** 100% remoto (horario 9-16h o 10-17h CET)

### Stack Técnico Requerido:
- **Backend:** Node.js + Express
- **Bases de datos:** MongoDB + Redis
- **Infraestructura:** Docker + Kubernetes + Google Cloud
- **Herramientas:** GitLab CI/CD
- **Otros:** Colas asíncronas, microservicios, DDD

### Requisitos Obligatorios:
✅ Conocimientos sólidos Node.js/Express
✅ APIs REST
✅ SQL + NoSQL (MongoDB)
✅ Colas asíncronas
✅ Docker + Kubernetes + Git + CI/CD
✅ Testing, SOLID, TDD
✅ Monitorización/observabilidad
✅ Inglés funcional
✅ Autonomía + comunicación

### Nice-to-have:
- Experiencia en Startup
- Terraform
- MongoDB query tuning + Atlas Search
- DDD + Clean Architecture ✅ (LO TIENES)
- Programación con IA ✅ (LO TIENES)
- Pasión por audio/música/gaming

### Beneficios:
- 29 días vacaciones (23 + semana agosto + cumpleaños)
- Seguro Adeslas + baja 100% salario
- Coverflex (comidas, transporte, guardería)
- Remote stipend
- Formación + conferencias
- Clases idiomas gratis

### Proceso de Selección:
1. **Entrevista 1** - Marc + Jovi (60 min): trayectoria
2. **Entrevista 2** - Steve + Antonio (120 min): **CHALLENGE TÉCNICO EN VIVO**
3. **Entrevista 3** - Final (60 min): soft skills

---

## 👤 TU PERFIL

### Experiencia Profesional:
- **Unimicro.no (Noruega):** 9 años - Fullstack (PHP + Angular 14)
- **Parclick:** 3 años - Fullstack (PHP 8.3 + Symfony DBAL + Angular 21)
- **DreamStarChas:** ~10 años atrás - Fullstack (PHP + Node.js)
- **TOTAL:** ~12 años experiencia → **NIVEL SENIOR**

### Fortalezas Clave:

#### ✅ EXPERIENCIA TÉCNICA SÓLIDA:
- **Microservicios en producción** (Parclick)
- **Colas asíncronas:** RabbitMQ + Redis
- **Docker** (experiencia real)
- **Bases de datos:** SQL, MongoDB (personal), CouchDB, Supabase, Firebase
- **TDD real** usando SDD-TUI skills
- **Verticales completas:** Frontend → Backend → Infraestructura

#### ✅ ARQUITECTURA Y PRINCIPIOS:
- SOLID, KISS, YAGNI
- Clean Architecture
- Principios de diseño aplicados consistentemente

#### ✅ CASOS DE USO DESTACABLES:
- **Workers en Go sin experiencia previa** → producción con ayuda de IA
- **Sincronización Parclick-Hubspot** (integración compleja CRM)
- **Reportes con microservicios + colas asíncronas**
- **Stack moderno:** Angular 21, PHP 8.3 (te mantienes actualizado)

#### ✅ EXPERIENCIA INTERNACIONAL:
- 9 años en empresa noruega
- Adaptabilidad cultural

### Gaps a Cubrir:

#### ❌ GAPS CRÍTICOS:
- **Node.js moderno:** Solo experiencia hace 10 años (pre-ES6, pre-async/await)
- **Express reciente:** No has trabajado recientemente
- **Kubernetes:** No has trabajado con K8s (pero es nice-to-have)

#### ✅ MITIGACIÓN:
- Tienes base sólida en programación
- Aprendizaje rápido demostrado (Go en producción)
- Skills transferibles (APIs, arquitectura, microservicios)
- **ESTRATEGIA:** Demostrar con proyecto showcase que dominas Node.js moderno

---

## 🎯 ESTRATEGIA DE POSTULACIÓN

### Enfoque Principal:
**"Senior fullstack con 12 años de experiencia en arquitectura de microservicios, TDD y Clean Architecture. Experto en APIs REST, colas asíncronas y Docker. Actualizado con stack moderno (Angular 21, PHP 8.3). Aprendizaje rápido demostrado llevando Go a producción sin experiencia previa. Retomando Node.js moderno para este rol."**

### Mensajes Clave:
1. **Experiencia senior real** (12 años, verticales completas)
2. **Microservicios en producción** (no teoría)
3. **TDD + Clean Architecture** (lo que ellos valoran)
4. **Aprendizaje rápido** (Go → producción)
5. **Actualizado** (Angular 21, PHP 8.3)
6. **Lenguaje agnóstico** (principios > sintaxis)

---

## 🚀 PLAN DE ACCIÓN - COMPRIMIDO 2 DÍAS

### 📅 DÍA 1 (MAÑANA): Proyecto Showcase + Documentación

#### PROYECTO: "Audio Processing Microservices API"
**Objetivo:** Demostrar dominio de Node.js moderno con el stack exacto de Voicemod

**Stack técnico:**
- Node.js 20+ + Express + TypeScript
- MongoDB (metadata de audio tracks)
- Redis (cache + queues)
- RabbitMQ (procesamiento asíncrono)
- Docker + docker-compose
- Jest (TDD)
- GitHub Actions (CI/CD)

**Arquitectura:**
```
API Gateway (Express)
├── Audio Service (upload, metadata)
├── Processing Service (async workers)
└── Notification Service (real-time updates)
```

**Features principales:**
1. **Upload audio files** (simulado o con archivos pequeños)
2. **Metadata storage** en MongoDB
3. **Async processing** con RabbitMQ workers
4. **Cache** con Redis
5. **REST API** con documentación
6. **Real-time updates** (WebSocket/SSE opcional)
7. **Health checks** y monitorización básica

**Implementación con Clean Architecture:**
```
src/
├── domain/          # Entidades, value objects, reglas de negocio
├── application/     # Casos de uso, DTOs
├── infrastructure/  # MongoDB, Redis, RabbitMQ, Express
└── presentation/    # Controllers, middlewares, routes
```

**Testing:**
- Unit tests (domain + application)
- Integration tests (infrastructure)
- E2E tests (API)
- Coverage > 80%

**Docker:**
```yaml
services:
  api-gateway:
  audio-service:
  processing-worker:
  mongodb:
  redis:
  rabbitmq:
```

**CI/CD (GitHub Actions):**
- Run tests on PR
- Lint + format check
- Build Docker images
- Coverage report

**README profesional debe incluir:**
- Badges (build status, coverage, license)
- Tech stack con logos
- Architecture diagram (Mermaid)
- Quick start con docker-compose
- API documentation (ejemplos curl)
- Testing instructions
- **Destacar:** "Built with Clean Architecture, SOLID principles, TDD"
- **Destacar:** "Inspired by real-world microservices experience at Parclick"

---

#### MEJORAR README de sdd-tui
- Añadir badges
- Destacar que aplicas TDD usando esta tool
- Screenshots/GIFs si es posible
- Tech stack claramente visible
- Mencionar que es tu workflow diario

---

### 📅 DÍA 2 (PASADO MAÑANA): Carta + Aplicación

#### CARTA DE PRESENTACIÓN

**Estructura:**

**Párrafo 1 - Hook (¿Por qué Voicemod?):**
- Pasión por tecnología de audio en tiempo real
- Conexión entre tu experiencia (microservicios, baja latencia) y su producto
- Entusiasmo por su cultura (pragmatismo, "más PRs menos PowerPoint")

**Párrafo 2 - Tu valor (Experiencia relevante):**
- 12 años como senior fullstack
- Microservicios en producción en Parclick (verticales completas)
- Arquitectura con colas asíncronas (RabbitMQ + Redis)
- TDD, Clean Architecture, SOLID como base
- Docker, integración compleja de sistemas

**Párrafo 3 - Honestidad sobre Node.js:**
- Backend reciente en PHP/Symfony, pero Node.js en el pasado
- Lenguaje agnóstico: principios > sintaxis
- Demostración: llevaste Go a producción sin experiencia previa
- Proyecto showcase reciente en GitHub demuestra dominio Node.js moderno

**Párrafo 4 - Fit cultural:**
- Remote-first desde hace años (Unimicro Noruega)
- Equipo internacional
- Autonomía + comunicación (verticales completas)
- Stack moderno (Angular 21, te mantienes actualizado)

**Párrafo 5 - Cierre:**
- Disponibilidad para challenge técnico
- Ganas de aportar desde día 1
- Links a proyectos GitHub

---

#### PUNTOS CLAVE PARA LA CARTA:

**Destacar:**
✅ "Verticales completas: desde frontend (Angular 21) hasta microservicios con colas asíncronas"
✅ "Implementé workers en Go sin experiencia previa, llevándolos a producción con éxito"
✅ "TDD y Clean Architecture son mi base para cualquier lenguaje"
✅ "Mi proyecto reciente en GitHub demuestra dominio de Node.js + Express + MongoDB + Redis"
✅ "9 años en empresa noruega = experiencia remote + equipo internacional"

**Ser honesto:**
✅ "Mi backend reciente ha sido PHP/Symfony, pero domino los principios arquitectónicos"
✅ "Retomé Node.js moderno para este rol, como demuestran mis proyectos recientes"

**Evitar:**
❌ Excusas o defensas
❌ Decir "estoy aprendiendo" (suena junior)
❌ Listar tecnologías sin contexto

---

#### APLICAR EN GETMANFRED:
1. Actualizar perfil con:
   - Link a proyecto showcase
   - Link a sdd-tui mejorado
   - Destacar experiencia en microservicios
2. Adjuntar CV actualizado
3. Carta de presentación
4. **APLICAR**

---

## 💡 MENSAJES PARA LA ENTREVISTA

### Entrevista 1 (Marc + Jovi - Trayectoria):

**Tu narrativa:**
"Llevo 12 años como fullstack senior. En Parclick implementé verticales completas con microservicios, desde Angular hasta workers con colas asíncronas. Mi base es Clean Architecture y TDD aplicado en cualquier lenguaje. Cuando necesité Go para workers, lo aprendí y lo llevé a producción. Ahora estoy retomando Node.js moderno porque me apasiona lo que hacen en Voicemod con audio en tiempo real."

**Preguntas que te harán:**
- ¿Por qué Voicemod?
- ¿Por qué dejar Parclick?
- ¿Experiencia con Node.js?
- ¿Experiencia con microservicios?
- ¿Cómo te mantienes actualizado?

### Entrevista 2 (Challenge técnico - 120 min):

**Qué esperar:**
- Diseñar/implementar API REST en vivo
- Posiblemente con Express + MongoDB
- Testing
- Arquitectura de microservicios
- Colas asíncronas
- Debugging de código existente

**Tu preparación:**
- Repasar tu proyecto showcase (será tu referencia)
- Express routing, middlewares
- MongoDB queries (CRUD, aggregations)
- Redis (caching patterns)
- RabbitMQ/Bull (queue patterns)
- Error handling, logging
- Testing con Jest

**Ventajas:**
- Tienes experiencia real con microservicios
- Conoces patrones de colas asíncronas
- TDD es tu fuerte
- Clean Architecture te permite estructurar rápido

### Entrevista 3 (Soft skills):

**Qué valoran:**
- Autonomía
- Comunicación
- Trabajo en equipo multidisciplinar
- Pragmatismo
- Capacidad de simplificar sin perder robustez

**Tu narrativa:**
- Verticales completas = autonomía
- Equipo internacional (Noruega) = comunicación
- Parclick startup = pragmatismo
- TDD + Clean = simplificar con robustez

---

## 📝 CHECKLIST FINAL

### Antes de aplicar:
- [ ] Proyecto showcase completo y funcionando
- [ ] README profesional con badges y diagrams
- [ ] Tests pasando con buena cobertura
- [ ] Docker + docker-compose funcionando
- [ ] CI/CD configurado (GitHub Actions)
- [ ] sdd-tui README mejorado
- [ ] Perfil GetManfred actualizado
- [ ] CV actualizado
- [ ] Carta de presentación escrita
- [ ] Links verificados

### Después de aplicar:
- [ ] Preparar para challenge técnico (repasar Express, MongoDB, Redis)
- [ ] Preparar respuestas para preguntas comunes
- [ ] Revisar proyecto showcase (será tu referencia)

---

## 🎯 EXPECTATIVAS REALISTAS

**Probabilidad de pasar screening:**
- Alta (experiencia senior, arquitectura sólida)

**Probabilidad de pasar entrevista técnica:**
- Media-Alta (con proyecto showcase + experiencia real en microservicios)
- El challenge en vivo es el mayor riesgo (Node.js no es tu día a día)
- PERO: TDD + Clean Architecture + experiencia con Go te dan ventaja

**Probabilidad de oferta:**
- Media (competirás con seniors de Node.js puro)
- TU DIFERENCIADOR: arquitectura, microservicios, experiencia internacional

**Plan B si no sale:**
- Seguir mejorando skills Node.js
- Aplicar a roles fullstack con Node.js
- Otras empresas de Valencia tech (hay muchas)

---

## 📚 RECURSOS PARA MAÑANA

### Documentación a revisar:
- Express.js docs
- MongoDB Node.js driver
- Bull/BullMQ (colas con Redis)
- Jest testing

### Comandos útiles Windows 11:
```bash
# Node.js + npm
node --version
npm --version

# Docker Desktop
docker --version
docker-compose --version

# Git
git --version
```

### Template proyecto:
- Generaremos scaffold completo mañana
- Con toda la estructura y ejemplos
- Listo para ejecutar con docker-compose up

---

## ⏰ TIMELINE IDEAL

**Mañana (DÍA 1):**
- 09:00-10:00: Setup proyecto + estructura
- 10:00-13:00: Implementación core (Express + MongoDB + Redis)
- 13:00-14:00: Pausa
- 14:00-17:00: Workers + RabbitMQ + Tests
- 17:00-19:00: Docker + CI/CD
- 19:00-20:00: README + documentación
- 20:00-21:00: Mejorar sdd-tui README

**Pasado mañana (DÍA 2):**
- 09:00-11:00: Carta de presentación
- 11:00-12:00: Actualizar perfil GetManfred
- 12:00-12:30: **APLICAR**
- 12:30-14:00: Preparación entrevista técnica
- Tarde: Repasar Express, MongoDB, patrones

---

## 🔥 MOTIVACIÓN

**Por qué puedes conseguirlo:**
- Tienes 12 años de experiencia real
- Has llevado microservicios a producción
- Aprendiste Go sin experiencia → demuestras aprendizaje rápido
- TDD + Clean Architecture son raros (te destacan)
- Docker + colas asíncronas es lo que necesitan
- Voicemod busca actitud + ganas (lo tienes)

**El lenguaje es lo de menos. Lo importante es:**
- Arquitectura ✅
- Principios de diseño ✅
- Experiencia en producción ✅
- Capacidad de aprender ✅
- Actitud ✅

---

**¡Mañana arrancamos fuerte! 💪🚀**
