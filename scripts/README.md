# Scripts de Inicialización de Base de Datos

Este directorio contiene scripts para inicializar la base de datos del sistema de Casa de Cambio.

## Instrucciones de uso

### Reiniciar la base de datos e inicializar datos básicos

Para resetear completamente la base de datos y cargar los datos iniciales (usuario admin, cliente sistema, activos básicos y balances iniciales), ejecuta:

```bash
# En Linux/Mac:
./scripts/reset-db.sh

# En Windows (Git Bash):
bash scripts/reset-db.sh
```

### Configuración posterior

Después de ejecutar el script de inicialización:

1. **Toma nota del ID del cliente sistema** que se muestra en la consola.
2. **Añade este ID a tu archivo `.env`** con la variable `SYSTEM_CLIENT_ID`:

```
SYSTEM_CLIENT_ID=el-id-generado-por-el-script
```

3. **Reinicia tu aplicación** para que cargue la nueva variable de entorno.

### Credenciales de administrador predeterminadas

El script crea un usuario administrador con las siguientes credenciales:

- **Username:** admin
- **Password:** Admin123!
- **Rol:** SUPER_ADMIN

Usa estas credenciales para iniciar sesión y obtener un token de autenticación.

## Datos creados por el script

El script inicializa:

1. Un usuario administrador
2. Un cliente que representa al sistema (Casa de Cambio)
3. Activos básicos (USD, EUR, ARS, Comisión)
4. Balances iniciales para el sistema

## Personalización

Si deseas modificar los datos iniciales, edita el archivo `initialize-db.ts` antes de ejecutar el script de reseteo.
