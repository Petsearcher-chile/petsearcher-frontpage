# kill.md

## Propósito

Este archivo define cómo debe comportarse el asistente cuando genere, modifique o revise código para proyectos en **Next.js**.  
El objetivo es producir código moderno, limpio, consistente, mantenible y alineado con las mejores prácticas actuales de Next.js.

La prioridad es entregar implementaciones correctas, claras y fáciles de mantener, evitando soluciones improvisadas o innecesariamente complejas.

---

## Objetivos principales

- Generar código compatible con Next.js moderno.
- Priorizar buenas prácticas, legibilidad y mantenibilidad.
- Escribir código modular y escalable.
- Aprovechar correctamente las capacidades de Next.js.
- Minimizar deuda técnica.
- Mantener consistencia con la arquitectura existente del proyecto.
- Evitar código innecesario, duplicado o difícil de extender.

---

## Principios base

### 1. Usa el enfoque moderno de Next.js
- Prioriza **App Router** cuando el proyecto lo soporte.
- Usa **Server Components** por defecto cuando sea apropiado.
- Usa **Client Components** solo cuando realmente se requiera interactividad del lado del navegador.
- Evita asumir patrones obsoletos si existe una alternativa moderna y mejor.
- Si el proyecto usa una estructura heredada, respeta esa base salvo que se solicite migración.

### 2. Respeta la arquitectura existente
- Antes de introducir nuevas convenciones, observa la estructura actual del proyecto.
- Sigue patrones ya usados en el repositorio.
- No mezcles estilos arquitectónicos sin necesidad.
- Mantén la coherencia con convenciones previas de nombres, carpetas, tipos, imports y organización.

### 3. Escribe código limpio
- Código pequeño, claro y con responsabilidades definidas.
- Funciones y componentes con un único propósito.
- Evita abstracciones prematuras.
- Evita duplicación cuando haya una forma simple de compartir lógica.

### 4. Prioriza mantenimiento
- El código debe ser fácil de leer y extender.
- Prefiere soluciones explícitas sobre “magia”.
- Documenta decisiones importantes cuando agreguen valor.
- Nombra variables, funciones y componentes de manera descriptiva.

### 5. Sé preciso con Next.js
- Diferencia correctamente entre ejecución en servidor y cliente.
- Usa `use client` solo cuando corresponda.
- Ten en cuenta el comportamiento de rendering, hydration, caching y data fetching.
- Evita patrones que rompan SSR o compliquen innecesariamente el build.

---

## Reglas generales de implementación

### 1. Estructura del proyecto
- Mantén una estructura ordenada.
- Separa UI, lógica, utilidades, servicios y tipos cuando sea útil.
- No concentres todo en archivos gigantes.
- Agrupa por dominio o funcionalidad cuando la app lo justifique.

### 2. Componentes
- Componentes pequeños y reutilizables cuando tengan sentido.
- Evita componentes monolíticos.
- Componentes con nombres claros.
- Props explícitas y bien tipadas.
- No sobre-ingenierizar con demasiados niveles de composición si el caso es simple.

### 3. Estado
- Usa el estado mínimo necesario.
- Mantén el estado cerca de donde se usa.
- Si un estado es derivable, no lo dupliques.
- Elige la solución de estado más simple que cubra el caso.
- No introduzcas librerías de estado global sin necesidad.

### 4. Datos y fetching
- Prefiere el fetching en servidor cuando encaje con Next.js moderno.
- Usa caché y revalidación de forma consciente.
- No repitas fetches innecesarios.
- Maneja correctamente loading, error y estados vacíos.
- Evita mezclar datos de servidor y cliente sin una razón clara.

### 5. Formularios
- Valida datos de entrada de forma clara y explícita.
- Maneja errores de usuario con mensajes comprensibles.
- Evita lógica de formulario dispersa.
- Si hace falta, usa una solución robusta y estándar.
- No sacrifiques claridad por reducir unas pocas líneas.

### 6. Tipado
- Usa TypeScript de forma estricta y útil.
- Tipa props, respuestas de API, helpers y estados relevantes.
- Evita `any` salvo que sea estrictamente inevitable.
- Prefiere tipos claros, reutilizables y bien nombrados.
- No abuses de tipos demasiado complejos si no aportan valor.

---

## Reglas específicas para Next.js

### App Router
- Prioriza archivos y patrones compatibles con `app/`.
- Usa `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx` cuando correspondan.
- Respeta el comportamiento de rutas anidadas y layouts compartidos.
- Usa segmentación lógica de rutas cuando mejore la arquitectura.
- No mezcles innecesariamente App Router con patrones antiguos.

### Server Components
- Úsalos por defecto si el componente no necesita interactividad del cliente.
- Mueve lógica de acceso a datos al servidor cuando sea posible.
- Aprovecha server-side rendering para mejorar rendimiento y simplicidad.
- Evita meter lógica de navegador en componentes del servidor.

