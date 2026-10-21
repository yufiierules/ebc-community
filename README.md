# EBC · Ecija Beyblade Community

Aplicación en español para organizar ligas y torneos Beyblade. React, TypeScript y rutas HTTP compatibles con Next.js. Publicación actual con Sites/Vinext; datos y cuentas con Supabase.

## Funciones

- Registro y acceso de organizadores por usuario y contraseña, sesiones con cookies HttpOnly/Secure.
- Registro reutilizable de jugadores, ligas de una o dos vueltas y torneos de eliminación directa de 2–64 participantes.
- Brackets con semillas, pases automáticos, avance y eliminación de resultados dependientes al corregir una ronda.
- Arbitraje por jugadas, avisos, penalizaciones, deshacer, revisión y eliminación de resultados.
- Puntos de clasificación por finish, victoria, derrota y participación; recálculo retroactivo.
- Clasificación, finalizar/reabrir, archivar, reiniciar y eliminar competiciones.
- Copias JSON exportables y restauración de copias EBC v1. Demo aislada sin persistencia.

Cada organizador tiene datos separados por RLS. No se comparte una cuenta de administrador predeterminada. La recuperación automática de contraseñas y las invitaciones entre organizadores aún no están implementadas.

## Desarrollo

El proyecto se instala con pnpm y su lockfile. `pnpm dev` inicia Vinext; `pnpm build` compila la publicación Sites. `pnpm exec tsc --noEmit` comprueba tipos.

Pruebas de lógica: `node --experimental-strip-types lib/engine.test.ts`.

`scripts/integration-check.py` ejecuta pruebas contra el Supabase configurado y crea dos cuentas temporales. Devuelve sus IDs para borrarlas después mediante una operación administrativa. No guarda ni imprime sus contraseñas o tokens.

## Supabase

`supabase/schema.sql` documenta el esquema aplicado. `supabase/register.ts` es la función Edge `ebc-register`; utiliza exclusivamente las variables de entorno integradas de Supabase. Nunca copiar la clave service_role al navegador ni al repositorio.

`lib/supabase-config.ts` contiene la URL y la clave **publicable**. La protección de datos depende de las políticas RLS, no de ocultar esa clave. La función de registro limita las altas a 20 por hora. El dominio sintético de usuario evita depender de correo de confirmación. Por ello no hay recuperación por correo en esta versión.

## Publicar desde GitHub en Vercel

Repositorio: https://github.com/yufiierules/ebc-community

`vercel.json` selecciona Next.js y configura instalación y compilación automáticamente. En Vercel, importa el repositorio `yufiierules/ebc-community`, conserva la carpeta raíz y el plan gratuito Hobby.

Importar este código en un proyecto Next.js con el equipo autorizado, instalar mediante `pnpm install --frozen-lockfile` y usar `pnpm build:vercel` como comando de compilación. No es necesario mover ni recrear el proyecto Supabase. No se incluyen credenciales de despliegue. La configuración de Sites permanece en `.openai/hosting.json` para la publicación actual.

## Reglas

El marcador de combate conserva Xtreme 3, Burst/Over 2, Spin 1 y penalización +1 al rival. Dos avisos al mismo jugador suman una penalización; los avisos se reinician al terminar una batalla o al sancionar. La rotación de Bey es informativa y no verifica el deck del jugador.

Los puntos de clasificación son independientes del marcador: cada finish otorga el valor elegido; las penalizaciones otorgan el valor elegido al rival; bonus de victoria/derrota y participación se aplican por combate realmente jugado. Los pases automáticos no otorgan puntos. Desempate de liga: puntos, victorias, diferencia del marcador y alias. Torneo: campeón, ronda alcanzada, puntos, victorias y alias.

Los participantes, el formato y el objetivo de combate se fijan al crear una competición. La importación acepta el formato EBC v1; otros formatos requieren conversión.
