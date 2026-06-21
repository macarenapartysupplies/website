# Legacy Eph Repos Inventory

Inventario rapido de repositorios viejos de Eph Technologies revisados antes de limpieza.

## Contexto

Estos repos parecen venir de experimentos y practicas alrededor de WinForms .NET Framework 4.8, automatizaciones locales, WhatsApp chatbot, updates y un To Do List usado como prueba de GitHub Pages.

La recomendacion general es no migrar este codigo tal cual a proyectos nuevos. Si algo se rescata, conviene rescatar ideas, no implementaciones completas.

## Repos posiblemente eliminables

### Eph.TDL.Parser

Repositorio publico.

Contenido observado:
- `index.html`
- `app.js`
- `styles.css`
- iconos PWA
- `online-tasks.csv`

Uso historico:
Prueba de GitHub Pages para agregar pendientes y leerlos desde una app WPF.

Valor salvable:
- Idea de usar un archivo estatico o endpoint simple como fuente ligera de datos.
- Separacion minima HTML/CSS/JS para prototipos rapidos.

Recomendacion:
Se puede eliminar si ya no forma parte de ningun flujo actual.

### Eph.Chatbot

Repositorio privado.

Contenido observado:
- App principal WinForms/C#.
- `Database.eqy`.
- `Eph.Chatbot.exe`.
- multiples archivos `.cs` de UI, build, data load, objetos, variables y pagina de bienvenida.

Valor salvable:
- Separacion por capas dentro de WinForms: UI, carga de datos, objetos, variables.
- Concepto de automatizacion local para flujos conversacionales.

Riesgo:
Puede contener patrones antiguos, binarios y posibles datos de prueba mezclados.

Recomendacion:
Eliminar si no hay clientes activos ni dependencias actuales.

### Eph.Chatbot.Agenda / Settings / Reports / Residents / Installer

Repos privados.

Contenido observado:
- Complementos C# del chatbot.
- DLLs, XML docs, manifiestos y `params.rsp`.
- Layouts de agenda, settings, reportes, residentes e instalador.

Valor salvable:
- Idea de arquitectura modular por complementos.
- Separar agenda, reportes, configuracion y residentes como dominios propios.
- Instalador separado como herramienta independiente.

Recomendacion:
Eliminar si el ecosistema del chatbot queda descartado.

### Eph.Chatbot.Directories

Repositorio privado.

Contenido observado:
- Carpeta `bot/`.
- Varios archivos `.adc`.

Valor salvable:
- Idea de directorios/datos externos para alimentar automatizaciones.

Riesgo:
Podria contener datos/config sensible o historica.

Recomendacion:
Revisar sensibilidad antes de borrar. Si no hay datos necesarios, eliminar.

### private_EphChatbotUpdates

Repositorio privado.

Contenido observado:
- `README.md`
- `metadata.egh`

Valor salvable:
- Concepto de repositorio de updates/metadata para apps locales.

Recomendacion:
Eliminar si ya no existe canal de updates activo.

### global_EphChatbot

Repositorio privado.

Contenido observado:
- `README.md`
- `etp43974.egh`

Descripcion:
Query point for private app data.

Riesgo:
Podria contener referencias a datos privados o llaves/metadata.

Recomendacion:
No borrar sin confirmar que no tiene datos utiles. Si era solo prueba, eliminar.

### private_EphChatbotAccounts

Repositorio privado.

Contenido observado:
- `README.md`

Descripcion:
Encrypted account data from customers.

Riesgo:
Alto. Aunque este vacio o casi vacio, el nombre sugiere datos de clientes.

Recomendacion:
Si ya no se usa, eliminar del remoto. Antes de borrar, confirmar que no necesitas conservar evidencia/backups por temas administrativos.

### private_EphChatbotDataRestore

Repositorio privado.

Contenido observado:
- `README.md`

Descripcion:
Client Data Backups for possible data restoration.

Riesgo:
Alto. Nombre sugiere backups de clientes.

Recomendacion:
Eliminar si no hay obligacion de conservar datos. Si habia datos reales, mejor descargar backup privado controlado antes de borrar.

## Repos de librerias/herramientas Eph

Estos parecen modulos de soporte C#:

- `Eph.Process`
- `Eph.Core`
- `Eph.Access`
- `Eph.Controls`
- `Eph.Resources`
- `Eph.Github`
- `Eph.Updater`
- `Eph.ServerManager`
- `Eph.DevelopmentTerminal`

Valor salvable general:
- Componentizacion de herramientas internas.
- Utilidades de terminal, archivos, permisos, conversion, compresion y UI.
- Controles WinForms personalizados.
- Recursos centralizados: colores, errores, iconos, snippets.
- Automatizacion de GitHub desde una app local.
- Updater/installer como concepto para aplicaciones de escritorio.

Riesgo:
Codigo .NET Framework viejo, binarios versionados y posible deuda tecnica alta.

Recomendacion:
Si no hay planes de revivir Eph Chatbot, tambien pueden eliminarse. Para proyectos nuevos en Codex conviene reimplementar ideas desde cero en .NET moderno, web o tooling actual.

## Ideas rescatables para proyectos futuros

1. Panel local tipo WPF/WinForms para administrar JSON de sitios estaticos.
2. Generador de catalogos para GitHub Pages.
3. Sistema simple de updates basado en metadata versionada.
4. Libreria de recursos visuales compartidos.
5. Automatizaciones de GitHub encapsuladas, pero ahora usando GitHub CLI/API directamente.
6. Separacion de dominios: agenda, reportes, settings, residentes, catalogos.

## Decision recomendada

Conservar:
- `macarena-party-supplies-website`

Eliminar si confirmas que ya no hay datos utiles:
- `Eph.TDL.Parser`
- `Eph.Chatbot`
- `Eph.Chatbot.Agenda`
- `Eph.Chatbot.Settings`
- `Eph.Chatbot.Reports`
- `Eph.Chatbot.Residents`
- `Eph.Chatbot.Installer`
- `Eph.Chatbot.Directories`
- `private_EphChatbotUpdates`
- `global_EphChatbot`
- `private_EphChatbotAccounts`
- `private_EphChatbotDataRestore`

Eliminar tambien si decides cerrar toda la etapa Eph:
- `Eph.Process`
- `Eph.Core`
- `Eph.Access`
- `Eph.Controls`
- `Eph.Resources`
- `Eph.Github`
- `Eph.Updater`
- `Eph.ServerManager`
- `Eph.DevelopmentTerminal`