### Client Components
- Marca con `use client` solo componentes que:
    - usan hooks del navegador;
    - manejan interacción local;
    - dependen de eventos del usuario;
    - necesitan APIs del navegador;
    - usan estado o efectos del cliente.
- Mantén los Client Components lo más pequeños posible.
- Separa la lógica interactiva del resto de la página si ayuda al rendimiento.

### Routing
- Usa el sistema de rutas de Next.js correctamente.
- Emplea rutas dinámicas solo cuando aporten valor.
- Usa enlaces con el componente adecuado de navegación.
- Evita navegación manual innecesaria.
- Mantén nombres de segmentos claros y semánticos.

### Data Fetching
- Prefiere obtener datos en servidor cuando sea posible.
- Si se requiere cliente, justifícalo por interactividad o sincronización en tiempo real.
- Maneja correctamente errores y loading states.
- No sobrecomplices el flujo de datos.

### Rendering y performance
- Minimiza el JS enviado al cliente.
- Evita hidratar más de lo necesario.
- Divide componentes interactivos cuando ayude.
- Evita renderizados innecesarios.
- Usa memoización solo cuando haya una razón real.

---

## Reglas de calidad del código

### Legibilidad
- Preferir nombres claros sobre nombres cortos ambiguos.
- Separar lógica compleja en funciones auxiliares.
- Evitar funciones demasiado largas.
- Mantener bloques de código fáciles de escanear.

### Reutilización
- Reutiliza cuando exista una necesidad real y consistente.
- No conviertas todo en abstracciones globales.
- Crea utilidades compartidas solo cuando haya una ganancia real.

### Escalabilidad
- El código debe soportar crecimiento sin volverse caótico.
- Pensar en futuros cambios sin sobrediseñar.
- Evitar dependencias fuertes entre capas.

### Consistencia
- Seguir un mismo estilo de imports, nombres y organización.
- No mezclar estilos dentro del mismo proyecto.
- Mantener coherencia visual y técnica en los cambios.

---

## Reglas para archivos y estructura

### Componentes
- Un componente por archivo cuando ayude a mantener claridad.
- Exportaciones consistentes.
- Nombre del archivo alineado con el nombre del componente cuando tenga sentido.

### Helpers y utilidades
- Poner utilidades puras en archivos separados.
- Evitar mezclar lógica de negocio con presentación.
- Nombrar helpers de forma expresiva.

### Tipos
- Centralizar tipos compartidos cuando sea útil.
- No crear archivos de tipos innecesarios si los tipos son locales y simples.
- Tipos relacionados deben tener nombres semánticos.

### Constantes
- Extraer constantes repetidas.
- Mantenerlas cerca del contexto si solo se usan en un dominio.
- No crear archivos de constantes gigantes sin necesidad.

---

## Manejo de errores

- Tratar los errores como parte normal del flujo.
- Mostrar mensajes útiles al usuario.
- Registrar errores de forma útil para depuración.
- No ocultar fallos silenciosamente.
- No asumir que todo siempre saldrá bien.
- Validar entradas y fallos de red, permisos y datos faltantes.

### Buenas prácticas
- Manejar `try/catch` donde realmente aporta valor.
- No capturar errores sin hacer nada.
- Diferenciar errores esperados de errores inesperados.
- Usar estados de error comprensibles.

---

## UI y experiencia de usuario

- Priorizar claridad sobre adornos.
- Hacer interfaces comprensibles y predecibles.
- Evitar duplicar contenido o controles.
- Mantener estados vacíos, de carga y de error bien resueltos.
- No crear UI compleja si una simple resuelve mejor el problema.
- Mantener consistencia visual entre componentes.

---

## Accesibilidad

- Usar HTML semántico siempre que sea posible.
- Etiquetar correctamente inputs, botones y controles.
- Respetar navegación por teclado.
- Asegurar contraste y estados visibles.
- Evitar depender solo del color para comunicar información.
- Si el componente es interactivo, debe ser accesible.

---

## Rendimiento

- Minimizar el trabajo del cliente.
- Reducir componentes client-side cuando no sean necesarios.
- Evitar cálculos pesados en render si se pueden mover.
- No usar optimizaciones innecesarias sin medición.
- Priorizar soluciones simples y eficientes.
- Evitar re-renderizados evitables mediante buena estructura.

---

## Seguridad

- Validar siempre datos externos.
- No confiar en input de usuario.
- No exponer secretos en código cliente.
- Evitar pasar datos sensibles donde no correspondan.
- Ser cuidadoso con HTML inyectado y contenido sin sanitizar.
- Respetar permisos y autenticación en servidor.

---

## Reglas para APIs y backend dentro de Next.js

- Mantener handlers y lógica de negocio separados cuando sea útil.
- Validar request bodies y query params.
- Responder con códigos de estado correctos.
- Definir claramente entradas y salidas.
- No mezclar lógica de UI con lógica de negocio.
- Documentar contratos cuando sean relevantes.

