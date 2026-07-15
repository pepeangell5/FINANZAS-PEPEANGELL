# Configuración de Supabase

Finanzas comparte el proyecto `pepeangell-shop`, pero todos sus objetos viven en el esquema `finance`. No modifica las tablas de tienda del esquema `public`.

## 1. Exponer el esquema finance

En Supabase abre `Project Settings > Data API` y agrega `finance` a **Exposed schemas**. Conserva también `public` porque la tienda lo utiliza.

La migración concede los permisos mínimos y activa RLS en todas las tablas financieras.

## 2. Vincular y crear la base

Desde la carpeta `FINANZAS-PEPEANGELL`:

```powershell
npx supabase@2.109.1 login
npx supabase@2.109.1 link --project-ref bnsilqtypedxwksqopdz
npm run db:push
```

Docker no es necesario para empujar migraciones al proyecto remoto.

## 3. Usuario administrador

No necesitas crear otra cuenta si usarás el mismo correo del admin de tienda. La migración detecta los administradores existentes en `public.profiles` y crea automáticamente su perfil y categorías dentro de `finance`.

`supabase/promote-admin.sql` queda como herramienta de respaldo para preparar manualmente una cuenta futura. Cierra cualquier sesión abierta antes de probar el login para que el token nuevo incluya el rol `admin`.

Supabase Auth se comparte en todo el proyecto. Cambiar la contraseña desde Finanzas también cambia la contraseña del admin de tienda para ese correo.

## 4. Cerrar el registro público

La aplicación no contiene formulario de registro. Antes de desactivar el registro público en Supabase, confirma que la tienda tampoco lo necesita.

## 5. URLs de autenticación

Configura como Site URL:

```text
https://www.pepeangell.dev
```

Agrega estas Redirect URLs sin eliminar las que usa la tienda:

```text
http://localhost:3000/finanzas/actualizar-contrasena
http://localhost:3001/finanzas/actualizar-contrasena
https://www.pepeangell.dev/finanzas/actualizar-contrasena
```

Cuando exista la URL del proyecto Vercel independiente, agrega también su ruta `/finanzas/actualizar-contrasena`.

## 6. Variables de Vercel

Finanzas utiliza las credenciales del proyecto `pepeangell-shop`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_SITE_URL=https://www.pepeangell.dev/finanzas
```

La secret key es exclusivamente del servidor. No la pegues en conversaciones, commits, capturas ni variables con prefijo `NEXT_PUBLIC_`.
