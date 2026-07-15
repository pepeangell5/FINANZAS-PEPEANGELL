# Configuración de Supabase

Usa un proyecto nuevo y exclusivo para esta aplicación. No conectes el Supabase del cliente ni `pepeangell-shop`.

## 1. Vincular y crear la base

Desde esta carpeta:

```powershell
npx supabase@2.109.1 login
npx supabase@2.109.1 link --project-ref TU_PROJECT_REF
npm run db:push
```

Las migraciones crean las tablas, funciones, datos iniciales y políticas RLS. Docker no es necesario para empujar migraciones al proyecto remoto.

## 2. Crear el único usuario

En Supabase abre `Authentication > Users > Add user` y crea la cuenta de Pepe con correo confirmado y una contraseña fuerte.

Después abre `SQL Editor`, copia `supabase/promote-admin.sql`, sustituye el correo y ejecútalo. Cierra cualquier sesión abierta antes de probar el login para que el token nuevo incluya el rol `admin`.

## 3. Cerrar el registro público

En la configuración de Authentication desactiva la creación pública de usuarios. La aplicación no contiene formulario de registro, pero esta opción añade otra barrera.

## 4. URLs de autenticación

Configura como Site URL:

```text
https://www.pepeangell.dev/finanzas
```

Agrega Redirect URLs para:

```text
http://localhost:3000/finanzas/actualizar-contrasena
https://www.pepeangell.dev/finanzas/actualizar-contrasena
```

Cuando exista la URL del proyecto Vercel independiente, agrega también su ruta `/finanzas/actualizar-contrasena`.

## 5. Variables de Vercel

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_SITE_URL=https://www.pepeangell.dev/finanzas
```

La secret key es exclusivamente del servidor. No la pegues en conversaciones, commits, capturas ni variables con prefijo `NEXT_PUBLIC_`.