---

## Reglas para estilos

- Respetar la solución de estilos ya usada por el proyecto.
- No introducir otra estrategia de estilos sin necesidad.
- Mantener consistencia en clases, tokens y convenciones.
- Evitar estilos inline si existe una mejor alternativa.
- No mezclar múltiples aproximaciones sin razón.

---

## Reglas para librerías y dependencias

- No agregar dependencias si se puede resolver con herramientas ya presentes.
- Elegir librerías maduras y mantenidas si son necesarias.
- Evitar dependencias redundantes.
- Justificar claramente la necesidad de nuevas herramientas.
- Preferir soluciones estándar antes de introducir complejidad extra.

---

## Criterios para decidir entre varias soluciones

Cuando existan varias opciones, elegir según este orden:

1. Correctitud
2. Claridad
3. Mantenibilidad
4. Consistencia con el proyecto
5. Rendimiento
6. Elegancia

Si dos soluciones funcionan, preferir la más simple y clara.

---

## Qué debe evitarse siempre

- Código sobrediseñado.
- Abstracciones innecesarias.
- Componentes enormes.
- Mezclar lógica de servidor y cliente sin razón.
- `any` sin justificación.
- Dependencias nuevas sin necesidad.
- Repetición excesiva.
- Hacks temporales presentados como solución final.
- Violaciones de accesibilidad.
- Falta de manejo de errores.
- Inconsistencias con el proyecto existente.

---

## Checklist mental antes de escribir código

Antes de generar o modificar código, el asistente debe revisar:

- ¿Esto sigue la arquitectura del proyecto?
- ¿Es App Router o Pages Router?
- ¿Debe ser Server Component o Client Component?
- ¿Estoy usando el estado mínimo necesario?
- ¿Estoy tipando correctamente?
- ¿Estoy manejando loading, error y vacío?
- ¿Mi solución es simple?
- ¿Estoy evitando dependencias innecesarias?
- ¿Esto será fácil de mantener?
- ¿Respeta accesibilidad y rendimiento?

---

## Formato de respuesta ideal al entregar código

Cuando entregue una solución, preferir este orden:

1. Resumen corto de lo que se hizo.
2. Archivos modificados o creados.
3. Código completo o diffs relevantes.
4. Explicación breve de decisiones importantes.
5. Siguientes pasos o recomendaciones si aplican.

---

## Estilo de salida al escribir código

- Entregar código listo para copiar si se solicita.
- Mantener nombres consistentes.
- Incluir comentarios solo cuando aporten valor real.
- No comentar lo obvio.
- Si el cambio afecta varios archivos, mostrar claramente la relación entre ellos.
- Mantener el código alineado con lo que el usuario pidió, sin desviarse.

---

## Caraterísticas del proyecto

- El proyecto utiliza Next.js con App Router.
- El script de la bd está en /sql/model.sql y es postgresql
- Se recomienda usar Server Components para componentes que no requieren interacción del usuario.
- Se debe tipar correctamente todo el código.
- Se debe manejar correctamente los estados de loading, error y vacío.
- Se debe respeta la accesibilidad y el rendimiento.
- toda funcionalidad debe estar en /app/ y la carpeta que viene a continuación será indicada por el prompt
- Si la funcionalidad en /app/<carpera> es muy compleja, o necesita una funcionalidad que pueda ser utilizada por otros proyectos, se debe crear un paquete npm privado para esa funcionalidad, y agregarlo como dependencia desde /componentes
- está construido con next-intl, así que cada respuesta hacia el cliente o error debe ser descrito según esta definición, y ponerlos en los archivos de lenguajes para que language en src/messages/*.json
- de copiar una nueva key en el archivo de lenguajes src/messages/en.json, se debe agregar la nueva key en el archivo de lenguaje para todos los otros json dentro de esta carpeta src/messages/ y traducir su valor en el lenguaje indicado
### Referencias entre .tsx y .ts
- Este proyecto referencia las rutas con `@/` indicando como inicio de ruta.

### Características de las interfaces
- Toda interfaz creada debe estar en /app/ifaces
- En cada archivo debe ir solo una interface
- El archivo que contiene la interfaz debe tener el mismo nombre de la interfaz
- El nombre de la interfaz debe ser en "Camel Case"

### Características de las Apis
- Las llamadas a APIs deben ser manejadas en la carpeta /app/api
- Las llamadas a APIs deben ser escritas en carpetas independientes para mayor orden

---

## Regla final

Si hay conflicto entre hacer algo “más avanzado” y hacerlo “más correcto y mantenible”, siempre se debe elegir lo correcto, claro y sostenible.

La mejor solución en Next.js no es la más sofisticada, sino la que mejor equilibra simplicidad, calidad, rendimiento y mantenimiento.