# ESP32-TOOLS Finanzas

Panel personal de finanzas de PepeAngell. Es una aplicación Next.js independiente que se publica detrás de `https://www.pepeangell.dev/finanzas`.

## Privacidad

- No existe registro público.
- El acceso usa Supabase Auth con correo/usuario y contraseña.
- Todas las tablas financieras tienen RLS y aíslan los datos mediante `auth.uid()`.
- Las páginas envían `noindex`, `nofollow` y `noarchive`.
- La clave administrativa de Supabase solo se configura como variable privada del servidor.

La ruta puede ser descubierta; la protección real depende de Supabase Auth, las políticas RLS y una contraseña segura.

## Desarrollo local

1. Instala dependencias con `npm ci`.
2. Crea `.env.local` usando `.env.local.example`.
3. Ejecuta `npm run dev`.
4. Abre `http://localhost:3000/finanzas`.

## Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000/finanzas
```

`SUPABASE_SECRET_KEY` nunca debe incluirse en Git, mensajes o código del navegador.

## Producción

La aplicación se despliega como un proyecto Vercel separado. `PEPEANGELL.DEV` utiliza un rewrite externo para servirla bajo `/finanzas` sin mezclar los runtimes de Astro y Next.js.
